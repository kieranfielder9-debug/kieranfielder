import type { Binding, BindableProp, BreakpointId, DocNode, Document, NodeProps, Page, RichText, FontRef } from './types.js';
import { newId } from './ids.js';

/**
 * Every change to a document is an Op. The same reducer runs in the editor
 * (optimistically) and in the document store (authoritatively), and ops are
 * what the live-sync channel carries between them.
 */
export type Op =
  | { type: 'createNode'; node: DocNode; index?: number }
  | { type: 'updateNode'; id: string; props: Partial<NodeProps>; breakpoint?: BreakpointId }
  | { type: 'deleteNode'; id: string }
  | { type: 'moveNode'; id: string; parentId: string; index: number }
  | { type: 'setText'; id: string; text: RichText }
  | { type: 'bindProp'; id: string; prop: BindableProp; binding: Binding | null }
  | { type: 'createPage'; page: Page; index?: number }
  | { type: 'updatePage'; id: string; patch: Partial<Omit<Page, 'id' | 'rootId'>> }
  | { type: 'deletePage'; id: string }
  | { type: 'createComponent'; nodeId: string; componentId: string; instanceId: string; name: string }
  | { type: 'createInstance'; componentId: string; parentId: string; instanceId: string; index?: number; props?: Partial<NodeProps> }
  | { type: 'setOverride'; instanceId: string; path: string; value: unknown }
  | { type: 'detachInstance'; instanceId: string }
  | { type: 'setFonts'; fonts: FontRef[] }
  | { type: 'renameDocument'; name: string }
  | { type: 'restoreSubtree'; nodes: DocNode[]; parentId: string | null; index: number };

export class OpError extends Error {}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function subtreeIds(doc: Document, rootId: string): string[] {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const n = doc.nodes[id];
    if (!n) continue;
    out.push(id);
    stack.push(...n.children);
  }
  return out;
}

export function isAncestor(doc: Document, maybeAncestor: string, nodeId: string): boolean {
  let cur: string | null = nodeId;
  while (cur) {
    if (cur === maybeAncestor) return true;
    cur = doc.nodes[cur]?.parentId ?? null;
  }
  return false;
}

function insertChild(parent: DocNode, childId: string, index: number | undefined): DocNode {
  const children = parent.children.filter((c) => c !== childId);
  const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
  children.splice(at, 0, childId);
  return { ...parent, children };
}

