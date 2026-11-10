import { useSyncExternalStore } from 'react';
import { applyOp, invertOp, type BreakpointId, type Collection, type Document, type Item, type Op } from '@studio/core';

export type Panel = 'canvas' | 'layers' | 'inspect' | 'cms' | 'publish';
export type SyncState = 'connecting' | 'online' | 'offline' | 'saving' | 'error';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface EditorState {
  siteId: string;
  doc: Document | null;
  selection: string | null;
  /** Node currently open in the inline text editor. */
  editingText: string | null;
  breakpoint: BreakpointId;
  viewport: Viewport;
  panel: Panel;
  sync: SyncState;
  pendingOps: number;
  undo: Op[][];
  redo: Op[][];
  toast: { id: number; text: string; kind: 'info' | 'error' } | null;
  cms: { collections: Collection[]; items: Item[] };
  previewHtml: string | null;
}

type Listener = () => void;

export interface OpSink {
  (ops: Op[]): void;
}

/**
 * The editor store: the document held in memory, plus UI state. Changes to the
 * document only ever happen through `apply(ops)`, so undo/redo and live sync
 * stay in step.
 */
export class EditorStore {
  private state: EditorState;
  private listeners = new Set<Listener>();
  private sink: OpSink | null = null;
  private toastSeq = 0;

  constructor(siteId: string) {
    this.state = {
      siteId,
      doc: null,
      selection: null,
      editingText: null,
      breakpoint: 'phone',
      viewport: { x: 24, y: 24, zoom: 0.5 },
      panel: 'canvas',
      sync: 'connecting',
      pendingOps: 0,
      undo: [],
      redo: [],
      toast: null,
      cms: { collections: [], items: [] },
      previewHtml: null,
    };
  }

  get = (): EditorState => this.state;

  set(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)): void {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  connect(sink: OpSink): void {
    this.sink = sink;
  }

  /** Apply ops locally (optimistic), record the inverse for undo, and hand them to live sync. */
  apply(ops: Op[], opts: { record?: boolean; remote?: boolean } = {}): void {
    const doc = this.state.doc;
    if (!doc || !ops.length) return;
    const inverse: Op[] = [];
    let next = doc;
    try {
      for (const op of ops) {
        if (opts.record !== false && !opts.remote) {
          const inv = invertOp(next, op);
          if (inv) inverse.unshift(inv);
        }
        next = applyOp(next, op);
      }
    } catch (err) {
      this.toast(`Change rejected: ${(err as Error).message}`, 'error');
      return;
    }
    const patch: Partial<EditorState> = { doc: next };
    if (opts.record !== false && !opts.remote && inverse.length) {
      patch.undo = [...this.state.undo.slice(-99), inverse];
      patch.redo = [];
    }
    if (this.state.selection && !next.nodes[this.state.selection]) patch.selection = null;
    this.set(patch);
    if (!opts.remote) this.sink?.(ops);
  }

  undo(): void {
    const entry = this.state.undo[this.state.undo.length - 1];
    if (!entry || !this.state.doc) return;
    const redo = entry.map((op) => invertOp(this.state.doc!, op)).filter((o): o is Op => !!o).reverse();
    this.set({ undo: this.state.undo.slice(0, -1), redo: [...this.state.redo, redo] });
    this.apply(entry, { record: false });
  }

  redoOp(): void {
    const entry = this.state.redo[this.state.redo.length - 1];
    if (!entry || !this.state.doc) return;
    const undo = entry.map((op) => invertOp(this.state.doc!, op)).filter((o): o is Op => !!o).reverse();
    this.set({ redo: this.state.redo.slice(0, -1), undo: [...this.state.undo, undo] });
    this.apply(entry, { record: false });
  }

  select(id: string | null): void {
    this.set({ selection: id, editingText: null });
  }

  toast(text: string, kind: 'info' | 'error' = 'info'): void {
    const id = ++this.toastSeq;
    this.set({ toast: { id, text, kind } });
    setTimeout(() => {
      if (this.state.toast?.id === id) this.set({ toast: null });
    }, kind === 'error' ? 5000 : 2500);
  }
}

let current: EditorStore | null = null;
export function getStore(): EditorStore {
  if (!current) throw new Error('store not initialised');
  return current;
}
export function initStore(siteId: string): EditorStore {
  current = new EditorStore(siteId);
  return current;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}
