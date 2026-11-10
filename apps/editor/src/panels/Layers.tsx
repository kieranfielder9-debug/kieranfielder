import { newId, ops, type DocNode, type Document } from '@studio/core';
import { getStore, useEditor } from '../state/store.js';

export function Layers() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const store = getStore();
  if (!doc) return null;

  const addPage = () => {
    const name = prompt('Page name', 'New page');
    if (!name) return;
    const id = newId('page');
    const rootId = newId();
    const path = '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    store.apply([ops.createPage({ id, name, path: path === '/' ? '/page' : path, rootId, seo: {} })]);
    store.select(rootId);
  };

  return (
    <div className="panel-body">
      <div className="panel-title">
        <h2>Pages</h2>
        <button className="secondary small" onClick={addPage}>
          + Page
        </button>
      </div>
      {doc.pageOrder.map((pid) => (
        <Tree key={pid} doc={doc} rootId={doc.pages[pid].rootId} label={doc.pages[pid].name} selection={selection} />
      ))}
      <h2>Components</h2>
      {Object.values(doc.components).length === 0 && <p className="muted">Select a layer and tap “Make component”.</p>}
      {Object.values(doc.components).map((c) => (
        <Tree key={c.id} doc={doc} rootId={c.rootId} label={c.name} selection={selection} />
      ))}
    </div>
  );
}

function Tree({ doc, rootId, label, selection }: { doc: Document; rootId: string; label: string; selection: string | null }) {
  const store = getStore();
  const rows: { node: DocNode; depth: number }[] = [];
  const walk = (id: string, depth: number) => {
    const n = doc.nodes[id];
    if (!n) return;
    rows.push({ node: n, depth });
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(rootId, 0);

  const move = (n: DocNode, dir: -1 | 1) => {
    if (!n.parentId) return;
    const siblings = doc.nodes[n.parentId].children;
    const i = siblings.indexOf(n.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    store.apply([ops.moveNode(n.id, n.parentId, j)]);
  };
  const outdent = (n: DocNode) => {
    const parent = n.parentId ? doc.nodes[n.parentId] : null;
    if (!parent || !parent.parentId) return;
    const idx = doc.nodes[parent.parentId].children.indexOf(parent.id);
    store.apply([ops.moveNode(n.id, parent.parentId, idx + 1)]);
  };
  const indent = (n: DocNode) => {
    if (!n.parentId) return;
    const siblings = doc.nodes[n.parentId].children;
    const i = siblings.indexOf(n.id);
    const prev = i > 0 ? doc.nodes[siblings[i - 1]] : null;
    if (prev && prev.type === 'frame') store.apply([ops.moveNode(n.id, prev.id, prev.children.length)]);
  };

  return (
    <div className="tree">
      {rows.map(({ node, depth }) => {
        const sel = selection === node.id;
        const name = node.props.name || (depth === 0 ? label : node.type);
        return (
          <div key={node.id} className={`layer${sel ? ' sel' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => store.select(node.id)}>
            <span className={`dot ${node.type}`} />
            <span className="layer-name">{name}</span>
            {sel && depth > 0 && (
              <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => move(node, -1)} title="Move up">
                  ↑
                </button>
                <button onClick={() => move(node, 1)} title="Move down">
                  ↓
                </button>
                <button onClick={() => outdent(node)} title="Move out of parent">
                  ←
                </button>
                <button onClick={() => indent(node)} title="Move into previous frame">
                  →
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
