import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BREAKPOINTS, CmsIndex, expandTree, ops, resolveProps, type Document, type NodeProps } from '@studio/core';
import { getStore, useEditor, type Viewport } from '../state/store.js';
import { NodeView, type Rect } from './NodeView.js';

const GAP = 120;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

interface ArtboardBox {
  /** Page id, or component id for a master artboard. */
  id: string;
  kind: 'page' | 'component';
  rootId: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pages in a row; component masters in a second row underneath. */
function layoutArtboards(doc: Document, width: number, heights: Record<string, number>): ArtboardBox[] {
  const boxes: ArtboardBox[] = [];
  let x = 0;
  for (const pageId of doc.pageOrder) {
    const page = doc.pages[pageId];
    if (!page) continue;
    boxes.push({ id: pageId, kind: 'page', rootId: page.rootId, label: page.name, sub: page.path, x, y: 0, w: width, h: heights[pageId] ?? 900 });
    x += width + GAP;
  }
  const rowH = Math.max(900, ...boxes.map((b) => b.h));
  x = 0;
  for (const comp of Object.values(doc.components)) {
    boxes.push({ id: comp.id, kind: 'component', rootId: comp.rootId, label: comp.name, sub: 'component', x, y: rowH + GAP, w: width, h: heights[comp.id] ?? 200 });
    x += width + GAP;
  }
  return boxes;
}

interface Gesture {
  kind: 'pan' | 'pinch' | 'drag';
  moved: boolean;
  startViewport: Viewport;
  startPointers: Map<number, { x: number; y: number }>;
  nodeId?: string;
  startProps?: { x: number; y: number };
  target?: string | null;
}

/**
 * The infinite canvas. Pan/zoom is one CSS transform on `.world`; every page
 * is an artboard laid out side by side. Only artboards intersecting the
 * viewport render, and inside them off-screen absolute nodes are culled.
 */
export function Canvas() {
  const doc = useEditor((s) => s.doc);
  const bp = useEditor((s) => s.breakpoint);
  const viewport = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const cms = useEditor((s) => s.cms);
  const store = getStore();

  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Record<string, number>>({});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; id: string | null }>({ t: 0, id: null });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const index = useMemo(() => new CmsIndex(cms.collections, cms.items), [cms]);
  const bpDef = BREAKPOINTS.find((b) => b.id === bp)!;
  const boxes = useMemo(() => (doc ? layoutArtboards(doc, bpDef.width, heights) : []), [doc, bpDef.width, heights]);