/** Pure reducer. Returns a new document; the input is never mutated. */
export function applyOp(doc: Document, op: Op): Document {
  const nodes = { ...doc.nodes };
  const next: Document = { ...doc, nodes };
  switch (op.type) {
    case 'createNode': {
      if (nodes[op.node.id]) throw new OpError(`node ${op.node.id} already exists`);
      const node: DocNode = { ...clone(op.node), children: op.node.children ?? [], overrides: op.node.overrides ?? {} };
      nodes[node.id] = node;
      if (node.parentId) {
        const parent = nodes[node.parentId];
        if (!parent) throw new OpError(`parent ${node.parentId} not found`);
        nodes[parent.id] = insertChild(parent, node.id, op.index);
      }
      return next;
    }
    case 'updateNode': {
      const n = nodes[op.id];
      if (!n) throw new OpError(`node ${op.id} not found`);
      if (op.breakpoint && op.breakpoint !== 'desktop') {
        const existing = n.overrides[op.breakpoint] ?? {};
        const merged: Partial<NodeProps> = { ...existing, ...clone(op.props) };
        for (const [k, v] of Object.entries(op.props)) if (v === undefined) delete (merged as Record<string, unknown>)[k];
        nodes[op.id] = { ...n, overrides: { ...n.overrides, [op.breakpoint]: merged } };
      } else {
        const props: NodeProps = { ...n.props, ...clone(op.props) };
        for (const [k, v] of Object.entries(op.props)) if (v === undefined) delete (props as Record<string, unknown>)[k];
        nodes[op.id] = { ...n, props };
      }
      return next;
    }
    case 'deleteNode': {
      const n = nodes[op.id];
      if (!n) return doc;
      for (const id of subtreeIds(doc, op.id)) delete nodes[id];
      if (n.parentId && nodes[n.parentId]) {
        const p = nodes[n.parentId];
        nodes[p.id] = { ...p, children: p.children.filter((c) => c !== op.id) };
      }
      return next;
    }
    case 'moveNode': {
      const n = nodes[op.id];
      const target = nodes[op.parentId];
      if (!n || !target) throw new OpError('move: node or parent not found');
      if (isAncestor(doc, op.id, op.parentId)) throw new OpError('cannot move a node inside itself');
      if (n.parentId && nodes[n.parentId]) {
        const p = nodes[n.parentId];
        nodes[p.id] = { ...p, children: p.children.filter((c) => c !== op.id) };
      }
      nodes[target.id] = insertChild(nodes[target.id], op.id, op.index);
      nodes[op.id] = { ...n, parentId: op.parentId };
      return next;
    }
    case 'setText': {
      const n = nodes[op.id];
      if (!n) throw new OpError(`node ${op.id} not found`);
      nodes[op.id] = { ...n, props: { ...n.props, text: clone(op.text) } };
      return next;
    }
    case 'bindProp': {
      const n = nodes[op.id];
      if (!n) throw new OpError(`node ${op.id} not found`);
      const bindings = { ...(n.bindings ?? {}) };
      if (op.binding) bindings[op.prop] = clone(op.binding);
      else delete bindings[op.prop];
      nodes[op.id] = { ...n, bindings };
      return next;
    }
    case 'createPage': {
      const page = clone(op.page);
      if (!nodes[page.rootId]) {
        nodes[page.rootId] = {
          id: page.rootId,
          type: 'frame',
          parentId: null,
          children: [],
          props: { name: page.name, width: 'fill', fill: '#ffffff', layout: { type: 'stack', direction: 'vertical', gap: 0, padding: 0, align: 'stretch', justify: 'start' } },
          overrides: {},
        };
      }
      const pageOrder = [...doc.pageOrder.filter((p) => p !== page.id)];
      pageOrder.splice(op.index ?? pageOrder.length, 0, page.id);
      return { ...next, pages: { ...doc.pages, [page.id]: page }, pageOrder };
    }
    case 'updatePage': {
      const p = doc.pages[op.id];
      if (!p) throw new OpError(`page ${op.id} not found`);
      return { ...next, pages: { ...doc.pages, [op.id]: { ...p, ...clone(op.patch), id: p.id, rootId: p.rootId } } };
    }
    case 'deletePage': {
      const p = doc.pages[op.id];
      if (!p) return doc;
      const pages = { ...doc.pages };
      delete pages[op.id];
      for (const id of subtreeIds(doc, p.rootId)) delete nodes[id];
      return { ...next, pages, pageOrder: doc.pageOrder.filter((x) => x !== op.id) };
    }
    case 'createComponent': {
      const master = nodes[op.nodeId];
      if (!master) throw new OpError(`node ${op.nodeId} not found`);
      if (master.type === 'instance') throw new OpError('cannot turn an instance into a component');
      const parentId = master.parentId;
      const index = parentId ? nodes[parentId].children.indexOf(op.nodeId) : 0;
      // Detach the master subtree from the page tree; it now lives in the registry.
      nodes[op.nodeId] = { ...master, parentId: null, props: { ...master.props, x: undefined, y: undefined } };
      const instance: DocNode = {
        id: op.instanceId,
        type: 'instance',
        parentId,
        children: [],
        props: { name: op.name, x: master.props.x, y: master.props.y, width: master.props.width, height: master.props.height },
        overrides: {},
        componentId: op.componentId,
        instanceOverrides: {},
      };
      nodes[instance.id] = instance;
      if (parentId) {
        const p = nodes[parentId];
        const children = p.children.filter((c) => c !== op.nodeId);
        children.splice(index, 0, instance.id);
        nodes[parentId] = { ...p, children };
      }
      return { ...next, components: { ...doc.components, [op.componentId]: { id: op.componentId, name: op.name, rootId: op.nodeId } } };
    }
    case 'createInstance': {
      const comp = doc.components[op.componentId];
      if (!comp) throw new OpError(`component ${op.componentId} not found`);
      const parent = nodes[op.parentId];
      if (!parent) throw new OpError(`parent ${op.parentId} not found`);
      const master = nodes[comp.rootId];
      const instance: DocNode = {
        id: op.instanceId,
        type: 'instance',
        parentId: op.parentId,
        children: [],
        props: { name: comp.name, width: master?.props.width, height: master?.props.height, ...(op.props ?? {}) },
        overrides: {},
        componentId: op.componentId,
        instanceOverrides: {},
      };
      nodes[instance.id] = instance;
      nodes[parent.id] = insertChild(parent, instance.id, op.index);
      return next;
    }
    case 'setOverride': {
      const n = nodes[op.instanceId];
      if (!n || n.type !== 'instance') throw new OpError(`instance ${op.instanceId} not found`);
      const instanceOverrides = { ...(n.instanceOverrides ?? {}) };
      if (op.value === undefined) delete instanceOverrides[op.path];
      else instanceOverrides[op.path] = clone(op.value);
      nodes[op.instanceId] = { ...n, instanceOverrides };
      return next;
    }
    case 'detachInstance': {
      const n = nodes[op.instanceId];
      if (!n || n.type !== 'instance' || !n.componentId) throw new OpError('instance not found');
      const comp = doc.components[n.componentId];
      if (!comp) throw new OpError('component not found');
      // Deep-copy the master into a fresh subtree with new ids, applying overrides.
      const idMap = new Map<string, string>();
      for (const id of subtreeIds(doc, comp.rootId)) idMap.set(id, id === comp.rootId ? n.id : newId());
      for (const id of subtreeIds(doc, comp.rootId)) {
        const src = nodes[id];
        const copy: DocNode = {
          ...clone(src),
          id: idMap.get(id)!,
          parentId: id === comp.rootId ? n.parentId : idMap.get(src.parentId!)!,
          children: src.children.map((c) => idMap.get(c)!),
        };
        for (const [path, value] of Object.entries(n.instanceOverrides ?? {})) {
          const [nodeId, prop] = path.split('.');
          if (nodeId === id) (copy.props as Record<string, unknown>)[prop] = clone(value);
        }
        if (id === comp.rootId) copy.props = { ...copy.props, x: n.props.x, y: n.props.y, width: n.props.width ?? copy.props.width, height: n.props.height ?? copy.props.height };
        nodes[copy.id] = copy;
      }
      return next;
    }
    case 'setFonts':
      return { ...next, fonts: clone(op.fonts) };
    case 'renameDocument':
      return { ...next, name: op.name };
    case 'restoreSubtree': {
      for (const n of op.nodes) nodes[n.id] = clone(n);
      const root = op.nodes[0];
      if (op.parentId && nodes[op.parentId]) nodes[op.parentId] = insertChild(nodes[op.parentId], root.id, op.index);
      return next;
    }
    default:
      throw new OpError(`unknown op ${(op as { type: string }).type}`);
  }
}

