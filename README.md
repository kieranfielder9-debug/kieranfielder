# Pocket Studio

A visual site builder you install on your phone like an app. Design pages on an
infinite canvas, manage content in a CMS, and publish a static site to custom
domains with HTTPS. It is a Progressive Web App (PWA): open it once in Safari
or Chrome, tap **Add to Home Screen**, and it launches full-screen from your
home screen (and keeps working offline for editing).

Everything is TypeScript. There are no runtime dependencies beyond React for
the editor; the server is plain Node.

## Quick start

```bash
npm install
npm run build        # core + server + editor
npm start            # http://localhost:8787
```

- Editor: `http://localhost:8787/`
- Live site (after you tap Publish): `http://localhost:8787/sites/site_demo/`
- Compact widget view: `http://localhost:8787/?view=widget`

For development with hot reload, run `npm run dev` (API on 8787, Vite on 5173).

Run the tests with `npm test`.

## Put it on your phone

The app must be reachable from the phone over HTTPS (localhost is exempt).
Either deploy it (see **Deploying**) or, on a LAN, run it behind any reverse
proxy with a certificate.

**iPhone / iPad** – open the URL in Safari, tap Share, then **Add to Home
Screen**. It opens full-screen with the Studio icon.

**Android** – open the URL in Chrome, tap the **Install** button in the top bar
(or the browser menu, **Install app**). Long-press the icon afterwards for the
**Publish widget** and **Content** shortcuts.

The `?view=widget` route is a deliberately tiny screen: site status, one-tap
**Publish**, **Preview**, and a link to the live site. It is listed as an app
shortcut in the manifest so it is one long-press away on Android. Web apps
cannot render a native home-screen widget on either platform; this is the
closest a web app can get, and it is what the shortcut points at.

## The three systems

The spec's "shared spine" is the shape of the repo:

| System | Where | What it owns |
| --- | --- | --- |
| **Document store** | `apps/server/src/store.ts` + `packages/core/src/ops.ts` | The node tree per site, an append-only op log, Server-Sent Events fan-out. The editor applies the same reducer optimistically, so undo/redo, offline queueing and multi-device sync all speak "ops". |
| **Compiler** | `packages/core/src/compile.ts` | Tree + CMS snapshot → static site: HTML per route, one stylesheet with media queries, `<head>` meta, sitemap, robots, 404, and one `.jsx` per component. Deterministic and pure, so it runs in the build worker and could run in the browser. |
| **Edge** | `apps/server/src/edge.ts` + `domains.ts` + `publish.ts` | Immutable deployment folders, a live pointer per site, host-based routing for custom domains, ACME challenge path, an in-memory cache keyed by deployment id (never needs invalidation). |

Everything else plugs into one of those three.

## Feature map

| # | Feature | Mechanism in this codebase |
| --- | --- | --- |
| 1 | Infinite canvas | `apps/editor/src/canvas/Canvas.tsx`: one `translate/scale` transform on `.world`; pinch, drag-pan and wheel gestures; only artboards intersecting the viewport render, and inside them off-screen absolute nodes are culled (`NodeView.tsx`). Internal API: `store.set({ viewport })`, `store.select(id)`. |
| 2 | Frames | `DocNode` with `type: 'frame'`, size, fill, `clip`, `children[]`; rendered as a `div` (or the chosen semantic tag). `ops.createNode`, `ops.updateNode`. |
| 3 | Stacks | `props.layout = { type: 'stack', direction, gap, padding, align, justify, wrap }` → Flexbox via `compileStyle()` in `packages/core/src/style.ts`, used by both the editor and the compiler. |
| 4 | Breakpoints | `node.overrides[bp]` cascade desktop → tablet → phone (`resolveProps`). The compiler emits only the diff inside `@media (max-width: …)`. `ops.updateNode(id, props, { breakpoint: 'tablet' })`. |
| 5 | Rich text & fonts | Text is `{ blocks: [{ type, level, spans: [{ text, marks }] }] }`, never HTML (`richtext.ts`). The inspector's editor parses the DOM back to that JSON on every edit. `GET /api/fonts` serves the catalog; self-hosted fonts compile to `@font-face`, Google ones to a stylesheet link. |
| 6 | Components | `createComponent` detaches a subtree into the registry and swaps in an instance; instances store only `instanceOverrides` keyed `masterNodeId.prop`. `expandTree()` resolves instances for rendering, so a master edit propagates everywhere. The compiler also exports each component as a React component (`/components/Name.jsx`). |
| 7 | CMS collections | `apps/server/src/cms.ts`, separate from the document. REST: `POST /api/sites/:id/collections`, `GET/POST/PATCH/DELETE …/items`. Postgres schema in `apps/server/sql/cms.sql` (items hold `values` as JSONB); the file store mirrors it. |
| 8 | Field types | One registry, `FIELD_TYPES` in `packages/core/src/cms.ts`, with `validate`, `widget`, `toText/toHtml/toUrl` and `defaultValue` per type: text, richText, number, boolean, date, image, slug, color, reference. The CMS UI, the validator and the compiler all read it. |
| 9 | Dynamic templates | A page with `collectionId` and a path like `/blog/:slug` is rendered once per item. `ops.bindProp(nodeId, 'text', { collection, field })` binds node props (`text`, `src`, `alt`, `link`, `fill`, `color`); `author.name` follows a reference. A frame with `props.repeat` repeats its children per item on any page. |
| 10 | SEO meta | `page.seo = { title, description, ogImage, noIndex }`; each value is a string or a binding. `compileHead()` writes title, description, canonical, Open Graph, Twitter card; `compileSitemap()` writes `sitemap.xml`. `ops.updatePage(id, { seo })`. |
| 11 | Publish & preview | `POST /api/sites/:id/publish { mode }` snapshots the document version + CMS, queues a job, and a worker writes an immutable folder `data/deployments/<id>/`. Production builds switch `liveDeploymentId`; rollback (`POST /api/sites/:id/live`) switches it back. `GET /api/deployments/:id`, webhooks `site.published` / `site.rolled_back`. |
| 12 | Domains & SSL | `POST /api/sites/:id/domains { hostname }` returns the CNAME (or A) + TXT records. `POST …/domains/:id/verify` checks DNS, then the certificate manager runs the ACME HTTP-01 flow (challenge served by the edge at `/.well-known/acme-challenge/`) and records the certificate; the edge routes the `Host` header to the site's live deployment. |

