import type { Block, Mark, RichText, Span } from './types.js';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(input: string): string {
  return escapeHtml(input);
}

export function plainToRich(text: string, type: Block['type'] = 'paragraph', level?: Block['level']): RichText {
  const lines = text.split(/\r?\n/);
  return {
    blocks: lines.map((line) => ({ type, level, spans: [{ text: line }] })),
  };
}

export function richToPlain(rt: RichText | undefined): string {
  if (!rt) return '';
  return rt.blocks.map((b) => b.spans.map((s) => s.text).join('')).join('\n');
}

export function isRichText(value: unknown): value is RichText {
  if (!value || typeof value !== 'object') return false;
  const blocks = (value as RichText).blocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.every(
    (b) => b && typeof b === 'object' && Array.isArray((b as Block).spans) && (b as Block).spans.every((s) => typeof (s as Span).text === 'string'),
  );
}

function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
  return trimmed;
}

export function spanToHtml(span: Span): string {
  let html = escapeHtml(span.text);
  const m: Mark = span.marks ?? {};
  if (m.code) html = `<code>${html}</code>`;
  if (m.bold) html = `<strong>${html}</strong>`;
  if (m.italic) html = `<em>${html}</em>`;
  if (m.underline) html = `<u>${html}</u>`;
  if (m.link) html = `<a href="${escapeAttr(safeHref(m.link))}">${html}</a>`;
  return html;
}

export function blockTag(block: Block): string {
  if (block.type === 'heading') return `h${block.level ?? 2}`;
  if (block.type === 'list-item') return 'li';
  return 'p';
}

/** Compile structured rich text to HTML. Consecutive list items are wrapped in a <ul>. */
export function richToHtml(rt: RichText | undefined): string {
  if (!rt) return '';
  const out: string[] = [];
  let inList = false;
  for (const block of rt.blocks) {
    const isItem = block.type === 'list-item';
    if (isItem && !inList) {
      out.push('<ul>');
      inList = true;
    } else if (!isItem && inList) {
      out.push('</ul>');
      inList = false;
    }
    const tag = blockTag(block);
    const inner = block.spans.map(spanToHtml).join('') || '<br>';
    out.push(`<${tag}>${inner}</${tag}>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

export function emptyRichText(): RichText {
  return { blocks: [{ type: 'paragraph', spans: [{ text: '' }] }] };
}
