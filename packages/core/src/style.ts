import { BREAKPOINTS, type BreakpointId, type DocNode, type Layout, type NodeProps, type Size } from './types.js';
import { fontStack } from './fonts.js';

/** Cascade order: desktop is the base, tablet overrides it, phone overrides both. */
export function cascadeChain(bp: BreakpointId): BreakpointId[] {
  switch (bp) {
    case 'desktop':
      return [];
    case 'tablet':
      return ['tablet'];
    case 'phone':
      return ['tablet', 'phone'];
  }
}

/** Props as seen at a breakpoint: base props plus cascaded overrides. */
export function resolveProps(node: Pick<DocNode, 'props' | 'overrides'>, bp: BreakpointId = 'desktop'): NodeProps {
  let out: NodeProps = { ...node.props };
  for (const id of cascadeChain(bp)) {
    const o = node.overrides?.[id];
    if (o) out = { ...out, ...o };
  }
  return out;
}

export type StyleMap = Record<string, string>;

function px(v: number | undefined): string | undefined {
  return v === undefined ? undefined : `${v}px`;
}

function size(v: Size | undefined, axis: 'w' | 'h'): string | undefined {
  if (v === undefined) return undefined;
  if (v === 'fill') return axis === 'w' ? '100%' : '100%';
  if (v === 'hug') return 'auto';
  return `${v}px`;
}

function padding(p: Layout['padding']): string | undefined {
  if (p === undefined) return undefined;
  if (typeof p === 'number') return `${p}px`;
  return p.map((n) => `${n}px`).join(' ');
}

const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

/**
 * The style compiler: node props -> CSS declarations. Stacks map straight onto
 * Flexbox so the browser does the layout maths in the editor and on the site.
 */
export function compileStyle(
  props: NodeProps,
  type: DocNode['type'],
  parentLayout: Layout | undefined,
): StyleMap {
  const s: StyleMap = {};
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== '') s[k] = v;
  };

  const inStack = parentLayout?.type === 'stack';
  if (!inStack && (props.x !== undefined || props.y !== undefined)) {
    set('position', 'absolute');
    set('left', px(props.x ?? 0));
    set('top', px(props.y ?? 0));
  }
  if (props.width === 'fill' && inStack && parentLayout?.direction === 'horizontal') {
    set('flex', '1 1 0');
    set('min-width', '0');
  } else {
    set('width', size(props.width, 'w'));
  }
  if (props.height === 'fill' && inStack && parentLayout?.direction === 'vertical') {
    set('flex', '1 1 0');
    set('min-height', '0');
  } else {
    set('height', size(props.height, 'h'));
  }
  if (inStack && parentLayout?.align === 'stretch' && parentLayout.direction === 'vertical' && props.width === 'fill') {
    set('align-self', 'stretch');
    delete s.width;
  }
  set('min-height', px(props.minHeight));
  set('background', props.fill);
  set('color', props.color);
  set('border-radius', px(props.radius));
  set('opacity', props.opacity === undefined ? undefined : String(props.opacity));
  set('border', props.border);
  set('box-shadow', props.shadow);
  if (props.clip) set('overflow', 'hidden');
  if (props.visible === false) set('display', 'none');

  const layout = props.layout;
  if (layout?.type === 'stack') {
    set('display', props.visible === false ? 'none' : 'flex');
    set('flex-direction', layout.direction === 'horizontal' ? 'row' : 'column');
    set('gap', px(layout.gap));
    set('padding', padding(layout.padding));
    set('align-items', ALIGN[layout.align] ?? 'flex-start');
    set('justify-content', JUSTIFY[layout.justify] ?? 'flex-start');
    if (layout.wrap) set('flex-wrap', 'wrap');
  } else if (type === 'frame') {
    set('position', s.position ?? 'relative');
    set('padding', padding(layout?.padding));
  }

  if (type === 'text') {
    set('font-family', props.fontFamily ? fontStack(props.fontFamily) : undefined);
    set('font-size', px(props.fontSize));
    set('font-weight', props.fontWeight === undefined ? undefined : String(props.fontWeight));
    set('line-height', props.lineHeight === undefined ? undefined : String(props.lineHeight));
    set('letter-spacing', props.letterSpacing === undefined ? undefined : `${props.letterSpacing}em`);
    set('text-align', props.textAlign);
  }
  if (type === 'image') {
    set('object-fit', props.objectFit ?? 'cover');
    set('display', 'block');
  }
  return s;
}

export function styleToCss(style: StyleMap): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/** camelCase keys for React `style` objects. */
export function styleToReact(style: StyleMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(style)) {
    out[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out;
}

/** Only the declarations that differ between two compiled styles (for media queries). */
export function styleDiff(base: StyleMap, next: StyleMap): StyleMap {
  const diff: StyleMap = {};
  for (const [k, v] of Object.entries(next)) if (base[k] !== v) diff[k] = v;
  for (const k of Object.keys(base)) if (!(k in next)) diff[k] = k === 'display' ? 'block' : 'unset';
  return diff;
}

export function mediaQueryFor(bp: BreakpointId): string | null {
  const def = BREAKPOINTS.find((b) => b.id === bp);
  if (!def || def.maxWidth === undefined) return null;
  return `@media (max-width: ${def.maxWidth}px)`;
}
