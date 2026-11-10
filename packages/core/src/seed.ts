import type { Collection, Document, DocNode, Item, Page, CmsSnapshot } from './types.js';
import { plainToRich } from './richtext.js';
import { makeField } from './cms.js';

/**
 * A small demo project exercising every feature: pages, stacks, breakpoint
 * overrides, rich text, a component with two instances, a CMS-bound repeater
 * and a dynamic template page.
 */
export function createDemoProject(siteId = 'site_demo'): { document: Document; cms: CmsSnapshot } {
  const now = '2026-01-01T00:00:00.000Z';
  const nodes: Record<string, DocNode> = {};
  const add = (n: DocNode) => {
    nodes[n.id] = n;
    if (n.parentId) nodes[n.parentId].children.push(n.id);
    return n;
  };
  const frame = (id: string, parentId: string | null, props: DocNode['props'], overrides: DocNode['overrides'] = {}): DocNode =>
    add({ id, type: 'frame', parentId, children: [], props, overrides });
  const text = (id: string, parentId: string, value: string, props: DocNode['props'], overrides: DocNode['overrides'] = {}, blockType: 'paragraph' | 'heading' = 'paragraph', level?: 1 | 2 | 3): DocNode =>
    add({ id, type: 'text', parentId, children: [], props: { ...props, text: plainToRich(value, blockType, level) }, overrides });

  // ---- Button component master (lives outside any page) ----
  frame('btn_root', null, {
    name: 'Button',
    width: 'hug',
    height: 'hug',
    fill: '#111827',
    radius: 999,
    layout: { type: 'stack', direction: 'horizontal', gap: 8, padding: [12, 22, 12, 22], align: 'center', justify: 'center' },
  });
  text('btn_label', 'btn_root', 'Get started', { name: 'Label', color: '#ffffff', fontSize: 15, fontWeight: 600, fontFamily: 'Inter' });

  // ---- Home page ----
  frame('home_root', null, {
    name: 'Home',
    width: 'fill',
    fill: '#fafafa',
    layout: { type: 'stack', direction: 'vertical', gap: 0, padding: 0, align: 'stretch', justify: 'start' },
  });
  frame('hero', 'home_root', {
    name: 'Hero',
    tag: 'section',
    width: 'fill',
    fill: 'linear-gradient(135deg,#eef2ff,#fdf2f8)',
    layout: { type: 'stack', direction: 'vertical', gap: 24, padding: [96, 48, 96, 48], align: 'center', justify: 'center' },
  }, {
    phone: { layout: { type: 'stack', direction: 'vertical', gap: 16, padding: [56, 20, 56, 20], align: 'center', justify: 'center' } },
  });
  text('hero_title', 'hero', 'Design on your phone. Publish anywhere.', { name: 'Title', fontFamily: 'Playfair Display', fontSize: 56, fontWeight: 700, lineHeight: 1.1, textAlign: 'center', color: '#111827', width: 720 }, {
    tablet: { fontSize: 44, width: 'fill' },
    phone: { fontSize: 32 },
  }, 'heading', 1);
  text('hero_sub', 'hero', 'Frames, stacks, breakpoints, components and a CMS, compiled to a static site at the edge.', { name: 'Subtitle', fontFamily: 'Inter', fontSize: 18, lineHeight: 1.5, textAlign: 'center', color: '#4b5563', width: 560 }, { phone: { fontSize: 16, width: 'fill' } });
  add({ id: 'hero_cta', type: 'instance', parentId: 'hero', children: [], props: { name: 'Button', width: 'hug', height: 'hug' }, overrides: {}, componentId: 'comp_button', instanceOverrides: {} });

  frame('posts_section', 'home_root', {
    name: 'Latest posts',
    tag: 'section',
    width: 'fill',
    layout: { type: 'stack', direction: 'vertical', gap: 24, padding: [64, 48, 64, 48], align: 'stretch', justify: 'start' },
  }, { phone: { layout: { type: 'stack', direction: 'vertical', gap: 16, padding: [40, 20, 40, 20], align: 'stretch', justify: 'start' } } });
  text('posts_heading', 'posts_section', 'Latest posts', { name: 'Heading', fontFamily: 'Inter', fontSize: 28, fontWeight: 700, color: '#111827' }, {}, 'heading', 2);
  frame('posts_grid', 'posts_section', {
    name: 'Posts grid',
    width: 'fill',
    repeat: { collection: 'posts', limit: 6 },
    layout: { type: 'stack', direction: 'horizontal', gap: 20, padding: 0, align: 'stretch', justify: 'start', wrap: true },
  }, { phone: { layout: { type: 'stack', direction: 'vertical', gap: 16, padding: 0, align: 'stretch', justify: 'start' } } });
  frame('post_card', 'posts_grid', {
    name: 'Post card',
    width: 360,
    fill: '#ffffff',
    radius: 16,
    clip: true,
    border: '1px solid #e5e7eb',
    layout: { type: 'stack', direction: 'vertical', gap: 12, padding: 0, align: 'stretch', justify: 'start' },
  }, { phone: { width: 'fill' } });
  nodes.post_card.bindings = { link: { collection: 'posts', field: 'url' } };
  add({ id: 'post_cover', type: 'image', parentId: 'post_card', children: [], props: { name: 'Cover', width: 'fill', height: 180, objectFit: 'cover' }, overrides: {}, bindings: { src: { collection: 'posts', field: 'cover' }, alt: { collection: 'posts', field: 'title' } } });
  frame('post_body', 'post_card', { name: 'Body', width: 'fill', layout: { type: 'stack', direction: 'vertical', gap: 8, padding: [4, 20, 20, 20], align: 'start', justify: 'start' } });
  text('post_title', 'post_body', 'Post title', { name: 'Title', fontFamily: 'Inter', fontSize: 20, fontWeight: 600, color: '#111827' }, {}, 'heading', 3);
  nodes.post_title.bindings = { text: { collection: 'posts', field: 'title' } };
  text('post_author', 'post_body', 'Author', { name: 'Author', fontFamily: 'Inter', fontSize: 14, color: '#6b7280' });
  nodes.post_author.bindings = { text: { collection: 'posts', field: 'author.name' } };

  frame('footer', 'home_root', { name: 'Footer', tag: 'footer', width: 'fill', fill: '#111827', layout: { type: 'stack', direction: 'horizontal', gap: 16, padding: [32, 48, 32, 48], align: 'center', justify: 'space-between' } }, {
    phone: { layout: { type: 'stack', direction: 'vertical', gap: 12, padding: [24, 20, 24, 20], align: 'start', justify: 'start' } },
  });
  text('footer_text', 'footer', 'Built with Pocket Studio', { name: 'Credit', fontFamily: 'Inter', fontSize: 14, color: '#9ca3af' });
  add({ id: 'footer_cta', type: 'instance', parentId: 'footer', children: [], props: { name: 'Button', width: 'hug', height: 'hug' }, overrides: {}, componentId: 'comp_button', instanceOverrides: { 'btn_label.text': plainToRich('Contact'), 'btn_root.fill': '#4f46e5' } });

  // ---- Blog post template page ----
  frame('post_root', null, { name: 'Post', width: 'fill', fill: '#ffffff', layout: { type: 'stack', direction: 'vertical', gap: 0, padding: 0, align: 'stretch', justify: 'start' } });
  frame('post_header', 'post_root', { name: 'Header', tag: 'header', width: 'fill', layout: { type: 'stack', direction: 'vertical', gap: 16, padding: [64, 48, 32, 48], align: 'center', justify: 'start' } }, {
    phone: { layout: { type: 'stack', direction: 'vertical', gap: 12, padding: [40, 20, 24, 20], align: 'start', justify: 'start' } },
  });
  text('tpl_title', 'post_header', 'Post title', { name: 'Title', fontFamily: 'Playfair Display', fontSize: 44, fontWeight: 700, lineHeight: 1.15, textAlign: 'center', color: '#111827', width: 720 }, { phone: { fontSize: 30, textAlign: 'left', width: 'fill' } }, 'heading', 1);
  nodes.tpl_title.bindings = { text: { collection: 'posts', field: 'title' } };
  text('tpl_meta', 'post_header', 'Author · Date', { name: 'Meta', fontFamily: 'Inter', fontSize: 14, color: '#6b7280' });
  nodes.tpl_meta.bindings = { text: { collection: 'posts', field: 'author.name' } };
  add({ id: 'tpl_cover', type: 'image', parentId: 'post_root', children: [], props: { name: 'Cover', width: 'fill', height: 420, objectFit: 'cover' }, overrides: { phone: { height: 220 } }, bindings: { src: { collection: 'posts', field: 'cover' }, alt: { collection: 'posts', field: 'title' } } });
  frame('tpl_body_wrap', 'post_root', { name: 'Body', tag: 'article', width: 'fill', layout: { type: 'stack', direction: 'vertical', gap: 16, padding: [48, 48, 96, 48], align: 'center', justify: 'start' } }, { phone: { layout: { type: 'stack', direction: 'vertical', gap: 12, padding: [24, 20, 64, 20], align: 'stretch', justify: 'start' } } });
  text('tpl_body', 'tpl_body_wrap', 'Body', { name: 'Body text', fontFamily: 'Lora', fontSize: 19, lineHeight: 1.7, color: '#1f2937', width: 680 }, { phone: { fontSize: 17, width: 'fill' } });
  nodes.tpl_body.bindings = { text: { collection: 'posts', field: 'body' } };
  add({ id: 'tpl_back', type: 'instance', parentId: 'tpl_body_wrap', children: [], props: { name: 'Button', width: 'hug', height: 'hug', link: '/' }, overrides: {}, componentId: 'comp_button', instanceOverrides: { 'btn_label.text': plainToRich('Back home') } });

  const pages: Record<string, Page> = {
    page_home: { id: 'page_home', name: 'Home', path: '/', rootId: 'home_root', seo: { title: 'Pocket Studio demo', description: 'A site built on a phone with Pocket Studio.' } },
    page_post: {
      id: 'page_post',
      name: 'Post',
      path: '/blog/:slug',
      rootId: 'post_root',
      collectionId: 'col_posts',
      seo: { title: { collection: 'posts', field: 'title' }, description: { collection: 'posts', field: 'excerpt' }, ogImage: { collection: 'posts', field: 'cover' } },
    },
  };

  const document: Document = {
    id: siteId,
    name: 'My first site',
    version: 0,
    nodes,
    pages,
    pageOrder: ['page_home', 'page_post'],
    components: { comp_button: { id: 'comp_button', name: 'Button', rootId: 'btn_root' } },
    fonts: [],
  };

  const authors: Collection = {
    id: 'col_authors',
    name: 'Authors',
    slug: 'authors',
    createdAt: now,
    updatedAt: now,
    fields: [makeField({ id: 'f_name', name: 'Name', type: 'text', required: true }), makeField({ id: 'f_role', name: 'Role', type: 'text' })],
  };
  const posts: Collection = {
    id: 'col_posts',
    name: 'Posts',
    slug: 'posts',
    createdAt: now,
    updatedAt: now,
    fields: [
      makeField({ id: 'f_title', name: 'Title', type: 'text', required: true }),
      makeField({ id: 'f_slug', name: 'Slug', type: 'slug', required: true }),
      makeField({ id: 'f_url', name: 'URL', type: 'text' }),
      makeField({ id: 'f_excerpt', name: 'Excerpt', type: 'text' }),
      makeField({ id: 'f_body', name: 'Body', type: 'richText' }),
      makeField({ id: 'f_cover', name: 'Cover', type: 'image' }),
      makeField({ id: 'f_date', name: 'Date', type: 'date' }),
      makeField({ id: 'f_author', name: 'Author', type: 'reference', referenceCollectionId: 'col_authors' }),
      makeField({ id: 'f_featured', name: 'Featured', type: 'boolean' }),
    ],
  };
  const items: Item[] = [
    { id: 'it_ada', collectionId: 'col_authors', createdAt: now, updatedAt: now, values: { name: 'Ada Lovelace', role: 'Editor' } },
    { id: 'it_grace', collectionId: 'col_authors', createdAt: now, updatedAt: now, values: { name: 'Grace Hopper', role: 'Writer' } },
    post('it_p1', 'Hello, world', 'hello-world', 'it_ada', 'The first post on a site built entirely from a phone.', '2026-01-02T00:00:00.000Z'),
    post('it_p2', 'Why static sites still win', 'why-static-sites-still-win', 'it_grace', 'Immutable deployments make rollbacks a pointer swap.', '2026-01-03T00:00:00.000Z'),
    post('it_p3', 'Breakpoints without the maths', 'breakpoints-without-the-maths', 'it_ada', 'Overrides cascade; Flexbox does the rest.', '2026-01-04T00:00:00.000Z'),
  ];
  return { document, cms: { collections: [authors, posts], items } };
}

