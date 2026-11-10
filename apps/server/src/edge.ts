import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PublishService } from './publish.js';
import type { DomainService } from './domains.js';
import type { CertificateManager } from './domains.js';
import { mimeFor } from './util.js';

interface CachedFile {
  body: Buffer;
  type: string;
  etag: string;
}

/**
 * The edge: resolves a request to a deployment (by custom domain, by site id
 * or by preview id) and serves its files. Deployments are immutable, so the
 * cache is keyed by deployment id and never needs invalidating; switching the
 * live pointer is what "purges" a site.
 */
export class Edge {
  private cache = new Map<string, CachedFile>();
  private cacheBytes = 0;
  private maxCacheBytes: number;

  constructor(
    private publish: PublishService,
    private domains: DomainService,
    private certs: CertificateManager,
    opts: { maxCacheBytes?: number } = {},
  ) {
    this.maxCacheBytes = opts.maxCacheBytes ?? 64 * 1024 * 1024;
  }

  /** Returns true if the request was handled by the edge. */
  async handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const pathname = url.pathname;

    const challenge = /^\/\.well-known\/acme-challenge\/([A-Za-z0-9_-]+)$/.exec(pathname);
    if (challenge) {
      const answer = this.certs.challengeResponse(challenge[1]);
      res.writeHead(answer ? 200 : 404, { 'content-type': 'text/plain' });
      res.end(answer ?? 'unknown challenge');
      return true;
    }

    // 1. Custom domain: Host header -> active domain -> live deployment.
    const host = (req.headers.host ?? '').split(':')[0].toLowerCase();
    const domain = host ? this.domains.byHostname(host) : undefined;
    if (domain && domain.status === 'active') {
      const site = await this.publish.site(domain.siteId);
      if (!site.liveDeploymentId) return this.notLive(res);
      return this.serve(res, site.liveDeploymentId, pathname, req, 'live');
    }

    // 2. Path-based routes for development: /preview/:deploymentId/* and /sites/:siteId/*.
    const preview = /^\/preview\/([a-zA-Z0-9_-]+)(\/.*)?$/.exec(pathname);
    if (preview) {
      if (!preview[2]) return this.redirect(res, `${pathname}/`);
      return this.serve(res, preview[1], preview[2], req, 'preview');
    }
    const site = /^\/sites\/([a-zA-Z0-9_-]+)(\/.*)?$/.exec(pathname);
    if (site) {
      if (!site[2]) return this.redirect(res, `${pathname}/`);
      const record = await this.publish.site(site[1]);
      if (!record.liveDeploymentId) return this.notLive(res);
      return this.serve(res, record.liveDeploymentId, site[2], req, 'live');
    }
    return false;
  }

  private redirect(res: ServerResponse, to: string): boolean {
    res.writeHead(301, { location: to });
    res.end();
    return true;
  }

  private notLive(res: ServerResponse): boolean {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end('<!doctype html><title>Not published</title><p style="font-family:system-ui">This site has not been published yet.</p>');
    return true;
  }

  async serve(res: ServerResponse, deploymentId: string, filePath: string, req: IncomingMessage, kind: 'live' | 'preview'): Promise<boolean> {
    let deployment;
    try {
      deployment = this.publish.get(deploymentId);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('deployment not found');
      return true;
    }
    if (deployment.status !== 'ready') {
      res.writeHead(deployment.status === 'failed' ? 500 : 503, { 'content-type': 'text/plain', 'retry-after': '2', 'cache-control': 'no-store' });
      res.end(`deployment is ${deployment.status}${deployment.error ? `: ${deployment.error}` : ''}`);
      return true;
    }
    const resolved = this.resolvePath(filePath);
    const file = (await this.read(deploymentId, resolved)) ?? (await this.read(deploymentId, '/404.html'));
    const status = file && resolved !== '/404.html' && (await this.read(deploymentId, resolved)) ? 200 : 404;
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return true;
    }
    if (req.headers['if-none-match'] === file.etag) {
      res.writeHead(304);
      res.end();
      return true;
    }
    const isAsset = resolved.startsWith('/assets/');
    const cacheControl = isAsset
      ? 'public, max-age=31536000, immutable'
      : kind === 'preview'
        ? 'no-store'
        : 'public, max-age=0, must-revalidate';
    res.writeHead(status, {
      'content-type': file.type,
      'content-length': String(file.body.length),
      etag: file.etag,
      'cache-control': cacheControl,
      'x-studio-deployment': deploymentId,
      'x-robots-tag': kind === 'preview' ? 'noindex' : 'all',
    });
    res.end(req.method === 'HEAD' ? undefined : file.body);
    return true;
  }

  private resolvePath(p: string): string {
    let clean = decodeURIComponent(p.split('?')[0]);
    clean = path.posix.normalize(clean);
    if (clean.includes('..')) clean = '/';
    if (clean.endsWith('/')) clean += 'index.html';
    else if (!path.posix.extname(clean)) clean += '/index.html';
    return clean;
  }

  private async read(deploymentId: string, file: string): Promise<CachedFile | null> {
    const key = `${deploymentId}${file}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const abs = path.join(this.publish.deploymentDir(deploymentId), file);
    try {
      const body = await fs.readFile(abs);
      const entry: CachedFile = { body, type: mimeFor(file), etag: `"${deploymentId}-${body.length}-${simpleHash(body)}"` };
      this.remember(key, entry);
      return entry;
    } catch {
      return null;
    }
  }

  private remember(key: string, entry: CachedFile) {
    this.cache.set(key, entry);
    this.cacheBytes += entry.body.length;
    while (this.cacheBytes > this.maxCacheBytes && this.cache.size) {
      const oldest = this.cache.keys().next().value as string;
      this.cacheBytes -= this.cache.get(oldest)!.body.length;
      this.cache.delete(oldest);
    }
  }

  stats(): { entries: number; bytes: number } {
    return { entries: this.cache.size, bytes: this.cacheBytes };
  }
}

function simpleHash(buf: Buffer): string {
  let h = 2166136261;
  for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 16777619) >>> 0;
  return h.toString(16);
}