export function applyOps(doc: Document, ops: Op[]): Document {
  return ops.reduce(applyOp, doc);
}

/** The op that undoes `op` when applied after it. Used by the editor's undo stack. */
export function invertOp(doc: Document, op: Op): Op | null {
  switch (op.type) {
    case 'createNode':
      return { type: 'deleteNode', id: op.node.id };
    case 'createInstance':
      return { type: 'deleteNode', id: op.instanceId };
    case 'updateNode': {
      const n = doc.nodes[op.id];
      if (!n) return null;
      const source = op.breakpoint && op.breakpoint !== 'desktop' ? n.overrides[op.breakpoint] ?? {} : n.props;
      const prev: Partial<NodeProps> = {};
      for (const k of Object.keys(op.props) as (keyof NodeProps)[]) (prev as Record<string, unknown>)[k] = structuredClone(source[k]);
      return { type: 'updateNode', id: op.id, props: prev, breakpoint: op.breakpoint };
    }
    case 'deleteNode': {
      const n = doc.nodes[op.id];
      if (!n) return null;
      const ids = subtreeIds(doc, op.id);
      const index = n.parentId ? doc.nodes[n.parentId].children.indexOf(op.id) : 0;
      return { type: 'restoreSubtree', nodes: ids.map((id) => structuredClone(doc.nodes[id])), parentId: n.parentId, index };
    }
    case 'moveNode': {
      const n = doc.nodes[op.id];
      if (!n || !n.parentId) return null;
      return { type: 'moveNode', id: op.id, parentId: n.parentId, index: doc.nodes[n.parentId].children.indexOf(op.id) };
    }
    case 'setText': {
      const n = doc.nodes[op.id];
      if (!n) return null;
      return { type: 'setText', id: op.id, text: structuredClone(n.props.text ?? { blocks: [] }) };
    }
    case 'bindProp': {
      const n = doc.nodes[op.id];
      return { type: 'bindProp', id: op.id, prop: op.prop, binding: n?.bindings?.[op.prop] ?? null };
    }
    case 'setOverride': {
      const n = doc.nodes[op.instanceId];
      return { type: 'setOverride', instanceId: op.instanceId, path: op.path, value: n?.instanceOverrides?.[op.path] };
    }
    case 'updatePage': {
      const p = doc.pages[op.id];
      if (!p) return null;
      const prev: Record<string, unknown> = {};
      for (const k of Object.keys(op.patch)) prev[k] = structuredClone((p as unknown as Record<string, unknown>)[k]);
      return { type: 'updatePage', id: op.id, patch: prev };
    }
    case 'setFonts':
      return { type: 'setFonts', fonts: structuredClone(doc.fonts) };
    case 'renameDocument':
      return { type: 'renameDocument', name: doc.name };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Convenience constructors: the "internal API" the editor calls.
// ---------------------------------------------------------------------------

export function makeNode(partial: { type: DocNode['type']; parentId: string | null; props?: NodeProps; id?: string }): DocNode {
  return {
    id: partial.id ?? newId(),
    type: partial.type,
    parentId: partial.parentId,
    children: [],
    props: partial.props ?? {},
    overrides: {},
  };
}

export const ops = {
  createNode: (node: DocNode, index?: number): Op => ({ type: 'createNode', node, index }),
  updateNode: (id: string, props: Partial<NodeProps>, opts?: { breakpoint?: BreakpointId }): Op => ({ type: 'updateNode', id, props, breakpoint: opts?.breakpoint }),
  deleteNode: (id: string): Op => ({ type: 'deleteNode', id }),
  moveNode: (id: string, parentId: string, index: number): Op => ({ type: 'moveNode', id, parentId, index }),
  setText: (id: string, text: RichText): Op => ({ type: 'setText', id, text }),
  bindProp: (id: string, prop: BindableProp, binding: Binding | null): Op => ({ type: 'bindProp', id, prop, binding }),
  createPage: (page: Page, index?: number): Op => ({ type: 'createPage', page, index }),
  updatePage: (id: string, patch: Partial<Omit<Page, 'id' | 'rootId'>>): Op => ({ type: 'updatePage', id, patch }),
  deletePage: (id: string): Op => ({ type: 'deletePage', id }),
  createComponent: (nodeId: string, name: string): Op => ({ type: 'createComponent', nodeId, name, componentId: newId('c'), instanceId: newId('i') }),
  createInstance: (componentId: string, parentId: string, props?: Partial<NodeProps>, index?: number): Op => ({ type: 'createInstance', componentId, parentId, instanceId: newId('i'), index, props }),
  setOverride: (instanceId: string, path: string, value: unknown): Op => ({ type: 'setOverride', instanceId, path, value }),
  detachInstance: (instanceId: string): Op => ({ type: 'detachInstance', instanceId }),
  setFonts: (fonts: FontRef[]): Op => ({ type: 'setFonts', fonts }),
  renameDocument: (name: string): Op => ({ type: 'renameDocument', name }),
};
