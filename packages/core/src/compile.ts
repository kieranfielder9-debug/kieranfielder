import type { Binding, BreakpointId, CmsSnapshot, Document, Item, NodeProps, Page, RichText } from './types.js';
import { BREAKPOINTS } from './types.js';
import { expandTree, type RenderNode } from './components.js';
import { compileStyle, mediaQueryFor, resolveProps, styleDiff, styleToCss, type StyleMap } from './style.js';
import { escapeAttr, escapeHtml, plainToRich, richToHtml } from './richtext.js';
import { CmsIndex, resolveBinding } from './cms.js';
import { compileFonts, usedFonts } from './fonts.js';

export interface BuildOptions {
  /** Public origin of the site, used for canonical URLs, og:url and the sitemap. */
  baseUrl?: string;
  /** Path prefix when the deployment is served under a sub-path (e.g. `/preview/dep_x`). */
  basePath?: string;
  /** Where self-hosted fonts live. */
  fontCdn?: string;
}

export interface Route {
  path: string;
  pageId: string;
  itemId?: string;
  file: string;
}

export interface BuildResult {
  files: Record<string, string>;
  routes: Route[];
  cssFile: string;
  warnings: string[];
}

export interface RenderContext {
  index: CmsIndex;
  item?: Item;
  warnings: string[];
  basePath?: string;
}

/** Root-relative links get the deployment's base path; everything else is left alone. */
export function href(url: string, ctx: Pick<RenderContext, 'basePath'>): string {
  return ctx.basePath && url.startsWith('/') ? `${ctx.basePath}${url}` : url;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function routeForItem(pattern: string, item: Item | undefined, index: CmsIndex, page: Page): string {
  if (!item) return pattern;
  return pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, param: string) => {
    const collection = index.collection(page.collectionId ?? '');
    const value = collection ? index.fieldValue(collection, item, param)?.value : undefined;
    return encodeURIComponent(typeof value === 'string' ? value : item.id);
  });
}

