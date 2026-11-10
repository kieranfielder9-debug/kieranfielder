import type { BreakpointId, Binding, BindableProp, DocNode, Document, NodeProps, NodeType } from './types.js';
import { resolveProps } from './style.js';

/**
 * A render-ready node: instances expanded into their master subtree with the
 * instance's overrides applied. Both the editor renderer and the static
 * compiler consume this shape, so they can never disagree on what an
 * instance looks like.
 */
export interface RenderNode {
  /** Unique within the rendered tree. For expanded instance children: `${instanceId}:${masterNodeId}`. */
  key: string;
  /** The document node this was rendered from (master node id for instance children). */
  sourceId: string;
  /** Node whose selection should be used in the editor (the instance for expanded children). */
  selectId: string;
  type: Exclude<NodeType, 'instance'>;
  props: NodeProps;
  overrides: DocNode['overrides'];
  bindings?: Partial<Record<BindableProp, Binding>>;
  children: RenderNode[];
  instanceId?: string;
  componentId?: string;
  /** For nodes rendered inside an instance: the master node's untouched props. */
  masterProps?: NodeProps;
}

const MAX_DEPTH = 32;

export function expandTree(doc: Document, rootId: string): RenderNode | null {
  return expand(doc, rootId, null, 0, undefined);
}

function expand(
  doc: Document,
  nodeId: string,
  instanceCtx: { instanceId: string; overrides: Record<string, unknown>; selectId: string } | null,
  depth: number,
  rootPropsFromInstance: Partial<NodeProps> | undefined,
): RenderNode | null {
  const node = doc.nodes[nodeId];
  if (!node || depth > MAX_DEPTH) return null;

  if (node.type === 'instance') {
    const comp = node.componentId ? doc.components[node.componentId] : undefined;
    const master = comp ? doc.nodes[comp.rootId] : undefined;
    if (!comp || !master) {
      return { key: node.id, sourceId: node.id, selectId: node.id, type: 'frame', props: { ...node.props, fill: '#fee', name: 'Missing component' }, overrides: node.overrides, children: [] };
    }
    const ctx = { instanceId: node.id, overrides: node.instanceOverrides ?? {}, selectId: instanceCtx?.selectId ?? node.id };
    const expanded = expand(doc, master.id, ctx, depth + 1, {
      x: node.props.x,
      y: node.props.y,
      width: node.props.width,
      height: node.props.height,
      visible: node.props.visible,
      link: node.props.link,
    });
    if (!expanded) return null;
    return { ...expanded, key: node.id, selectId: ctx.selectId, instanceId: node.id, componentId: comp.id, overrides: mergeOverrides(expanded.overrides, node.overrides) };
  }

  let props: NodeProps = { ...node.props };
  if (instanceCtx) {
    for (const [path, value] of Object.entries(instanceCtx.overrides)) {
      const dot = path.indexOf('.');
      if (path.slice(0, dot) === node.id) (props as Record<string, unknown>)[path.slice(dot + 1)] = value;
    }
  }
  if (rootPropsFromInstance) {
    for (const [k, v] of Object.entries(rootPropsFromInstance)) if (v !== undefined) (props as Record<string, unknown>)[k] = v;
  }
  const key = instanceCtx ? `${instanceCtx.instanceId}:${node.id}` : node.id;
  const children: RenderNode[] = [];
  for (const childId of node.children) {
    const c = expand(doc, childId, instanceCtx, depth + 1, undefined);
    if (c) children.push(c);
  }
  return {
    key,
    sourceId: node.id,
    selectId: instanceCtx ? instanceCtx.selectId : node.id,
    type: node.type,
    props,
    overrides: node.overrides,
    bindings: node.bindings,
    children,
    masterProps: instanceCtx ? node.props : undefined,
  };
}

function mergeOverrides(a: DocNode['overrides'], b: DocNode['overrides']): DocNode['overrides'] {
  const out: DocNode['overrides'] = { ...a };
  for (const bp of Object.keys(b) as BreakpointId[]) out[bp] = { ...(out[bp] ?? {}), ...(b[bp] ?? {}) };
  return out;
}

export function renderProps(node: RenderNode, bp: BreakpointId): NodeProps {
  return resolveProps({ props: node.props, overrides: node.overrides }, bp);
}

/** Lists every document node that is an instance of the component. */
export function instancesOf(doc: Document, componentId: string): DocNode[] {
  return Object.values(doc.nodes).filter((n) => n.type === 'instance' && n.componentId === componentId);
}

/** Master nodes are the roots of component subtrees; they are not part of any page. */
export function isMasterRoot(doc: Document, nodeId: string): boolean {
  return Object.values(doc.components).some((c) => c.rootId === nodeId);
}

/** The page a node belongs to (null for component masters). */
export function pageOfNode(doc: Document, nodeId: string): string | null {
  let cur: string | null = nodeId;
  while (cur) {
    const n: DocNode | undefined = doc.nodes[cur];
    if (!n) return null;
    if (!n.parentId) {
      const page = Object.values(doc.pages).find((p) => p.rootId === cur);
      return page ? page.id : null;
    }
    cur = n.parentId;
  }
  return null;
}
