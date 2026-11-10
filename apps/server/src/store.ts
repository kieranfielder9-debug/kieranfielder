import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import { applyOp, type Document, type Op, OpError } from '@studio/core';
import { HttpError, JsonFile } from './util.js';

interface OpsMessage {
  version: number;
  ops: Op[];
  clientId: string | null;
}

interface Subscriber {
  res: ServerResponse;
  clientId: string | null;
}

/**
 * The document store: the authoritative node tree per site, an append-only op
 * log for live sync, and Server-Sent Events fan-out to every open editor.
 */
export class DocumentStore {
  private docs = new Map<string, JsonFile<Document>>();
  private logs = new Map<string, OpsMessage[]>();
  private subscribers = new Map<string, Set<Subscriber>>();
  private heartbeat: NodeJS.Timeout;

  constructor(private dir: string) {
    this.heartbeat = setInterval(() => {
      for (const subs of this.subscribers.values()) for (const s of subs) s.res.write(': ping\n\n');
    }, 25_000);
    this.heartbeat.unref();
  }

  async list(): Promise<{ id: string; name: string; version: number }[]> {
    await fs.mkdir(this.dir, { recursive: true });
    const files = (await fs.readdir(this.dir)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const f of files) {
      const doc = await this.get(f.replace(/\.json$/, ''));
      if (doc) out.push({ id: doc.id, name: doc.name, version: doc.version });
    }
    return out;
  }

  async get(id: string): Promise<Document | null> {
    const jf = await this.file(id);
    return jf ? jf.value : null;
  }

  async create(doc: Document): Promise<Document> {
    const file = path.join(this.dir, `${doc.id}.json`);
    const jf = new JsonFile<Document>(file, { ...doc, version: doc.version ?? 0 });
    await jf.flush();
    this.docs.set(doc.id, jf);
    return jf.value;
  }

  /** Apply ops atomically: either all succeed (one new version) or none. */
  async apply(id: string, ops: Op[], clientId: string | null, baseVersion?: number): Promise<{ version: number; document: Document }> {
    const jf = await this.file(id);
    if (!jf) throw new HttpError(404, 'document not found');
    if (baseVersion !== undefined && baseVersion > jf.value.version) throw new HttpError(409, 'client is ahead of the server', { version: jf.value.version });
    let next = jf.value;
    try {
      for (const op of ops) next = applyOp(next, op);
    } catch (err) {
      if (err instanceof OpError) throw new HttpError(422, err.message);
      throw err;
    }
    next = { ...next, version: jf.value.version + 1 };
    jf.value = next;
    jf.save();
    const msg: OpsMessage = { version: next.version, ops, clientId };
    const log = this.logs.get(id) ?? [];
    log.push(msg);
    if (log.length > 500) log.splice(0, log.length - 500);
    this.logs.set(id, log);
    this.broadcast(id, msg);
    return { version: next.version, document: next };
  }

  /** Ops a client missed since `sinceVersion`, or null if the log no longer reaches back that far. */
  opsSince(id: string, sinceVersion: number): OpsMessage[] | null {
    const log = this.logs.get(id) ?? [];
    if (!log.length) return sinceVersion >= 0 ? [] : null;
    if (log[0].version > sinceVersion + 1) return null;
    return log.filter((m) => m.version > sinceVersion);
  }

  subscribe(id: string, res: ServerResponse, clientId: string | null, sinceVersion: number | undefined): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const sub: Subscriber = { res, clientId };
    if (!this.subscribers.has(id)) this.subscribers.set(id, new Set());
    this.subscribers.get(id)!.add(sub);
    const jf = this.docs.get(id);
    if (sinceVersion !== undefined && jf) {
      const missed = this.opsSince(id, sinceVersion);
      if (missed === null) this.send(sub, 'resync', { version: jf.value.version });
      else for (const m of missed) this.send(sub, 'ops', m);
    }
    res.on('close', () => this.subscribers.get(id)?.delete(sub));
  }

  private send(sub: Subscriber, event: string, data: unknown) {
    sub.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private broadcast(id: string, msg: OpsMessage) {
    for (const sub of this.subscribers.get(id) ?? []) this.send(sub, 'ops', msg);
  }

  async close(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const subs of this.subscribers.values()) for (const s of subs) s.res.end();
    for (const jf of this.docs.values()) await jf.close();
  }

  private async file(id: string): Promise<JsonFile<Document> | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    const cached = this.docs.get(id);
    if (cached) return cached;
    const file = path.join(this.dir, `${id}.json`);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const jf = new JsonFile<Document>(file, JSON.parse(raw) as Document);
      this.docs.set(id, jf);
      return jf;
    } catch {
      return null;
    }
  }
}
