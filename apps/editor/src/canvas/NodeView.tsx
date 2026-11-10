import { memo, type CSSProperties } from 'react';
import {
  CmsIndex,
  compileStyle,
  renderProps,
  resolveBinding,
  richToHtml,
  styleToReact,
  type BreakpointId,
  type Item,
  type Layout,
  type RenderNode,
} from '@studio/core';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderCtx {
  index: CmsIndex;
  item?: Item;
  selection: string | null;
  /** Visible area in artboard coordinates, for culling off-screen absolute nodes. */
  visible: Rect | null;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Sample item for a binding outside a repeater/template: the collection's first item. */
function sampleItem(ctx: RenderCtx, collection: string): Item | undefined {
  return ctx.item ?? ctx.index.itemsOf(collection)[0];
}

interface Props {
  node: RenderNode;
  bp: BreakpointId;
  parentLayout: Layout | undefined;
  ctx: RenderCtx;
  origin: { x: number; y: number };
}

export const NodeView = memo(function NodeView({ node, bp, parentLayout, ctx, origin }: Props) {
  const props = renderProps(node, bp);
  if (props.visible === false) return null;

  // Virtualisation: skip absolutely positioned nodes that are fully off-screen.
  const free = !parentLayout || parentLayout.type === 'none';
  const absX = origin.x + (props.x ?? 0);
  const absY = origin.y + (props.y ?? 0);
  if (ctx.visible && free && typeof props.width === 'number' && typeof props.height === 'number' && (props.x !== undefined || props.y !== undefined)) {
    if (!intersects(ctx.visible, { x: absX, y: absY, w: props.width, h: props.height })) return null;
  }

  const style = styleToReact(compileStyle(props, node.type, parentLayout)) as CSSProperties;
  const selected = ctx.selection === node.key;
  const className = `nd${selected ? ' sel' : ''}${node.instanceId ? ' inst' : ''}`;
  const childOrigin = { x: absX, y: absY };
  const common = { 'data-select': node.selectId, 'data-key': node.key, className, style } as const;

  if (node.type === 'text') {
    const b = node.bindings?.text;
    let html: string;
    if (b) {
      const item = sampleItem(ctx, b.collection);
      html = resolveBinding(ctx.index, b, item, 'html') ?? richToHtml({ blocks: [{ type: node.props.text?.blocks[0]?.type ?? 'paragraph', level: node.props.text?.blocks[0]?.level, spans: [{ text: resolveBinding(ctx.index, b, item, 'text') ?? `{${b.collection}.${b.field}}` }] }] });
    } else {
      html = richToHtml(props.text) || '<p>&nbsp;</p>';
    }
    return <div {...common} className={`${className} txt`} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (node.type === 'image') {
    const b = node.bindings?.src;
    const src = (b ? resolveBinding(ctx.index, b, sampleItem(ctx, b.collection), 'url') : undefined) ?? props.src;
    if (!src) return <div {...common} className={`${className} img-empty`} />;
    return <img {...common} src={src} alt={props.alt ?? ''} draggable={false} />;
  }

  const layout = props.layout;
  let children: React.ReactNode;
  if (props.repeat) {
    const items = ctx.index.itemsOf(props.repeat.collection).slice(0, props.repeat.limit ?? Infinity);
    const list = items.length ? items : [undefined];
    children = list.map((item, i) =>
      node.children.map((c) => <NodeView key={`${c.key}@${item?.id ?? i}`} node={c} bp={bp} parentLayout={layout} ctx={{ ...ctx, item }} origin={childOrigin} />),
    );
  } else {
    children = node.children.map((c) => <NodeView key={c.key} node={c} bp={bp} parentLayout={layout} ctx={ctx} origin={childOrigin} />);
  }
  const Tag = (props.tag ?? 'div') as 'div';
  return (
    <Tag {...common} data-empty={node.children.length === 0 ? '1' : undefined}>
      {children}
    </Tag>
  );
});
