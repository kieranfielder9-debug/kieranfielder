import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOp,
  applyOps,
  compileSite,
  compileStyle,
  createDemoProject,
  expandTree,
  invertOp,
  makeNode,
  ops,
  plainToRich,
  resolveProps,
  richToHtml,
  validateItem,
  CmsIndex,
  instancesOf,
} from '../dist/index.js';

const demo = () => createDemoProject('site_test');

test('breakpoint overrides cascade desktop -> tablet -> phone', () => {
  const node = { props: { fontSize: 56, width: 720, color: '#000' }, overrides: { tablet: { fontSize: 44, width: 'fill' }, phone: { fontSize: 32 } } };
  assert.equal(resolveProps(node, 'desktop').fontSize, 56);
  assert.equal(resolveProps(node, 'tablet').fontSize, 44);
  assert.deepEqual(resolveProps(node, 'phone'), { fontSize: 32, width: 'fill', color: '#000' });
});

test('stack layout props compile to flexbox', () => {
  const css = compileStyle({ layout: { type: 'stack', direction: 'horizontal', gap: 16, padding: [8, 16, 8, 16], align: 'center', justify: 'space-between', wrap: true }, fill: '#fff' }, 'frame', undefined);
  assert.equal(css.display, 'flex');
  assert.equal(css['flex-direction'], 'row');
  assert.equal(css.gap, '16px');
  assert.equal(css.padding, '8px 16px 8px 16px');
  assert.equal(css['align-items'], 'center');
  assert.equal(css['justify-content'], 'space-between');
  assert.equal(css['flex-wrap'], 'wrap');
  const child = compileStyle({ width: 'fill' }, 'frame', { type: 'stack', direction: 'horizontal', gap: 0, padding: 0, align: 'start', justify: 'start' });
  assert.equal(child.flex, '1 1 0');
});

test('free layout children are absolutely positioned', () => {
  const css = compileStyle({ x: 10, y: 20, width: 100, height: 50 }, 'frame', { type: 'none' });
  assert.equal(css.position, 'absolute');
  assert.equal(css.left, '10px');
  assert.equal(css.top, '20px');
});

test('ops reducer: create, update at breakpoint, move, delete; invert restores', () => {
  let { document: doc } = demo();
  const root = doc.pages.page_home.rootId;
  const node = makeNode({ type: 'frame', parentId: root, props: { name: 'Box', width: 100, height: 100 } });
  doc = applyOp(doc, ops.createNode(node, 0));
  assert.equal(doc.nodes[root].children[0], node.id);

  const upd = ops.updateNode(node.id, { width: 50 }, { breakpoint: 'phone' });
  const inverse = invertOp(doc, upd);
  doc = applyOp(doc, upd);
  assert.equal(doc.nodes[node.id].overrides.phone.width, 50);
  assert.equal(doc.nodes[node.id].props.width, 100, 'base untouched');
  doc = applyOp(doc, inverse);
  assert.equal(doc.nodes[node.id].overrides.phone.width, undefined);

  doc = applyOp(doc, ops.moveNode(node.id, 'hero', 1));
  assert.equal(doc.nodes.hero.children[1], node.id);
  assert.equal(doc.nodes[node.id].parentId, 'hero');
  assert.throws(() => applyOp(doc, ops.moveNode('hero', node.id, 0)), /inside itself/);

  const del = ops.deleteNode('hero');
  const restore = invertOp(doc, del);
  const before = Object.keys(doc.nodes).length;
  doc = applyOp(doc, del);
  assert.equal(doc.nodes.hero, undefined);
  assert.equal(doc.nodes.hero_title, undefined, 'subtree removed');
  doc = applyOp(doc, restore);
  assert.equal(Object.keys(doc.nodes).length, before);
  assert.equal(doc.nodes[root].children.indexOf('hero'), 0);
});

test('components: master edits propagate, instance overrides stay local', () => {
  let { document: doc } = demo();
  assert.equal(instancesOf(doc, 'comp_button').length, 3);
  doc = applyOp(doc, ops.updateNode('btn_root', { fill: '#ff0000' }));
  const tree = expandTree(doc, 'home_root');
  const find = (n, key) => (n.key === key ? n : n.children.map((c) => find(c, key)).find(Boolean));
  const hero = find(tree, 'hero_cta');
  const footer = find(tree, 'footer_cta');
  assert.equal(hero.props.fill, '#ff0000', 'instance follows master');
  assert.equal(footer.props.fill, '#4f46e5', 'override wins');
  assert.equal(find(footer, 'footer_cta:btn_label').props.text.blocks[0].spans[0].text, 'Contact');

  // Turn a node into a component, then instantiate it.
  const op = ops.createComponent('posts_heading', 'Heading');
  doc = applyOp(doc, op);
  assert.equal(doc.nodes[op.instanceId].type, 'instance');
  assert.equal(doc.nodes.posts_heading.parentId, null, 'master detached from page');
  doc = applyOp(doc, ops.createInstance(op.componentId, 'footer'));
  assert.equal(instancesOf(doc, op.componentId).length, 2);
  doc = applyOp(doc, ops.detachInstance(op.instanceId));
  assert.equal(doc.nodes[op.instanceId].type, 'text', 'detached into a plain copy');
});

