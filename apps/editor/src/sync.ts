import type { Document, Op } from '@studio/core';
import { api } from './api.js';
import type { EditorStore } from './state/store.js';

const CLIENT_ID = `c_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Live sync: ops go to the store over HTTP, come back to everyone (including
 * other devices) over Server-Sent Events. Offline, ops queue locally and the
 * document is kept in localStorage so the app still opens.
 */
export class LiveSync {
  private queue: Op[] = [];
  private flushing = false;
  private version = 0;
  private es: EventSource | null = null;
  private stopped = false;
  private retry = 1000;

  constructor(private store: EditorStore, private siteId: string) {}

  private get cacheKey() {
    return `studio:doc:${this.siteId}`;
  }
  private get queueKey() {
    return `studio:queue:${this.siteId}`;
  }

  async start(): Promise<void> {
    this.store.connect((ops) => this.enqueue(ops));
    try {
      const raw = localStorage.getItem(this.queueKey);
      if (raw) this.queue = JSON.parse(raw) as Op[];
    } catch {
      /* ignore */
    }
    try {
      const { document } = await api.getDocument(this.siteId);
      this.load(document);
      this.store.set({ sync: 'online' });
    } catch {
      const cached = this.readCache();
      if (cached) {
        this.load(cached);
        this.store.set({ sync: 'offline' });
        this.store.toast('Offline: showing your last saved copy', 'info');
      } else {
        this.store.set({ sync: 'error' });
        return;
      }
    }
    if (this.queue.length) void this.flush();
    this.openStream();
    window.addEventListener('online', () => {
      if (this.queue.length) void this.flush();
      this.openStream();
    });
  }

  stop(): void {
    this.stopped = true;
    this.es?.close();
  }

  private load(doc: Document) {
    this.version = doc.version;
    // Re-apply anything queued offline on top of the fresh server copy.
    this.store.set({ doc, undo: [], redo: [] });
    if (this.queue.length) this.store.apply(this.queue, { record: false, remote: true });
    this.writeCache();
  }

  private readCache(): Document | null {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      return raw ? (JSON.parse(raw) as Document) : null;
    } catch {
      return null;
    }
  }

  private writeCache() {
    try {
      const doc = this.store.get().doc;
      if (doc) localStorage.setItem(this.cacheKey, JSON.stringify(doc));
      localStorage.setItem(this.queueKey, JSON.stringify(this.queue));
    } catch {
      /* quota exceeded: nothing to do */
    }
  }

  private enqueue(ops: Op[]) {
    this.queue.push(...ops);
    this.store.set({ pendingOps: this.queue.length });
    this.writeCache();
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing || !this.queue.length) return;
    this.flushing = true;
    this.store.set({ sync: 'saving' });
    while (this.queue.length) {
      const batch = this.queue.slice(0, 200);
      try {
        const { version } = await api.sendOps(this.siteId, batch, CLIENT_ID);
        this.version = Math.max(this.version, version);
        this.queue.splice(0, batch.length);
        this.store.set({ pendingOps: this.queue.length });
        this.writeCache();
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status && status >= 400 && status < 500 && status !== 409) {
          // The server refused these ops; drop them and resync to its truth.
          this.queue.splice(0, batch.length);
          this.store.toast(`Server rejected a change: ${(err as Error).message}`, 'error');
          await this.resync();
          continue;
        }
        this.store.set({ sync: 'offline' });
        this.flushing = false;
        setTimeout(() => void this.flush(), 3000);
        return;
      }
    }
    this.flushing = false;
    this.store.set({ sync: 'online' });
  }

  private openStream() {
    if (this.stopped || (this.es && this.es.readyState !== EventSource.CLOSED)) return;
    this.es?.close();
    const es = new EventSource(`/api/documents/${this.siteId}/events?clientId=${CLIENT_ID}&since=${this.version}`);
    this.es = es;
    es.addEventListener('ops', (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data) as { version: number; ops: Op[]; clientId: string | null };
      this.version = Math.max(this.version, msg.version);
      if (msg.clientId === CLIENT_ID) return; // our own echo: already applied optimistically
      this.store.apply(msg.ops, { remote: true });
      this.writeCache();
    });
    es.addEventListener('resync', () => void this.resync());
    es.onopen = () => {
      this.retry = 1000;
      if (!this.queue.length) this.store.set({ sync: 'online' });
    };
    es.onerror = () => {
      es.close();
      this.store.set((s) => ({ sync: s.sync === 'saving' ? s.sync : 'offline' }));
      if (!this.stopped) {
        setTimeout(() => this.openStream(), this.retry);
        this.retry = Math.min(this.retry * 2, 15_000);
      }
    };
  }

  private async resync() {
    try {
      const { document } = await api.getDocument(this.siteId);
      this.load(document);
      this.es?.close();
      this.openStream();
    } catch {
      /* stays offline */
    }
  }
}