  const worldRect: Rect = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    w: size.w / viewport.zoom,
    h: size.h / viewport.zoom,
  };
  const margin = 200;
  const visibleBoxes = boxes.filter(
    (b) => b.x < worldRect.x + worldRect.w + margin && b.x + b.w > worldRect.x - margin && b.y < worldRect.y + worldRect.h + margin && b.y + b.h > worldRect.y - margin,
  );

  const setViewport = useCallback((v: Viewport) => store.set({ viewport: v }), [store]);

  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number, base: Viewport) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.zoom * factor));
      const k = zoom / base.zoom;
      setViewport({ zoom, x: sx - (sx - base.x) * k, y: sy - (sy - base.y) * k });
    },
    [setViewport],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = ref.current!.getBoundingClientRect();
      const v = store.get().viewport;
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top, v);
      else setViewport({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    },
    [store, zoomAt, setViewport],
  );

  const local = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const targetEl = (e.target as HTMLElement).closest<HTMLElement>('[data-select]');
    const target = targetEl?.dataset.select ?? null;
    const state = store.get();
    if (pointers.current.size === 2) {
      gesture.current = { kind: 'pinch', moved: false, startViewport: state.viewport, startPointers: new Map(pointers.current) };
      return;
    }
    // Drag only nodes that are free-positioned in their parent and already selected.
    let drag: Gesture | null = null;
    if (target && state.doc && target === state.selection) {
      const node = state.doc.nodes[target];
      const parent = node?.parentId ? state.doc.nodes[node.parentId] : null;
      const parentLayout = parent ? resolveProps(parent, bp).layout : undefined;
      if (node && parent && (!parentLayout || parentLayout.type === 'none')) {
        const p = resolveProps(node, bp);
        drag = { kind: 'drag', moved: false, startViewport: state.viewport, startPointers: new Map(pointers.current), nodeId: target, startProps: { x: p.x ?? 0, y: p.y ?? 0 }, target };
      }
    }
    gesture.current = drag ?? { kind: 'pan', moved: false, startViewport: state.viewport, startPointers: new Map(pointers.current), target };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    const start = g.startPointers.get(e.pointerId);
    const now = pointers.current.get(e.pointerId)!;
    if (start && Math.hypot(now.x - start.x, now.y - start.y) > 4) g.moved = true;

    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a0, b0] = [...g.startPointers.values()];
      const ids = [...g.startPointers.keys()];
      const a1 = pointers.current.get(ids[0]);
      const b1 = pointers.current.get(ids[1]);
      if (!a1 || !b1) return;
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
      const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.startViewport.zoom * (d1 / d0)));
      const k = zoom / g.startViewport.zoom;
      setViewport({ zoom, x: m1.x - (m0.x - g.startViewport.x) * k, y: m1.y - (m0.y - g.startViewport.y) * k });
      return;
    }
    if (!start) return;
    const dx = now.x - start.x;
    const dy = now.y - start.y;
    if (g.kind === 'pan') {
      setViewport({ ...g.startViewport, x: g.startViewport.x + dx, y: g.startViewport.y + dy });
    } else if (g.kind === 'drag' && g.nodeId && g.startProps) {
      const z = g.startViewport.zoom;
      const props: Partial<NodeProps> = { x: Math.round(g.startProps.x + dx / z), y: Math.round(g.startProps.y + dy / z) };
      store.apply([ops.updateNode(g.nodeId, props, { breakpoint: bp })], { record: false, remote: true });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (g.kind === 'drag' && g.nodeId && g.startProps) {
      if (g.moved) {
        const state = store.get();
        const final = resolveProps(state.doc!.nodes[g.nodeId], bp);
        // Snap back locally, then apply once so undo restores the pre-drag position and sync sends one op.
        store.apply([ops.updateNode(g.nodeId, g.startProps, { breakpoint: bp })], { record: false, remote: true });
        store.apply([ops.updateNode(g.nodeId, { x: final.x, y: final.y }, { breakpoint: bp })]);
      }
      return;
    }
    if (!g.moved) {
      const now = Date.now();
      const id = g.target ?? null;
      const doubleTap = now - lastTap.current.t < 350 && lastTap.current.id === id;
      lastTap.current = { t: now, id };
      store.select(id);
      if (doubleTap && id) store.set({ panel: 'inspect', editingText: id });
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  };

  // Touch-action none on the element: we handle all gestures. Also stop the page from zooming.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('gesturestart', prevent);
    return () => el.removeEventListener('gesturestart', prevent);
  }, []);

  const onMeasured = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  if (!doc) return <div className="canvas empty">Loading…</div>;

  return (
    <div
      ref={ref}
      className="canvas"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ touchAction: 'none' }}
    >
      <div className="world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        {visibleBoxes.map((box) => (
          <Artboard key={box.id} doc={doc} box={box} bp={bp} index={index} selection={selection} worldRect={worldRect} onMeasured={onMeasured} />
        ))}
      </div>
      <div className="canvas-hud">
        <button onClick={() => zoomAt(1 / 1.25, size.w / 2, size.h / 2, viewport)} aria-label="Zoom out">−</button>
        <button onClick={() => fit(boxes, size, setViewport, doc, store.get().selection)}>{Math.round(viewport.zoom * 100)}%</button>
        <button onClick={() => zoomAt(1.25, size.w / 2, size.h / 2, viewport)} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}

function fit(boxes: ArtboardBox[], size: { w: number; h: number }, setViewport: (v: Viewport) => void, doc: Document, selection: string | null) {
  if (!boxes.length) return;
  // Fit the artboard containing the selection, else the first one.
  let target = boxes[0];
  if (selection) {
    let cur: string | null = selection;
    while (cur && doc.nodes[cur]?.parentId) cur = doc.nodes[cur].parentId;
    target = boxes.find((b) => b.rootId === cur) ?? target;
  }
  const pad = 24;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((size.w - pad * 2) / target.w, (size.h - pad * 2) / target.h)));
  setViewport({ zoom, x: (size.w - target.w * zoom) / 2 - target.x * zoom, y: pad - target.y * zoom });
}

interface ArtboardProps {
  doc: Document;
  box: ArtboardBox;
  bp: 'desktop' | 'tablet' | 'phone';
  index: CmsIndex;
  selection: string | null;
  worldRect: Rect;
  onMeasured: (id: string, h: number) => void;
}

function Artboard({ doc, box, bp, index, selection, worldRect, onMeasured }: ArtboardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => expandTree(doc, box.rootId), [doc, box.rootId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onMeasured(box.id, Math.max(200, el.offsetHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.id, onMeasured]);

  const visible: Rect = { x: worldRect.x - box.x, y: worldRect.y - box.y, w: worldRect.w, h: worldRect.h };
  const selectedRoot = selection === box.rootId;
  const isComponent = box.kind === 'component';

  return (
    <div className={`artboard${isComponent ? ' component' : ''}`} style={{ left: box.x, top: box.y, width: box.w }}>
      <div className={`artboard-label${selectedRoot ? ' sel' : ''}`} data-select={box.rootId}>
        {isComponent ? '◆ ' : ''}
        {box.label} <span className="muted">{box.sub}</span>
      </div>
      <div ref={ref} className={`artboard-body${isComponent ? ' master' : ''}`} style={{ width: box.w, minHeight: isComponent ? 120 : 200 }}>
        {tree ? <NodeView node={tree} bp={bp} parentLayout={undefined} ctx={{ index, selection, visible }} origin={{ x: 0, y: 0 }} /> : null}
      </div>
    </div>
  );
}