export function fileForRoute(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean === '' ? '/index.html' : `${clean}/index.html`;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const RESET = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}body{min-height:100vh;-webkit-font-smoothing:antialiased;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}img{max-width:100%}p,h1,h2,h3,h4,ul{margin:0}ul{padding-left:1.25em}a{color:inherit}.studio-text>*+*{margin-top:0.5em}`;

export function className(sourceId: string): string {
  return `n-${sourceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

interface CssCollector {
  base: Map<string, StyleMap>;
  media: Map<BreakpointId, Map<string, StyleMap>>;
}

function collectCss(node: RenderNode, parentLayoutByBp: Record<BreakpointId, NodeProps['layout']>, out: CssCollector) {
  const styles = {} as Record<BreakpointId, StyleMap>;
  const layouts = {} as Record<BreakpointId, NodeProps['layout']>;
  for (const bp of BREAKPOINTS) {
    const props = resolveProps({ props: node.props, overrides: node.overrides }, bp.id);
    styles[bp.id] = compileStyle(props, node.type, parentLayoutByBp[bp.id]);
    layouts[bp.id] = props.layout;
  }
  const cls = className(node.sourceId);
  // Instance children share CSS with their master; overrides apply inline.
  if (!out.base.has(cls)) {
    out.base.set(cls, styles.desktop);
    for (const bp of BREAKPOINTS) {
      if (!bp.maxWidth) continue;
      const prev = bp.id === 'phone' ? styles.tablet : styles.desktop;
      const diff = styleDiff(prev, styles[bp.id]);
      if (Object.keys(diff).length) {
        if (!out.media.has(bp.id)) out.media.set(bp.id, new Map());
        out.media.get(bp.id)!.set(cls, diff);
      }
    }
  }
  for (const child of node.children) collectCss(child, layouts, out);
}

export function compileStylesheet(doc: Document, roots: RenderNode[], fontCdn = ''): { css: string; fontLinks: string[] } {
  const out: CssCollector = { base: new Map(), media: new Map() };
  const noLayout = { desktop: undefined, tablet: undefined, phone: undefined } as Record<BreakpointId, NodeProps['layout']>;
  for (const root of roots) collectCss(root, noLayout, out);

  const families = new Set<string>();
  const walk = (n: RenderNode) => {
    if (n.props.fontFamily) families.add(n.props.fontFamily);
    for (const bp of Object.values(n.overrides)) if (bp?.fontFamily) families.add(bp.fontFamily);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  const fonts = compileFonts(usedFonts(families, doc.fonts), fontCdn);

  const lines: string[] = [RESET];
  if (fonts.css) lines.push(fonts.css);
  for (const [cls, style] of out.base) lines.push(`.${cls}{${styleToCss(style)}}`);
  for (const bp of BREAKPOINTS) {
    const rules = out.media.get(bp.id);
    const mq = mediaQueryFor(bp.id);
    if (!rules || !mq) continue;
    lines.push(`${mq}{`);
    for (const [cls, style] of rules) lines.push(`.${cls}{${styleToCss(style)}}`);
    lines.push('}');
  }
  return { css: lines.join('\n'), fontLinks: fonts.links };
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

/**
 * Instance children share their master's CSS class. Anything an override (or
 * the instance's own size/position) changes is inlined as the style diff.
 */
function inlineOverrideStyle(node: RenderNode, _ctx: RenderContext, props: NodeProps): string {
  if (!node.masterProps) return '';
  const master = compileStyle(resolveProps({ props: node.masterProps, overrides: node.overrides }, 'desktop'), node.type, undefined);
  const mine = compileStyle(resolveProps({ props, overrides: node.overrides }, 'desktop'), node.type, undefined);
  const diff = styleDiff(master, mine);
  return Object.keys(diff).length ? styleToCss(diff) : '';
}

function boundText(node: RenderNode, ctx: RenderContext): { html: string } | null {
  const b = node.bindings?.text;
  if (!b) return null;
  const html = resolveBinding(ctx.index, b, ctx.item, 'html');
  if (html !== undefined) return { html };
  const text = resolveBinding(ctx.index, b, ctx.item, 'text');
  if (text === undefined) {
    if (ctx.item) ctx.warnings.push(`unresolved binding ${b.collection}.${b.field} on ${node.sourceId}`);
    return null;
  }
  const style = node.props.text?.blocks[0];
  return { html: richToHtml(plainToRich(text, style?.type ?? 'paragraph', style?.level)) };
}

function boundValue(node: RenderNode, ctx: RenderContext, prop: 'src' | 'alt' | 'link' | 'fill' | 'color'): string | undefined {
  const b = node.bindings?.[prop];
  if (!b) return undefined;
  return resolveBinding(ctx.index, b, ctx.item, prop === 'src' ? 'url' : 'text');
}

export function renderNodeHtml(node: RenderNode, ctx: RenderContext): string {
  const props = node.props;
  if (props.visible === false) return '';

  if (props.repeat && node.type === 'frame') {
    const items = ctx.index.itemsOf(props.repeat.collection).slice(0, props.repeat.limit ?? Infinity);
    const inner = items
      .map((item) => node.children.map((c) => renderNodeHtml(c, { ...ctx, item })).join(''))
      .join('');
    return wrap(node, ctx, inner, props);
  }

  if (node.type === 'text') {
    const bound = boundText(node, ctx);
    const inner = bound ? bound.html : richToHtml(props.text);
    return wrap(node, ctx, inner, props, 'div');
  }
  if (node.type === 'image') {
    const src = boundValue(node, ctx, 'src') ?? props.src ?? '';
    const alt = boundValue(node, ctx, 'alt') ?? props.alt ?? '';
    const attrs = `class="${className(node.sourceId)}" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy"`;
    const style = inlineOverrideStyle(node, ctx, props);
    const img = `<img ${attrs}${style ? ` style="${escapeAttr(style)}"` : ''}>`;
    const link = boundValue(node, ctx, 'link') ?? props.link;
    return link ? `<a href="${escapeAttr(href(link, ctx))}">${img}</a>` : img;
  }
  const inner = node.children.map((c) => renderNodeHtml(c, ctx)).join('');
  return wrap(node, ctx, inner, props);
}

function wrap(node: RenderNode, ctx: RenderContext, inner: string, props: NodeProps, defaultTag = 'div'): string {
  const link = boundValue(node, ctx, 'link') ?? props.link;
  const tag = link ? 'a' : props.tag ?? defaultTag;
  const classes = [className(node.sourceId)];
  if (node.type === 'text') classes.push('studio-text');
  const fill = boundValue(node, ctx, 'fill');
  const color = boundValue(node, ctx, 'color');
  let style = inlineOverrideStyle(node, ctx, props);
  if (fill) style += `;background:${fill}`;
  if (color) style += `;color:${color}`;
  style = style.replace(/^;/, '');
  const attrs = [`class="${classes.join(' ')}"`];
  if (link) {
    attrs.push(`href="${escapeAttr(href(link, ctx))}"`);
    const compiled = compileStyle(resolveProps({ props, overrides: node.overrides }, 'desktop'), node.type, undefined);
    style = `text-decoration:none${compiled.display ? '' : ';display:block'}${style ? `;${style}` : ''}`;
  }
  if (style) attrs.push(`style="${escapeAttr(style)}"`);
  if (props.name) attrs.push(`data-name="${escapeAttr(props.name)}"`);
  return `<${tag} ${attrs.join(' ')}>${inner}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Pages, SEO, sitemap
// ---------------------------------------------------------------------------

function seoValue(value: string | Binding | undefined, ctx: RenderContext): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return resolveBinding(ctx.index, value, ctx.item, 'text') ?? resolveBinding(ctx.index, value, ctx.item, 'url');
}

function seoUrl(value: string | Binding | undefined, ctx: RenderContext): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return resolveBinding(ctx.index, value, ctx.item, 'url');
}

export function compileHead(doc: Document, page: Page, ctx: RenderContext, url: string, cssHref: string, fontLinks: string[], opts: BuildOptions): string {
  const title = seoValue(page.seo.title, ctx) ?? `${page.name} · ${doc.name}`;
  const description = seoValue(page.seo.description, ctx);
  const ogImage = seoUrl(page.seo.ogImage, ctx);
  const absolute = (u: string) => (opts.baseUrl && u.startsWith('/') ? `${opts.baseUrl}${u}` : u);
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
  ];
  if (description) lines.push(`<meta name="description" content="${escapeAttr(description)}">`);
  if (page.seo.noIndex) lines.push('<meta name="robots" content="noindex">');
  if (opts.baseUrl) lines.push(`<link rel="canonical" href="${escapeAttr(absolute(url))}">`);
  lines.push('<meta property="og:type" content="website">');
  lines.push(`<meta property="og:title" content="${escapeAttr(title)}">`);
  if (description) lines.push(`<meta property="og:description" content="${escapeAttr(description)}">`);
  if (opts.baseUrl) lines.push(`<meta property="og:url" content="${escapeAttr(absolute(url))}">`);
  if (ogImage) {
    lines.push(`<meta property="og:image" content="${escapeAttr(absolute(ogImage))}">`);
    lines.push('<meta name="twitter:card" content="summary_large_image">');
    lines.push(`<meta name="twitter:image" content="${escapeAttr(absolute(ogImage))}">`);
  } else {
    lines.push('<meta name="twitter:card" content="summary">');
  }
  lines.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
  lines.push(...fontLinks);
  lines.push(`<link rel="stylesheet" href="${href(cssHref, ctx)}">`);
  lines.push('<meta name="generator" content="Pocket Studio">');
  return lines.join('\n');
}

export function renderPage(doc: Document, page: Page, ctx: RenderContext, url: string, cssHref: string, fontLinks: string[], opts: BuildOptions): string {
  const root = expandTree(doc, page.rootId);
  const body = root ? renderNodeHtml(root, ctx) : '';
  return `<!doctype html>\n<html lang="en">\n<head>\n${compileHead(doc, page, ctx, url, cssHref, fontLinks, opts)}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

export function compileSitemap(routes: Route[], doc: Document, baseUrl: string): string {
  const urls = routes
    .filter((r) => !doc.pages[r.pageId]?.seo.noIndex)
    .map((r) => `  <url><loc>${escapeHtml(baseUrl + (r.path === '/' ? '/' : r.path))}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * The compiler: document tree + CMS snapshot -> a complete static site.
 * Deterministic: the same inputs always produce the same files.
 */
export function compileSite(doc: Document, cms: CmsSnapshot, opts: BuildOptions = {}): BuildResult {
  const index = new CmsIndex(cms.collections, cms.items);
  const warnings: string[] = [];
  const files: Record<string, string> = {};
  const routes: Route[] = [];

  const roots = doc.pageOrder.map((id) => doc.pages[id]).filter(Boolean).map((p) => expandTree(doc, p.rootId)).filter((r): r is RenderNode => !!r);
  const { css, fontLinks } = compileStylesheet(doc, roots, opts.fontCdn);
  const cssFile = `/assets/site.${hash(css)}.css`;
  files[cssFile] = css;

  for (const pageId of doc.pageOrder) {
    const page = doc.pages[pageId];
    if (!page) continue;
    if (page.collectionId) {
      const collection = index.collection(page.collectionId);
      if (!collection) {
        warnings.push(`page ${page.name}: collection ${page.collectionId} not found`);
        continue;
      }
      const seen = new Set<string>();
      for (const item of index.itemsOf(collection.id)) {
        const ctx: RenderContext = { index, item, warnings, basePath: opts.basePath };
        const path = routeForItem(page.path, item, index, page);
        if (seen.has(path)) {
          warnings.push(`duplicate route ${path} for item ${item.id}`);
          continue;
        }
        seen.add(path);
        const file = fileForRoute(path);
        files[file] = renderPage(doc, page, ctx, path, cssFile, fontLinks, opts);
        routes.push({ path, pageId, itemId: item.id, file });
      }
    } else {
      const ctx: RenderContext = { index, warnings, basePath: opts.basePath };
      const path = page.path || '/';
      const file = fileForRoute(path);
      files[file] = renderPage(doc, page, ctx, path, cssFile, fontLinks, opts);
      routes.push({ path, pageId, file });
    }
  }

  const baseUrl = opts.baseUrl ?? '';
  files['/sitemap.xml'] = compileSitemap(routes, doc, baseUrl);
  files['/robots.txt'] = `User-agent: *\nAllow: /\n${baseUrl ? `Sitemap: ${baseUrl}/sitemap.xml\n` : ''}`;
  files['/_routes.json'] = JSON.stringify(routes, null, 2);
  const bp = opts.basePath ?? '';
  files['/404.html'] = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title><link rel="stylesheet" href="${bp}${cssFile}"></head><body style="display:grid;place-items:center;min-height:100vh;font-family:system-ui"><div><h1>404</h1><p>That page does not exist.</p><a href="${bp}/">Go home</a></div></body></html>`;
  for (const comp of Object.values(doc.components)) files[`/components/${componentFileName(comp.name)}.jsx`] = compileComponentJsx(doc, comp.id);
  return { files, routes, cssFile, warnings };
}

// ---------------------------------------------------------------------------
// Components -> one reusable React component each
// ---------------------------------------------------------------------------

function componentFileName(name: string): string {
  const pascal = name.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : '')).replace(/^[a-z]/, (c) => c.toUpperCase());
  return pascal || 'Component';
}

function jsxStyle(style: StyleMap): string {
  return JSON.stringify(Object.fromEntries(Object.entries(style).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v])));
}

function jsxNode(node: RenderNode, parentLayout: NodeProps['layout'], indent: string, slots: string[]): string {
  const style = compileStyle(node.props, node.type, parentLayout);
  if (node.type === 'text') {
    const slot = `text_${node.sourceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    slots.push(`${slot} = ${JSON.stringify(richToHtml(node.props.text))}`);
    return `${indent}<div style={${jsxStyle(style)}} dangerouslySetInnerHTML={{ __html: props.${slot} ?? ${slot}Default }} />`;
  }
  if (node.type === 'image') {
    return `${indent}<img style={${jsxStyle(style)}} src=${JSON.stringify(node.props.src ?? '')} alt=${JSON.stringify(node.props.alt ?? '')} />`;
  }
  const tag = node.props.tag ?? 'div';
  const children = node.children.map((c) => jsxNode(c, node.props.layout, indent + '  ', slots)).join('\n');
  return `${indent}<${tag} style={${jsxStyle(style)}}>\n${children}\n${indent}</${tag}>`;
}

export function compileComponentJsx(doc: Document, componentId: string): string {
  const comp = doc.components[componentId];
  const root = comp ? expandTree(doc, comp.rootId) : null;
  if (!comp || !root) return '';
  const slots: string[] = [];
  const body = jsxNode(root, undefined, '    ', slots);
  const defaults = slots.map((s) => `const ${s.replace(' = ', 'Default = ')};`).join('\n');
  return `// Generated by Pocket Studio from component "${comp.name}". Text slots can be overridden via props.\n${defaults}\n\nexport default function ${componentFileName(comp.name)}(props = {}) {\n  return (\n${body}\n  );\n}\n`;
}

export function textOf(rt: RichText | undefined): string {
  return rt ? rt.blocks.map((b) => b.spans.map((s) => s.text).join('')).join('\n') : '';
}
