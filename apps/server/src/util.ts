import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function readJson<T = unknown>(req: IncomingMessage, limit = 5 * 1024 * 1024): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'body too large');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {} as T;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw new HttpError(400, 'invalid JSON body');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/jsx; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** A JSON document on disk with coalesced writes. */
export class JsonFile<T> {
  private timer: NodeJS.Timeout | null = null;
  private pending: Promise<void> = Promise.resolve();
  constructor(public readonly file: string, public value: T) {}

  static async load<T>(file: string, fallback: () => T): Promise<JsonFile<T>> {
    try {
      const raw = await fs.readFile(file, 'utf8');
      return new JsonFile<T>(file, JSON.parse(raw) as T);
    } catch {
      const jf = new JsonFile<T>(file, fallback());
      await jf.flush();
      return jf;
    }
  }

  save(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pending = this.pending.then(() => this.flush()).catch((err) => console.error('save failed', this.file, err));
    }, 50);
  }

  async flush(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.value, null, 2));
    await fs.rename(tmp, this.file);
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      await this.flush();
    }
    await this.pending;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Minimal path router with `:param` segments. */
export type Handler = (ctx: RouteContext) => Promise<void> | void;
export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
}

export class Router {
  private routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    const keys: string[] = [];
    const re = new RegExp(
      '^' +
        pattern
          .replace(/\//g, '\\/')
          .replace(/:([a-zA-Z0-9_]+)/g, (_, k: string) => {
            keys.push(k);
            return '([^\\/]+)';
          })
          .replace(/\*$/, '(.*)') +
        '$',
    );
    this.routes.push({ method, pattern: re, keys, handler });
    return this;
  }

  get = (p: string, h: Handler) => this.add('GET', p, h);
  post = (p: string, h: Handler) => this.add('POST', p, h);
  patch = (p: string, h: Handler) => this.add('PATCH', p, h);
  put = (p: string, h: Handler) => this.add('PUT', p, h);
  delete = (p: string, h: Handler) => this.add('DELETE', p, h);

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method && r.method !== '*') continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return null;
  }
}
