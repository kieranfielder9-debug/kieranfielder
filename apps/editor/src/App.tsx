import { useEffect, useState } from 'react';
import { BREAKPOINTS, makeNode, newId, ops, plainToRich, resolveProps, type DocNode } from '@studio/core';
import { Canvas } from './canvas/Canvas.js';
import { Layers } from './panels/Layers.js';
import { Inspector } from './panels/Inspector.js';
import { CmsPanel } from './panels/Cms.js';
import { PublishPanel } from './panels/Publish.js';
import { getStore, useEditor, type Panel } from './state/store.js';

const PANELS: { id: Panel; label: string; icon: string }[] = [
  { id: 'canvas', label: 'Canvas', icon: '▦' },
  { id: 'layers', label: 'Layers', icon: '☰' },
  { id: 'inspect', label: 'Inspect', icon: '⚙' },
  { id: 'cms', label: 'Content', icon: '▤' },
  { id: 'publish', label: 'Publish', icon: '↑' },
];

const PLACEHOLDER_IMG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#c7d2fe"/><stop offset="1" stop-color="#f5d0fe"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/></svg>')}`;

export function App() {
  const panel = useEditor((s) => s.panel);
  const sync = useEditor((s) => s.sync);
  const pending = useEditor((s) => s.pendingOps);
  const bp = useEditor((s) => s.breakpoint);
  const toast = useEditor((s) => s.toast);
  const canUndo = useEditor((s) => s.undo.length > 0);
  const canRedo = useEditor((s) => s.redo.length > 0);
  const name = useEditor((s) => s.doc?.name ?? '');
  const store = getStore();
  const [installEvent, setInstallEvent] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) store.redoOp();
        else store.undo();
      } else if (!typing && (e.key === 'Backspace' || e.key === 'Delete')) {
        const s = store.get();
        if (s.selection && s.doc && s.doc.nodes[s.selection]?.parentId) store.apply([ops.deleteNode(s.selection)]);
      } else if (!typing && e.key === 'Escape') store.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const setPanel = (p: Panel) => store.set({ panel: p });

  return (
    <div className={`app panel-${panel}`}>
      <header className="topbar">
        <div className="brand">
          <span className={`sync ${sync}`} title={sync} />
          <span className="site-name">{name || 'Pocket Studio'}</span>
          {pending > 0 && <span className="muted small">{pending} pending</span>}
        </div>
        <div className="seg">
          {BREAKPOINTS.map((b) => (
            <button key={b.id} className={bp === b.id ? 'on' : ''} onClick={() => store.set({ breakpoint: b.id })} title={`${b.label} (${b.width}px)`}>
              {b.id === 'desktop' ? '🖥' : b.id === 'tablet' ? '▭' : '📱'}
            </button>
          ))}
        </div>
        <div className="row tight">
          <button className="icon" disabled={!canUndo} onClick={() => store.undo()} aria-label="Undo">
            ↶
          </button>
          <button className="icon" disabled={!canRedo} onClick={() => store.redoOp()} aria-label="Redo">
            ↷
          </button>
          {installEvent && (
            <button className="small" onClick={() => installEvent.prompt().then(() => setInstallEvent(null))}>
              Install
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <Canvas />
        {panel === 'canvas' && <AddBar />}
        {panel !== 'canvas' && (
          <aside className="sheet">
            <div className="sheet-handle" onClick={() => setPanel('canvas')} />
            {panel === 'layers' && <Layers />}
            {panel === 'inspect' && <Inspector />}
            {panel === 'cms' && <CmsPanel />}
            {panel === 'publish' && <PublishPanel />}
          </aside>
        )}
      </main>

      <nav className="tabbar">
        {PANELS.map((p) => (
          <button key={p.id} className={panel === p.id ? 'on' : ''} onClick={() => setPanel(p.id)}>
            <span className="tab-icon">{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

/** Floating toolbar for inserting nodes into the selected frame (or the current page). */
function AddBar() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const bp = useEditor((s) => s.breakpoint);
  const store = getStore();
  if (!doc) return null;

  const targetParent = (): string | null => {
    if (selection && doc.nodes[selection]) {
      const n = doc.nodes[selection];
      if (n.type === 'frame') return n.id;
      if (n.parentId) return n.parentId;
    }
    const first = doc.pageOrder[0];
    return first ? doc.pages[first].rootId : null;
  };

  const insert = (make: (parent: DocNode) => DocNode) => {
    const pid = targetParent();
    if (!pid) return;
    const parent = doc.nodes[pid];
    const node = make(parent);
    const free = !resolveProps(parent, bp).layout || resolveProps(parent, bp).layout?.type === 'none';
    if (free) node.props = { ...node.props, x: 24, y: 24 };
    store.apply([ops.createNode(node)]);
    store.select(node.id);
  };

  const components = Object.values(doc.components);

  return (
    <div className="addbar">
      <button onClick={() => insert((p) => makeNode({ type: 'frame', parentId: p.id, props: { name: 'Frame', width: 'fill', fill: '#e0e7ff', radius: 12, layout: { type: 'stack', direction: 'vertical', gap: 12, padding: 20, align: 'start', justify: 'start' }, minHeight: 80 } }))}>
        + Frame
      </button>
      <button onClick={() => insert((p) => makeNode({ type: 'text', parentId: p.id, props: { name: 'Text', text: plainToRich('New text'), fontSize: 18, color: '#111827', fontFamily: 'Inter' } }))}>+ Text</button>
      <button onClick={() => insert((p) => makeNode({ type: 'image', parentId: p.id, props: { name: 'Image', src: PLACEHOLDER_IMG, width: 'fill', height: 200, radius: 8 } }))}>+ Image</button>
      {components.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const comp = components.find((c) => c.id === e.target.value);
            const pid = targetParent();
            if (!comp || !pid) return;
            const id = newId('i');
            store.apply([{ type: 'createInstance', componentId: comp.id, parentId: pid, instanceId: id }]);
            store.select(id);
          }}
        >
          <option value="">+ Component…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
