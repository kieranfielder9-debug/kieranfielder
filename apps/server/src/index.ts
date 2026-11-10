import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoProject, FONT_CATALOG, newId, type CmsSnapshot, type Document, type Op } from '@studio/core';
import { DocumentStore } from './store.js';
import { CmsStore } from './cms.js';
import { PublishService } from './publish.js';
import { CertificateManager, DomainService, fakeDns, systemDns } from './domains.js';
import { Edge } from './edge.js';
import { HttpError, mimeFor, readJson, Router, sendJson } from './util.js';

export interface ServerOptions {
  port?: number;
  dataDir?: string;
  editorDist?: string;
  dns?: 'fake' | 'system';
  edgeHost?: string;
  publicUrl?: string;
  seedDemo?: boolean;
  domainPollMs?: number;
  sendWebhook?: (url: string, event: string, payload: unknown) => Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(options: ServerOptions = {}) {
  const dataDir = options.dataDir ?? process.env.STUDIO_DATA ?? path.resolve(here, '..', 'data');
  const editorDist = options.editorDist ?? path.resolve(here, '..', '..', 'editor', 'dist');
  const edgeHost = options.edgeHost ?? process.env.STUDIO_EDGE_HOST ?? 'edge.pocketstudio.local';
  const dnsMode = options.dns ?? (process.env.STUDIO_DNS === 'system' ? 'system' : 'fake');
  let publicUrl = options.publicUrl ?? process.env.STUDIO_PUBLIC_URL ?? '';

  const documents = new DocumentStore(path.join(dataDir, 'documents'));
  const cmsStores = new Map<string, CmsStore>();
  const certs = new CertificateManager();
  let domains!: DomainService;
  domains = new DomainService(dataDir, edgeHost, dnsMode === 'fake' ? fakeDns(() => domains) : systemDns, certs);
  await domains.init(options.domainPollMs ?? 60_000);

  const cmsFor = async (siteId: string, seed?: CmsSnapshot): Promise<CmsStore> => {
    let store = cmsStores.get(siteId);
    if (!store) {
      store = new CmsStore(path.join(dataDir, 'cms'), siteId);
      await store.init(seed);
      cmsStores.set(siteId, store);
    }
    return store;
  };

  const publish = new PublishService(
    dataDir,
    async (siteId) => {
      const document = await documents.get(siteId);
      if (!document) throw new HttpError(404, 'site not found');
      const cms = (await cmsFor(siteId)).snapshot();
      return { document: structuredClone(document), cms };
    },
    {
      sendWebhook: options.sendWebhook,
      baseUrlFor: (siteId) => {
        const active = domains.forSite(siteId).find((d) => d.status === 'active');
        if (active) return `https://${active.hostname}`;
        return publicUrl ? `${publicUrl}/sites/${siteId}` : undefined;
      },
      productionBasePath: (siteId) => (domains.forSite(siteId).some((d) => d.status === 'active') ? '' : `/sites/${siteId}`),
    },
  );
  await publish.init();
  const edge = new Edge(publish, domains, certs);

  // Seed the demo project on first run so the editor opens with something to edit.
  if (options.seedDemo ?? true) {
    const existing = await documents.list();
    if (!existing.length) {
      const demo = createDemoProject('site_demo');
      await documents.create(demo.document);
      await cmsFor('site_demo', demo.cms);
    }
  }

  const api = new Router();

  api.get('/api/health', ({ res }) => sendJson(res, 200, { ok: true, edgeHost, dns: dnsMode, cache: edge.stats() }));
  api.get('/api/fonts', ({ res }) => sendJson(res, 200, { fonts: FONT_CATALOG }, { 'cache-control': 'public, max-age=3600' }));

  // ---- Document store + live sync ----
  api.get('/api/documents', async ({ res }) => sendJson(res, 200, { documents: await documents.list() }));
  api.post('/api/documents', async ({ req, res }) => {
    const body = await readJson<{ name?: string; template?: 'demo' | 'blank' }>(req);
    const id = newId('site');
    if (body.template === 'blank') {
      const rootId = newId();
      const doc: Document = {
        id,
        name: body.name?.trim() || 'Untitled site',
        version: 0,
        nodes: {
          [rootId]: { id: rootId, type: 'frame', parentId: null, children: [], props: { name: 'Home', width: 'fill', fill: '#ffffff', minHeight: 600, layout: { type: 'stack', direction: 'vertical', gap: 24, padding: 48, align: 'stretch', justify: 'start' } }, overrides: {} },
        },
        pages: { page_home: { id: 'page_home', name: 'Home', path: '/', rootId, seo: {} } },
        pageOrder: ['page_home'],
        components: {},
        fonts: [],
      };
      await documents.create(doc);
      await cmsFor(id, { collections: [], items: [] });
      return sendJson(res, 201, { document: doc });
    }
    const demo = createDemoProject(id);
    demo.document.name = body.name?.trim() || demo.document.name;
    await documents.create(demo.document);
    await cmsFor(id, demo.cms);
    sendJson(res, 201, { document: demo.document });
  });
  api.get('/api/documents/:id', async ({ res, params }) => {
    const doc = await documents.get(params.id);
    if (!doc) throw new HttpError(404, 'document not found');
    sendJson(res, 200, { document: doc });
  });
  api.post('/api/documents/:id/ops', async ({ req, res, params }) => {
    const body = await readJson<{ ops: Op[]; clientId?: string; baseVersion?: number }>(req);
    if (!Array.isArray(body.ops) || !body.ops.length) throw new HttpError(400, 'ops[] required');
    const result = await documents.apply(params.id, body.ops, body.clientId ?? null, body.baseVersion);
    sendJson(res, 200, { version: result.version });
  });
  api.get('/api/documents/:id/events', async ({ res, params, url }) => {
    const doc = await documents.get(params.id);
    if (!doc) throw new HttpError(404, 'document not found');
    const since = url.searchParams.get('since');
    documents.subscribe(params.id, res, url.searchParams.get('clientId'), since === null ? undefined : Number(since));
  });

  // ---- CMS ----
  const cmsParam = async (siteId: string) => {
    if (!(await documents.get(siteId))) throw new HttpError(404, 'site not found');
    return cmsFor(siteId);
  };
  api.get('/api/sites/:site/collections', async ({ res, params }) => sendJson(res, 200, { collections: (await cmsParam(params.site)).listCollections() }));
  api.post('/api/sites/:site/collections', async ({ req, res, params }) => sendJson(res, 201, { collection: (await cmsParam(params.site)).createCollection(await readJson(req)) }));
  api.get('/api/sites/:site/collections/:cid', async ({ res, params }) => sendJson(res, 200, { collection: (await cmsParam(params.site)).getCollection(params.cid) }));
  api.patch('/api/sites/:site/collections/:cid', async ({ req, res, params }) => sendJson(res, 200, { collection: (await cmsParam(params.site)).updateCollection(params.cid, await readJson(req)) }));
  api.delete('/api/sites/:site/collections/:cid', async ({ res, params }) => {
    (await cmsParam(params.site)).deleteCollection(params.cid);
    sendJson(res, 200, { ok: true });
  });
  api.get('/api/sites/:site/collections/:cid/items', async ({ res, params }) => sendJson(res, 200, { items: (await cmsParam(params.site)).listItems(params.cid) }));
  api.post('/api/sites/:site/collections/:cid/items', async ({ req, res, params }) => {
    const body = await readJson<{ values?: Record<string, unknown> }>(req);
    sendJson(res, 201, { item: (await cmsParam(params.site)).createItem(params.cid, body.values ?? (body as Record<string, unknown>)) });
  });
  api.get('/api/sites/:site/collections/:cid/items/:item', async ({ res, params }) => sendJson(res, 200, { item: (await cmsParam(params.site)).getItem(params.cid, params.item) }));
  api.patch('/api/sites/:site/collections/:cid/items/:item', async ({ req, res, params }) => {
    const body = await readJson<{ values?: Record<string, unknown> }>(req);
    sendJson(res, 200, { item: (await cmsParam(params.site)).patchItem(params.cid, params.item, body.values ?? (body as Record<string, unknown>)) });
  });
  api.delete('/api/sites/:site/collections/:cid/items/:item', async ({ res, params }) => {
    (await cmsParam(params.site)).deleteItem(params.cid, params.item);
    sendJson(res, 200, { ok: true });
  });

  // ---- Publish & preview ----
  api.get('/api/sites/:site', async ({ res, params }) => {
    const doc = await documents.get(params.site);
    if (!doc) throw new HttpError(404, 'site not found');
    const site = await publish.site(params.site);
    const live = site.liveDeploymentId ? publish.get(site.liveDeploymentId) : null;
    sendJson(res, 200, { site: { ...site, name: doc.name, version: doc.version, live, liveUrl: `/sites/${params.site}/`, domains: domains.forSite(params.site) } });
  });
  api.post('/api/sites/:site/publish', async ({ req, res, params }) => {
    const body = await readJson<{ mode?: 'preview' | 'production' }>(req);
    const mode = body.mode === 'preview' ? 'preview' : 'production';
    const deployment = await publish.publish(params.site, mode);
    sendJson(res, 202, { deploymentId: deployment.id, deployment });
  });
  api.get('/api/sites/:site/deployments', ({ res, params }) => sendJson(res, 200, { deployments: publish.list(params.site) }));
  api.get('/api/deployments/:id', ({ res, params }) => sendJson(res, 200, { deployment: publish.get(params.id) }));
  api.post('/api/sites/:site/live', async ({ req, res, params }) => {
    const body = await readJson<{ deploymentId: string }>(req);
    if (!body.deploymentId) throw new HttpError(400, 'deploymentId required');
    sendJson(res, 200, { site: await publish.setLive(params.site, body.deploymentId, 'rollback') });
  });
  api.post('/api/sites/:site/webhooks', async ({ req, res, params }) => {
    const body = await readJson<{ url: string; events?: string[] }>(req);
    sendJson(res, 201, { webhook: await publish.addWebhook(params.site, body.url, body.events) });
  });
  api.delete('/api/sites/:site/webhooks/:hook', async ({ res, params }) => {
    await publish.removeWebhook(params.site, params.hook);
    sendJson(res, 200, { ok: true });
  });

  // ---- Custom domains & SSL ----
  api.get('/api/sites/:site/domains', ({ res, params }) => sendJson(res, 200, { domains: domains.forSite(params.site) }));
  api.post('/api/sites/:site/domains', async ({ req, res, params }) => {
    if (!(await documents.get(params.site))) throw new HttpError(404, 'site not found');
    const body = await readJson<{ hostname: string }>(req);
    sendJson(res, 201, { domain: domains.add(params.site, body.hostname) });
  });
  api.get('/api/sites/:site/domains/:dom', ({ res, params }) => sendJson(res, 200, { domain: domains.get(params.site, params.dom) }));
  api.post('/api/sites/:site/domains/:dom/verify', async ({ res, params }) => sendJson(res, 200, { domain: await domains.verify(params.site, params.dom) }));
  api.delete('/api/sites/:site/domains/:dom', ({ res, params }) => {
    domains.remove(params.site, params.dom);
    sendJson(res, 200, { ok: true });
  });

  // ---- Static: the editor PWA ----
  const serveStatic = async (res: http.ServerResponse, pathname: string): Promise<boolean> => {
    const clean = path.posix.normalize(decodeURIComponent(pathname));
    if (clean.includes('..')) return false;
    const candidates = [path.join(editorDist, clean), path.join(editorDist, 'index.html')];
    for (const file of candidates) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) continue;
        const body = await fs.readFile(file);
        const isHashed = /\/assets\/.*-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file);
        res.writeHead(200, {
          'content-type': mimeFor(file),
          'content-length': String(body.length),
          'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
          'service-worker-allowed': '/',
        });
        res.end(body);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (await edge.handle(req, res, url)) return;
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('access-control-allow-headers', 'content-type');
        res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const match = api.match(req.method ?? 'GET', url.pathname);
        if (!match) throw new HttpError(404, `no route for ${req.method} ${url.pathname}`);
        await match.handler({ req, res, params: match.params, url });
        return;
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (await serveStatic(res, url.pathname)) return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found (build the editor with `npm run build` first)');
    } catch (err) {
      if (err instanceof HttpError) sendJson(res, err.status, { error: err.message, details: err.details });
      else {
        console.error(err);
        sendJson(res, 500, { error: 'internal error' });
      }
    }
  });

  const port = options.port ?? Number(process.env.PORT ?? 8787);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  if (!publicUrl) publicUrl = `http://localhost:${actualPort}`;

  return {
    server,
    port: actualPort,
    documents,
    publish,
    domains,
    edge,
    cmsFor,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await documents.close();
      await publish.close();
      await domains.close();
      for (const s of cmsStores.values()) await s.close();
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  createServer().then((s) => {
    console.log(`Pocket Studio server listening on http://localhost:${s.port}`);
    console.log(`  editor:  http://localhost:${s.port}/`);
    console.log(`  live:    http://localhost:${s.port}/sites/site_demo/`);
    const shutdown = () => s.close().then(() => process.exit(0));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