function post(id: string, title: string, slug: string, author: string, excerpt: string, createdAt: string): Item {
  const hue = (slug.length * 37) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},80%,70%)'/><stop offset='1' stop-color='hsl(${(hue + 60) % 360},80%,55%)'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/></svg>`;
  return {
    id,
    collectionId: 'col_posts',
    createdAt,
    updatedAt: createdAt,
    values: {
      title,
      slug,
      url: `/blog/${slug}`,
      excerpt,
      body: {
        blocks: [
          { type: 'paragraph', spans: [{ text: excerpt + ' ' }, { text: 'Rich text', marks: { bold: true } }, { text: ' is stored as structured JSON with ' }, { text: 'marks', marks: { italic: true } }, { text: ', never as raw HTML.' }] },
          { type: 'heading', level: 2, spans: [{ text: 'How it works' }] },
          { type: 'list-item', spans: [{ text: 'The document store holds the node tree and syncs it live.' }] },
          { type: 'list-item', spans: [{ text: 'The compiler turns tree + CMS into a static site.' }] },
          { type: 'list-item', spans: [{ text: 'The edge hosts it, with domains, certificates and a cache.' }] },
        ],
      },
      cover: { src: `data:image/svg+xml;utf8,${svg}`, alt: title },
      date: createdAt.slice(0, 10),
      author,
      featured: id === 'it_p1',
    },
  };
}