## API reference

All endpoints return JSON. `:site` is the document id (one site per document).

```
GET    /api/health
GET    /api/fonts

GET    /api/documents
POST   /api/documents                      { name, template: 'demo' | 'blank' }
GET    /api/documents/:site
POST   /api/documents/:site/ops            { ops: Op[], clientId }  -> { version }
GET    /api/documents/:site/events?since=N SSE stream of { version, ops, clientId }

GET    /api/sites/:site/collections
POST   /api/sites/:site/collections        { name, slug?, fields?: Field[] }
GET    /api/sites/:site/collections/:cid
PATCH  /api/sites/:site/collections/:cid   { name?, slug?, fields? }
DELETE /api/sites/:site/collections/:cid
GET    /api/sites/:site/collections/:cid/items
POST   /api/sites/:site/collections/:cid/items        { values }
GET    /api/sites/:site/collections/:cid/items/:item
PATCH  /api/sites/:site/collections/:cid/items/:item  { values }
DELETE /api/sites/:site/collections/:cid/items/:item

GET    /api/sites/:site                    live deployment, domains, webhooks
POST   /api/sites/:site/publish            { mode: 'preview' | 'production' } -> { deploymentId }
GET    /api/sites/:site/deployments
GET    /api/deployments/:id
POST   /api/sites/:site/live               { deploymentId }   (rollback / promote)
POST   /api/sites/:site/webhooks           { url, events? }
DELETE /api/sites/:site/webhooks/:id

GET    /api/sites/:site/domains
POST   /api/sites/:site/domains            { hostname } -> DNS records to add
GET    /api/sites/:site/domains/:id        verification + certificate status
POST   /api/sites/:site/domains/:id/verify
DELETE /api/sites/:site/domains/:id
```

Edge routes: `/sites/:site/*` (live), `/preview/:deploymentId/*` (preview, `noindex`,
`no-store`), and any request whose `Host` is an active custom domain.

The op vocabulary (`packages/core/src/ops.ts`): `createNode`, `updateNode`,
`deleteNode`, `moveNode`, `setText`, `bindProp`, `createPage`, `updatePage`,
`deletePage`, `createComponent`, `createInstance`, `setOverride`,
`detachInstance`, `setFonts`, `renameDocument`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port. |
| `STUDIO_DATA` | `apps/server/data` | Where documents, CMS, deployments, domains live. |
| `STUDIO_PUBLIC_URL` | `http://localhost:PORT` | Used for canonical URLs and the sitemap when a site has no custom domain. |
| `STUDIO_EDGE_HOST` | `edge.pocketstudio.local` | The CNAME target handed to users. Set it to your edge's public hostname. |
| `STUDIO_DNS` | `fake` | `fake` auto-verifies domains (local development). `system` performs real DNS lookups. |

## Deploying

```bash
docker build -t pocket-studio .
docker run -p 8787:8787 -v studio-data:/data -e STUDIO_DNS=system \
  -e STUDIO_PUBLIC_URL=https://studio.example.com -e STUDIO_EDGE_HOST=edge.example.com pocket-studio
```

Put it behind a TLS-terminating proxy (Caddy, Cloudflare, a load balancer) that
forwards the `Host` header, and point `edge.example.com` at it. The PWA
install prompt only appears over HTTPS.

Two things are deliberately pluggable rather than wired to a vendor:

- **Certificates.** `CertificateManager` runs the ACME steps against a
  `CertificateAuthority` interface. The shipped CA records a self-signed-style
  certificate so the flow works locally; swap in an `acme-client` based CA to
  issue real Let's Encrypt certificates, and terminate TLS at the proxy with the
  issued files.
- **CMS storage.** The file-backed `CmsStore` matches `sql/cms.sql`
  table-for-table; implement the same class against Postgres to scale.

## Notes and limitations

- A production build is served at `/sites/<id>/` until a custom domain is
  verified; after verifying, publish again so links are built for the root.
  Preview builds are always built for their `/preview/<id>/` URL.
- Live sync is last-writer-wins per op; it is not a CRDT. Ops that the server
  rejects are dropped and the client resyncs.
- Inline images in CMS items are stored as data URLs (kept under 800 KB by the
  UI). Hook `image` fields to object storage for larger media.
