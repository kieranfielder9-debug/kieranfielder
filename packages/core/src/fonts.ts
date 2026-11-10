import type { FontRef } from './types.js';

export type FontProvider = 'system' | 'google' | 'self';

export interface FontDef {
  family: string;
  category: 'sans-serif' | 'serif' | 'monospace' | 'display';
  provider: FontProvider;
  weights: number[];
  /** Self-hosted fonts: weight -> URL on the platform CDN. */
  files?: Record<number, string>;
}

/**
 * The font catalog served by `GET /fonts`. Self-hosted entries are compiled to
 * `@font-face` rules; Google entries to a stylesheet link (which is itself a
 * set of `@font-face` rules served by their CDN); system fonts need nothing.
 */
export const FONT_CATALOG: FontDef[] = [
  { family: 'System', category: 'sans-serif', provider: 'system', weights: [400, 500, 600, 700] },
  { family: 'Inter', category: 'sans-serif', provider: 'google', weights: [400, 500, 600, 700, 800] },
  { family: 'Space Grotesk', category: 'sans-serif', provider: 'google', weights: [400, 500, 600, 700] },
  { family: 'Playfair Display', category: 'serif', provider: 'google', weights: [400, 600, 700, 800] },
  { family: 'Lora', category: 'serif', provider: 'google', weights: [400, 500, 600, 700] },
  { family: 'JetBrains Mono', category: 'monospace', provider: 'google', weights: [400, 500, 700] },
  {
    family: 'Studio Sans',
    category: 'sans-serif',
    provider: 'self',
    weights: [400, 700],
    files: { 400: '/fonts/studio-sans-400.woff2', 700: '/fonts/studio-sans-700.woff2' },
  },
];

const GENERIC: Record<FontDef['category'], string> = {
  'sans-serif': 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  display: 'system-ui, sans-serif',
};

export function findFont(family: string | undefined): FontDef | undefined {
  if (!family) return undefined;
  return FONT_CATALOG.find((f) => f.family === family);
}

export function fontStack(family: string | undefined): string {
  const def = findFont(family);
  if (!def || def.provider === 'system') return GENERIC['sans-serif'];
  return `"${def.family}", ${GENERIC[def.category]}`;
}

/** Collect the fonts a document actually uses. */
export function usedFonts(families: Iterable<string>, fonts: FontRef[] = []): FontRef[] {
  const map = new Map<string, Set<number>>();
  for (const f of fonts) map.set(f.family, new Set(f.weights));
  for (const fam of families) {
    const def = findFont(fam);
    if (!def || def.provider === 'system') continue;
    if (!map.has(fam)) map.set(fam, new Set(def.weights));
  }
  return [...map.entries()].map(([family, weights]) => ({ family, weights: [...weights].sort((a, b) => a - b) }));
}

/** Returns `<link>` tags for CDN-provided fonts and `@font-face` CSS for self-hosted ones. */
export function compileFonts(fonts: FontRef[], cdnBase = ''): { links: string[]; css: string } {
  const links: string[] = [];
  const css: string[] = [];
  const googleFamilies: string[] = [];
  for (const ref of fonts) {
    const def = findFont(ref.family);
    if (!def || def.provider === 'system') continue;
    if (def.provider === 'google') {
      const weights = ref.weights.length ? ref.weights : def.weights;
      googleFamilies.push(`family=${encodeURIComponent(def.family).replace(/%20/g, '+')}:wght@${weights.join(';')}`);
    } else if (def.provider === 'self' && def.files) {
      for (const [weight, url] of Object.entries(def.files)) {
        css.push(
          `@font-face{font-family:"${def.family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${cdnBase}${url}") format("woff2");}`,
        );
      }
    }
  }
  if (googleFamilies.length) {
    links.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    links.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    links.push(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${googleFamilies.join('&')}&display=swap">`);
  }
  return { links, css: css.join('\n') };
}
