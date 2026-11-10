import { promises as fs } from 'node:fs';
import path from 'node:path';
import { compileSite, newId, type CmsSnapshot, type Document } from '@studio/core';
import { HttpError, JsonFile, nowIso } from './util.js';

export type DeploymentStatus = 'queued' | 'building' | 'ready' | 'failed';
export type DeploymentMode = 'preview' | 'production';

export interface Deployment {
  id: string;
  siteId: string;
  mode: DeploymentMode;
  status: DeploymentStatus;
  documentVersion: number;
  createdAt: string;
  finishedAt?: string;
  fileCount?: number;
  routes?: { path: string; file: string }[];
  warnings?: string[];
  error?: string;
  /** Path-based URL served by the edge. */
  url: string;
}

export interface SiteRecord {
  id: string;
  liveDeploymentId: string | null;
  previousDeploymentIds: string[];
  webhooks: { id: string; url: string; events: string[] }[];
}

interface DeploymentsState {
  deployments: Deployment[];
}

export interface Snapshot {
  document: Document;
  cms: CmsSnapshot;
}

type SnapshotFn = (siteId: string) => Promise<Snapshot>;
type WebhookSender = (url: string, event: string, payload: unknown) => Promise<void>;

export const defaultWebhookSender: WebhookSender = async (url, event, payload) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-studio-event': event },
      body: JSON.stringify({ event, ...(payload as object) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Publish pipeline: snapshot -> job queue -> build worker -> immutable
 * deployment folder -> (production only) swap the live pointer.
 * Rollback is just pointing `liveDeploymentId` at an older folder.
 */
export class PublishService {
  private state!: JsonFile<DeploymentsState>;
  private sites = new Map<string, JsonFile<SiteRecord>>();
  private queue: string[] = [];
  private running = 0;
  private waiters = new Map<string, Set<() => void>>();
  readonly concurrency: number;

  constructor(
    private dir: string,
    private snapshot: SnapshotFn,
    private opts: {
      concurrency?: number;
      baseUrlFor?: (siteId: string) => string | undefined;
      /** Path prefix for a production deployment (empty on a custom domain). */
      productionBasePath?: (siteId: string) => string;
      sendWebhook?: WebhookSender;
    } = {},
  ) {
    this.concurrency = opts.concurrency ?? 2;
  }

  async init(): Promise<void> {
    this.state = await JsonFile.load<DeploymentsState>(path.join(this.dir, 'deployments.json'), () => ({ deployments: [] }));
    // Anything left mid-build by a crash is failed; a deployment is only ever ready or not.
    for (const d of this.state.value.deployments) {
      if (d.status === 'queued' || d.status === 'building') {
        d.status = 'failed';
        d.error = 'server restarted during build';
      }
    }
    this.state.save();
  }

  deploymentDir(id: string): string {
    return path.join(this.dir, 'deployments', id);
  }

  async site(siteId: string): Promise<SiteRecord> {
    const existing = this.sites.get(siteId);
    if (existing) return existing.value;
    const jf = await JsonFile.load<SiteRecord>(path.join(this.dir, 'sites', `${siteId}.json`), () => ({ id: siteId, liveDeploymentId: null, previousDeploymentIds: [], webhooks: [] }));
    this.sites.set(siteId, jf);
    return jf.value;
  }

  private saveSite(siteId: string) {
    this.sites.get(siteId)?.save();
  }

  list(siteId: string): Deployment[] {
    return this.state.value.deployments.filter((d) => d.siteId === siteId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Deployment {
    const d = this.state.value.deployments.find((x) => x.id === id);
    if (!d) throw new HttpError(404, 'deployment not found');
    return d;
  }

  /** POST /sites/:id/publish -> deploymentId. Returns immediately; the worker builds. */
  async publish(siteId: string, mode: DeploymentMode): Promise<Deployment> {
    const snap = await this.snapshot(siteId);
    const id = newId('dep');
    const deployment: Deployment = {
      id,
      siteId,
      mode,
      status: 'queued',
      documentVersion: snap.document.version,
      createdAt: nowIso(),
      url: `/preview/${id}/`,
    };
    this.state.value.deployments.push(deployment);
    this.state.save();
    // The snapshot is frozen now, not when the worker picks the job up.
    this.snapshots.set(id, snap);
    this.queue.push(id);
    this.pump();
    return deployment;
  }

  private snapshots = new Map<string, Snapshot>();

  private pump() {
    while (this.running < this.concurrency && this.queue.length) {
      const id = this.queue.shift()!;
      this.running++;
      this.build(id)
        .catch((err) => console.error('build crashed', id, err))
        .finally(() => {
          this.running--;
          this.notify(id);
          this.pump();
        });
    }
  }

  private async build(id: string): Promise<void> {
    const deployment = this.get(id);
    const snap = this.snapshots.get(id);
    this.snapshots.delete(id);
    deployment.status = 'building';
    this.state.save();
    try {
      if (!snap) throw new Error('snapshot missing');
      const basePath = deployment.mode === 'preview' ? `/preview/${id}` : this.opts.productionBasePath?.(deployment.siteId) ?? '';
      const baseUrl = deployment.mode === 'preview' ? undefined : this.opts.baseUrlFor?.(deployment.siteId);
      const result = compileSite(snap.document, snap.cms, { baseUrl, basePath });
      const dir = this.deploymentDir(id);
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(dir, { recursive: true });
      for (const [file, content] of Object.entries(result.files)) {
        const target = path.join(dir, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
      }
      await fs.writeFile(path.join(dir, '_deployment.json'), JSON.stringify({ id, siteId: deployment.siteId, mode: deployment.mode, documentVersion: deployment.documentVersion, createdAt: deployment.createdAt }, null, 2));
      deployment.status = 'ready';
      deployment.fileCount = Object.keys(result.files).length;
      deployment.routes = result.routes.map((r) => ({ path: r.path, file: r.file }));
      deployment.warnings = result.warnings;
      deployment.finishedAt = nowIso();
      this.state.save();
      if (deployment.mode === 'production') await this.setLive(deployment.siteId, id, 'publish');
    } catch (err) {
      deployment.status = 'failed';
      deployment.error = err instanceof Error ? err.message : String(err);
      deployment.finishedAt = nowIso();
      this.state.save();
    }
  }

  /** Switch the live pointer. Used by publish (forward) and rollback (backward). */
  async setLive(siteId: string, deploymentId: string, reason: 'publish' | 'rollback'): Promise<SiteRecord> {
    const d = this.get(deploymentId);
    if (d.siteId !== siteId) throw new HttpError(404, 'deployment not found');
    if (d.status !== 'ready') throw new HttpError(409, `deployment is ${d.status}`);
    const site = await this.site(siteId);
    if (site.liveDeploymentId && site.liveDeploymentId !== deploymentId) {
      site.previousDeploymentIds = [site.liveDeploymentId, ...site.previousDeploymentIds.filter((x) => x !== deploymentId)].slice(0, 20);
    }
    site.liveDeploymentId = deploymentId;
    this.saveSite(siteId);
    await this.emit(siteId, reason === 'publish' ? 'site.published' : 'site.rolled_back', { siteId, deploymentId, documentVersion: d.documentVersion, at: nowIso() });
    return site;
  }

  async addWebhook(siteId: string, url: string, events = ['site.published', 'site.rolled_back']): Promise<SiteRecord['webhooks'][number]> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError(422, 'invalid webhook url');
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new HttpError(422, 'webhook url must be http(s)');
    const site = await this.site(siteId);
    const hook = { id: newId('wh'), url, events };
    site.webhooks.push(hook);
    this.saveSite(siteId);
    return hook;
  }

  async removeWebhook(siteId: string, hookId: string): Promise<void> {
    const site = await this.site(siteId);
    site.webhooks = site.webhooks.filter((h) => h.id !== hookId);
    this.saveSite(siteId);
  }

  private async emit(siteId: string, event: string, payload: unknown) {
    const site = await this.site(siteId);
    const sender = this.opts.sendWebhook ?? defaultWebhookSender;
    await Promise.all(
      site.webhooks
        .filter((h) => h.events.includes(event))
        .map((h) => sender(h.url, event, payload).catch((err) => console.warn(`webhook ${h.url} failed:`, (err as Error).message))),
    );
  }

  /** Resolve when the deployment leaves the queue/building states. */
  waitFor(id: string, timeoutMs = 30_000): Promise<Deployment> {
    const d = this.get(id);
    if (d.status === 'ready' || d.status === 'failed') return Promise.resolve(d);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.get(id)?.delete(done);
        reject(new Error('timeout waiting for build'));
      }, timeoutMs);
      const done = () => {
        clearTimeout(timer);
        resolve(this.get(id));
      };
      if (!this.waiters.has(id)) this.waiters.set(id, new Set());
      this.waiters.get(id)!.add(done);
    });
  }

  private notify(id: string) {
    const set = this.waiters.get(id);
    if (!set) return;
    this.waiters.delete(id);
    for (const fn of set) fn();
  }

  async close(): Promise<void> {
    await this.state.close();
    for (const s of this.sites.values()) await s.close();
  }
}
