import type { Collection, Document, Item, Op } from '@studio/core';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText, data.details);
  return data as T;
}

export interface Deployment {
  id: string;
  siteId: string;
  mode: 'preview' | 'production';
  status: 'queued' | 'building' | 'ready' | 'failed';
  documentVersion: number;
  createdAt: string;
  finishedAt?: string;
  fileCount?: number;
  routes?: { path: string; file: string }[];
  warnings?: string[];
  error?: string;
  url: string;
}

export interface DomainRecord {
  id: string;
  hostname: string;
  status: 'pending_dns' | 'verifying' | 'issuing_certificate' | 'active' | 'error';
  records: { type: string; name: string; value: string }[];
  error?: string;
  lastCheckedAt?: string;
  certificate?: { issuer: string; notAfter: string };
}

export interface SiteInfo {
  id: string;
  name: string;
  version: number;
  liveDeploymentId: string | null;
  previousDeploymentIds: string[];
  live: Deployment | null;
  liveUrl: string;
  domains: DomainRecord[];
  webhooks: { id: string; url: string; events: string[] }[];
}

export const api = {
  listDocuments: () => request<{ documents: { id: string; name: string; version: number }[] }>('GET', '/api/documents'),
  createDocument: (name: string, template: 'demo' | 'blank') => request<{ document: Document }>('POST', '/api/documents', { name, template }),
  getDocument: (id: string) => request<{ document: Document }>('GET', `/api/documents/${id}`),
  sendOps: (id: string, ops: Op[], clientId: string) => request<{ version: number }>('POST', `/api/documents/${id}/ops`, { ops, clientId }),

  listCollections: (site: string) => request<{ collections: Collection[] }>('GET', `/api/sites/${site}/collections`),
  createCollection: (site: string, body: { name: string; fields?: unknown[] }) => request<{ collection: Collection }>('POST', `/api/sites/${site}/collections`, body),
  updateCollection: (site: string, id: string, body: unknown) => request<{ collection: Collection }>('PATCH', `/api/sites/${site}/collections/${id}`, body),
  deleteCollection: (site: string, id: string) => request<{ ok: true }>('DELETE', `/api/sites/${site}/collections/${id}`),
  listItems: (site: string, cid: string) => request<{ items: Item[] }>('GET', `/api/sites/${site}/collections/${cid}/items`),
  createItem: (site: string, cid: string, values: Record<string, unknown>) => request<{ item: Item }>('POST', `/api/sites/${site}/collections/${cid}/items`, { values }),
  patchItem: (site: string, cid: string, id: string, values: Record<string, unknown>) => request<{ item: Item }>('PATCH', `/api/sites/${site}/collections/${cid}/items/${id}`, { values }),
  deleteItem: (site: string, cid: string, id: string) => request<{ ok: true }>('DELETE', `/api/sites/${site}/collections/${cid}/items/${id}`),

  site: (site: string) => request<{ site: SiteInfo }>('GET', `/api/sites/${site}`),
  publish: (site: string, mode: 'preview' | 'production') => request<{ deploymentId: string; deployment: Deployment }>('POST', `/api/sites/${site}/publish`, { mode }),
  deployment: (id: string) => request<{ deployment: Deployment }>('GET', `/api/deployments/${id}`),
  deployments: (site: string) => request<{ deployments: Deployment[] }>('GET', `/api/sites/${site}/deployments`),
  setLive: (site: string, deploymentId: string) => request<{ site: SiteInfo }>('POST', `/api/sites/${site}/live`, { deploymentId }),
  addWebhook: (site: string, url: string) => request<{ webhook: { id: string; url: string } }>('POST', `/api/sites/${site}/webhooks`, { url }),
  removeWebhook: (site: string, id: string) => request<{ ok: true }>('DELETE', `/api/sites/${site}/webhooks/${id}`),

  domains: (site: string) => request<{ domains: DomainRecord[] }>('GET', `/api/sites/${site}/domains`),
  addDomain: (site: string, hostname: string) => request<{ domain: DomainRecord }>('POST', `/api/sites/${site}/domains`, { hostname }),
  verifyDomain: (site: string, id: string) => request<{ domain: DomainRecord }>('POST', `/api/sites/${site}/domains/${id}/verify`),
  removeDomain: (site: string, id: string) => request<{ ok: true }>('DELETE', `/api/sites/${site}/domains/${id}`),
};

/** Polls a deployment until the build worker finishes it. */
export async function waitForDeployment(id: string, onUpdate?: (d: Deployment) => void, timeoutMs = 60_000): Promise<Deployment> {
  const start = Date.now();
  for (;;) {
    const { deployment } = await api.deployment(id);
    onUpdate?.(deployment);
    if (deployment.status === 'ready' || deployment.status === 'failed') return deployment;
    if (Date.now() - start > timeoutMs) throw new Error('build timed out');
    await new Promise((r) => setTimeout(r, 600));
  }
}