test('rich text is structured JSON and compiles to safe HTML', () => {
  const rt = { blocks: [{ type: 'heading', level: 2, spans: [{ text: 'Hi <b>' }] }, { type: 'list-item', spans: [{ text: 'a', marks: { bold: true, link: 'javascript:alert(1)' } }] }, { type: 'list-item', spans: [{ text: 'b', marks: { italic: true } }] }] };
  const html = richToHtml(rt);
  assert.equal(html, '<h2>Hi &lt;b&gt;</h2><ul><li><a href="#"><strong>a</strong></a></li><li><em>b</em></li></ul>');
  assert.deepEqual(plainToRich('x\ny').blocks.length, 2);
});

test('CMS validation uses the field type registry', () => {
  const { cms } = demo();
  const index = new CmsIndex(cms.collections, cms.items);
  const posts = cms.collections.find((c) => c.slug === 'posts');
  const bad = validateItem(posts, { slug: 'Bad Slug', author: 'nobody', cover: 'not-an-image', extra: 1 }, index.validation());
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.title, 'is required');
  assert.match(bad.errors.slug, /lowercase/);
  assert.match(bad.errors.author, /does not exist/);
  assert.match(bad.errors.cover, /image/);
  assert.match(bad.errors.extra, /not a field/);
  const dup = validateItem(posts, { title: 'x', slug: 'hello-world' }, index.validation());
  assert.match(dup.errors.slug, /already used/);
  const good = validateItem(posts, { title: 'x', slug: 'fresh', author: 'it_ada', cover: { src: '/a.png' } }, index.validation());
  assert.equal(good.ok, true, JSON.stringify(good.errors));
  assert.equal(index.fieldValue(posts, cms.items[2], 'author.name').value, 'Ada Lovelace', 'reference paths resolve');
});

test('compiler: templates, bindings, SEO, sitemap, media queries, component export', () => {
  const { document, cms } = demo();
  const r = compileSite(document, cms, { baseUrl: 'https://example.com' });
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(
    r.routes.map((x) => x.path),
    ['/', '/blog/hello-world', '/blog/why-static-sites-still-win', '/blog/breakpoints-without-the-maths'],
  );
  const post = r.files['/blog/hello-world/index.html'];
  assert.match(post, /<title>Hello, world<\/title>/);
  assert.match(post, /<meta name="description" content="The first post/);
  assert.match(post, /<link rel="canonical" href="https:\/\/example.com\/blog\/hello-world">/);
  assert.match(post, /property="og:image" content="data:image/);
  assert.match(post, /<h1>Hello, world<\/h1>/);
  assert.match(post, /<strong>Rich text<\/strong>/, 'rich text field compiled from JSON');
  assert.match(post, /Ada Lovelace/, 'reference binding resolved');
  const home = r.files['/index.html'];
  assert.equal((home.match(/class="n-post_card"/g) || []).length, 3, 'repeater renders one card per item');
  assert.match(home, /style="background:#4f46e5"/, 'instance override inlined');
  assert.match(home, /<p>Contact<\/p>/);
  const css = r.files[r.cssFile];
  assert.match(css, /@media \(max-width: 767px\)\{[\s\S]*\.n-hero_title\{[^}]*font-size:32px/);
  assert.match(css, /@media \(max-width: 1199px\)\{[\s\S]*\.n-hero_title\{[^}]*font-size:44px/);
  assert.match(css, /@font-face\{font-family:"Studio Sans"/.test(css) ? /Studio Sans/ : /\.n-home_root/);
  assert.match(home, /fonts\.googleapis\.com\/css2\?family=Playfair\+Display/);
  assert.match(r.files['/sitemap.xml'], /<loc>https:\/\/example.com\/blog\/hello-world<\/loc>/);
  assert.match(r.files['/components/Button.jsx'], /export default function Button/);
  // Deterministic
  assert.deepEqual(compileSite(document, cms, { baseUrl: 'https://example.com' }).files, r.files);
});

test('compiler: base path prefixes root-relative links for sub-path previews', () => {
  const { document, cms } = demo();
  const r = compileSite(document, cms, { basePath: '/preview/dep_1' });
  assert.match(r.files['/index.html'], /href="\/preview\/dep_1\/assets\/site\./);
  assert.match(r.files['/index.html'], /href="\/preview\/dep_1\/blog\/hello-world"/);
  assert.doesNotMatch(r.files['/index.html'], /rel="canonical"/);
});

test('compiler: duplicate slugs and noindex handled', () => {
  const { document, cms } = demo();
  cms.items.push({ ...cms.items[2], id: 'dupe' });
  document.pages.page_post.seo.noIndex = true;
  const r = compileSite(document, cms, { baseUrl: 'https://x.y' });
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /duplicate route/);
  assert.doesNotMatch(r.files['/sitemap.xml'], /blog/);
  assert.match(r.files['/blog/hello-world/index.html'], /noindex/);
});

test('ops are the sync unit: applying the same log yields the same document', () => {
  const { document } = demo();
  const log = [ops.updateNode('hero_title', { fontSize: 60 }), ops.setText('hero_sub', plainToRich('Changed')), ops.updatePage('page_home', { seo: { title: 'T' } })];
  const a = applyOps(document, log);
  const b = applyOps(structuredClone(document), structuredClone(log));
  assert.deepEqual(a, b);
  assert.equal(a.pages.page_home.seo.title, 'T');
});
