import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer } from '../dist/index.js';

/** fetch() drops a custom Host header, so host-based routing is tested with http.request. */
function hostGet(port, hostname, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: { host: hostname } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function boot(extra = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'studio-'));
  const webhooks = [];
  const s = await createServer({ port: 0, dataDir, dns: 'fake', domainPollMs: 0, sendWebhook: async (url, event, payload) => void webhooks.push({ url, event, payload }), ...extra });
  const base = `http://localhost:${s.port}`;
  const j = async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
  return { s, base, j, webhooks, cleanup: async () => { await s.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

test('document store: ops apply, version bumps, SSE fans out to other clients', async () => {
  const { s, base, j, cleanup } = await boot();
  try {
    const { body } = await j('GET', '/api/documents/site_demo');
    assert.equal(body.document.version, 0);
    const ac = new AbortController();
    const stream = await fetch(`${base}/api/documents/site_demo/events?clientId=other&since=0`, { signal: ac.signal });
    const reader = stream.body.getReader();
    const r = await j('POST', '/api/documents/site_demo/ops', { clientId: 'me', ops: [{ type: 'updateNode', id: 'hero_title', props: { fontSize: 99 } }] });
    assert.equal(r.status, 200);
    assert.equal(r.body.version, 1);
    let text = '';
    const dec = new TextDecoder();
    while (!text.includes('event: ops')) text += dec.decode((await reader.read()).value);
    assert.match(text, /"fontSize":99/);
    assert.match(text, /"clientId":"me"/);
    ac.abort();
    const after = await j('GET', '/api/documents/site_demo');
    assert.equal(after.body.document.nodes.hero_title.props.fontSize, 99);
    const bad = await j('POST', '/api/documents/site_demo/ops', { ops: [{ type: 'updateNode', id: 'nope', props: {} }] });
    assert.equal(bad.status, 422);
    assert.equal((await j('GET', '/api/documents/site_demo')).body.document.version, 1, 'rejected batch does not bump version');
    void s;
  } finally {
    await cleanup();
  }
});

test('CMS REST: collections, field types, validation, references', async () => {
  const { j, cleanup } = await boot();
  try {
    const col = await j('POST', '/api/sites/site_demo/collections', { name: 'Team', fields: [{ name: 'Name', type: 'text', required: true }, { name: 'Slug', type: 'slug', required: true }, { name: 'Boss', type: 'reference', referenceCollectionId: 'col_authors' }] });
    assert.equal(col.status, 201);
    const cid = col.body.collection.id;
    const bad = await j('POST', `/api/sites/site_demo/collections/${cid}/items`, { values: { name: 'Kim', slug: 'Bad!', boss: 'nobody' } });
    assert.equal(bad.status, 422);
    assert.ok(bad.body.details.slug && bad.body.details.boss);
    const ok = await j('POST', `/api/sites/site_demo/collections/${cid}/items`, { values: { name: 'Kim', slug: 'kim', boss: 'it_ada' } });
    assert.equal(ok.status, 201);
    const patched = await j('PATCH', `/api/sites/site_demo/collections/${cid}/items/${ok.body.item.id}`, { values: { name: 'Kim L.' } });
    assert.equal(patched.body.item.values.name, 'Kim L.');
    assert.equal(patched.body.item.values.slug, 'kim');
    const dupe = await j('POST', `/api/sites/site_demo/collections/${cid}/items`, { values: { name: 'Other', slug: 'kim' } });
    assert.equal(dupe.status, 422);
    const unknownType = await j('POST', '/api/sites/site_demo/collections', { name: 'X', fields: [{ name: 'F', type: 'video' }] });
    assert.equal(unknownType.status, 422);
    const list = await j('GET', `/api/sites/site_demo/collections/${cid}/items`);
    assert.equal(list.body.items.length, 1);
  } finally {
    await cleanup();
  }
});

test('publish: queue -> immutable deployment -> live pointer; preview; rollback; webhook', async () => {
  const { s, base, j, webhooks, cleanup } = await boot();
  try {
    await j('POST', '/api/sites/site_demo/webhooks', { url: 'https://hooks.example/x' });
    const first = await j('POST', '/api/sites/site_demo/publish', { mode: 'production' });
    assert.equal(first.status, 202);
    const d1 = await s.publish.waitFor(first.body.deploymentId);
    assert.equal(d1.status, 'ready');
    assert.equal(d1.fileCount, 10);
    let site = (await j('GET', '/api/sites/site_demo')).body.site;
    assert.equal(site.liveDeploymentId, d1.id);
    assert.equal(webhooks.length, 1);
    assert.equal(webhooks[0].event, 'site.published');

    const live = await fetch(`${base}/sites/site_demo/blog/hello-world/`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-studio-deployment'), d1.id);
    assert.match(await live.text(), /<h1>Hello, world<\/h1>/);
    const css = await fetch(`${base}/sites/site_demo${d1.routes ? '' : ''}/assets/site.00000000.css`);
    assert.equal(css.status, 404);
    const missing = await fetch(`${base}/sites/site_demo/nope/`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /404/);

    // Edit, then preview: the preview is a separate build on a temp URL; live is untouched.
    await j('POST', '/api/documents/site_demo/ops', { ops: [{ type: 'setText', id: 'hero_title', text: { blocks: [{ type: 'heading', level: 1, spans: [{ text: 'PREVIEW TITLE' }] }] } }] });
    const prev = await j('POST', '/api/sites/site_demo/publish', { mode: 'preview' });
    const dp = await s.publish.waitFor(prev.body.deploymentId);
    assert.equal(dp.mode, 'preview');
    const pv = await fetch(`${base}${dp.url}`);
    assert.equal(pv.headers.get('cache-control'), 'no-store');
    assert.equal(pv.headers.get('x-robots-tag'), 'noindex');
    const pvHtml = await pv.text();
    assert.match(pvHtml, /PREVIEW TITLE/);
    assert.match(pvHtml, new RegExp(`href="/preview/${dp.id}/assets/site\\.`), 'preview assets resolve under the preview path');
    assert.doesNotMatch(await (await fetch(`${base}/sites/site_demo/`)).text(), /PREVIEW TITLE/);
    site = (await j('GET', '/api/sites/site_demo')).body.site;
    assert.equal(site.liveDeploymentId, d1.id, 'preview never moves the live pointer');

    // Publish again, then roll back.
    const second = await j('POST', '/api/sites/site_demo/publish', { mode: 'production' });
    const d2 = await s.publish.waitFor(second.body.deploymentId);
    assert.match(await (await fetch(`${base}/sites/site_demo/`)).text(), /PREVIEW TITLE/);
    const rb = await j('POST', '/api/sites/site_demo/live', { deploymentId: d1.id });
    assert.equal(rb.body.site.liveDeploymentId, d1.id);
    assert.deepEqual(rb.body.site.previousDeploymentIds[0], d2.id);
    assert.doesNotMatch(await (await fetch(`${base}/sites/site_demo/`)).text(), /PREVIEW TITLE/);
    assert.equal(webhooks.at(-1).event, 'site.rolled_back');
    const notReady = await j('POST', '/api/sites/site_demo/live', { deploymentId: dp.id });
    assert.equal(notReady.status, 200, 'preview builds can be promoted too once ready');
    const asset = await fetch(`${base}/sites/site_demo${d1.routes[0].file.replace('/index.html', '')}/`);
    assert.equal(asset.status, 200);
  } finally {
    await cleanup();
  }
});

test('domains: DNS records -> verify -> certificate -> host routing', async () => {
  const { s, base, j, cleanup } = await boot();
  try {
    const bad = await j('POST', '/api/sites/site_demo/domains', { hostname: 'not a host' });
    assert.equal(bad.status, 422);
    const add = await j('POST', '/api/sites/site_demo/domains', { hostname: 'WWW.Example.com' });
    assert.equal(add.status, 201);
    const dom = add.body.domain;
    assert.equal(dom.hostname, 'www.example.com');
    assert.equal(dom.status, 'pending_dns');
    assert.deepEqual(dom.records.map((r) => r.type), ['CNAME', 'TXT']);
    assert.equal(dom.records[0].value, s.domains.edgeHost);

    const before = await hostGet(s.port, 'www.example.com', '/');
    assert.equal(before.headers['x-studio-deployment'], undefined, 'not routed before verification');

    const verified = await j('POST', `/api/sites/site_demo/domains/${dom.id}/verify`);
    assert.equal(verified.body.domain.status, 'active');
    assert.ok(verified.body.domain.certificate.notAfter > verified.body.domain.certificate.notBefore);
    const status = await j('GET', `/api/sites/site_demo/domains/${dom.id}`);
    assert.equal(status.body.domain.status, 'active');

    const unpublished = await hostGet(s.port, 'www.example.com', '/');
    assert.equal(unpublished.status, 404);
    const pub = await j('POST', '/api/sites/site_demo/publish', { mode: 'production' });
    await s.publish.waitFor(pub.body.deploymentId);
    const live = await hostGet(s.port, 'www.example.com', '/blog/hello-world/');
    assert.equal(live.status, 200);
    const html = live.body;
    void base;
    assert.match(html, /<link rel="canonical" href="https:\/\/www.example.com\/blog\/hello-world">/, 'canonical uses the custom domain');
    assert.match(html, /href="\/assets\/site\./, 'no base path on a custom domain');
    const apex = await j('POST', '/api/sites/site_demo/domains', { hostname: 'example.com' });
    assert.equal(apex.body.domain.records[0].type, 'A');
  } finally {
    await cleanup();
  }
});

test('edge serves the ACME challenge path and immutable asset caching', async () => {
  const { s, base, j, cleanup } = await boot();
  try {
    const nope = await fetch(`${base}/.well-known/acme-challenge/abc`);
    assert.equal(nope.status, 404);
    const pub = await j('POST', '/api/sites/site_demo/publish', { mode: 'production' });
    const d = await s.publish.waitFor(pub.body.deploymentId);
    const home = await (await fetch(`${base}/sites/site_demo/`)).text();
    const cssPath = home.match(/href="(\/sites\/site_demo\/assets\/site\.[a-f0-9]+\.css)"/)[1];
    const css = await fetch(`${base}${cssPath}`);
    assert.equal(css.status, 200);
    assert.equal(css.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    const etag = css.headers.get('etag');
    const again = await fetch(`${base}${cssPath}`, { headers: { 'if-none-match': etag } });
    assert.equal(again.status, 304);
    assert.ok(s.edge.stats().entries >= 2, 'edge cache warmed');
    void d;
  } finally {
    await cleanup();
  }
});
