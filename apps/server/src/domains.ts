import dns from 'node:dns';
import crypto from 'node:crypto';
import path from 'node:path';
import { newId } from '@studio/core';
import { HttpError, JsonFile, nowIso } from './util.js';

export type DomainStatus = 'pending_dns' | 'verifying' | 'issuing_certificate' | 'active' | 'error';

export interface DnsRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
}

export interface Certificate {
  hostname: string;
  issuer: string;
  serial: string;
  notBefore: string;
  notAfter: string;
}

export interface Domain {
  id: string;
  siteId: string;
  hostname: string;
  status: DomainStatus;
  records: DnsRecord[];
  verificationToken: string;
  lastCheckedAt?: string;
  error?: string;
  certificate?: Certificate;
  createdAt: string;
}

export interface DnsResolver {
  resolveCname(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolve4(host: string): Promise<string[]>;
}

export const systemDns: DnsResolver = {
  resolveCname: (h) => dns.promises.resolveCname(h),
  resolveTxt: (h) => dns.promises.resolveTxt(h),
  resolve4: (h) => dns.promises.resolve4(h),
};

/** A resolver that answers with whatever the platform asked for. For local development and tests. */
export function fakeDns(service: () => DomainService): DnsResolver {
  return {
    resolveCname: async (h) => {
      const d = service().byHostname(h);
      return d ? [service().edgeHost] : [];
    },
    resolveTxt: async (h) => {
      const d = service().all().find((x) => `_studio-verify.${x.hostname}` === h);
      return d ? [[d.verificationToken]] : [];
    },
    resolve4: async () => [],
  };
}

/**
 * Certificate manager. The real deployment uses ACME (Let's Encrypt) with the
 * HTTP-01 challenge, which the edge serves at /.well-known/acme-challenge/.
 * This implementation goes through the same steps (challenge -> validate ->
 * issue -> renew) and records the certificate metadata; the CA is pluggable.
 */
export interface CertificateAuthority {
  issue(hostname: string, challenge: { token: string; keyAuthorization: string }): Promise<Certificate>;
}

export const selfSignedCa: CertificateAuthority = {
  async issue(hostname) {
    const notBefore = new Date();
    const notAfter = new Date(notBefore.getTime() + 90 * 24 * 3600 * 1000);
    return { hostname, issuer: 'Pocket Studio Dev CA (self-signed)', serial: crypto.randomBytes(8).toString('hex'), notBefore: notBefore.toISOString(), notAfter: notAfter.toISOString() };
  },
};

export class CertificateManager {
  private challenges = new Map<string, string>();
  constructor(private ca: CertificateAuthority = selfSignedCa) {}

  /** Served by the edge at /.well-known/acme-challenge/:token. */
  challengeResponse(token: string): string | undefined {
    return this.challenges.get(token);
  }

  async issue(hostname: string): Promise<Certificate> {
    const token = crypto.randomBytes(16).toString('base64url');
    const keyAuthorization = `${token}.${crypto.createHash('sha256').update(hostname).digest('base64url')}`;
    this.challenges.set(token, keyAuthorization);
    try {
      return await this.ca.issue(hostname, { token, keyAuthorization });
    } finally {
      this.challenges.delete(token);
    }
  }

  needsRenewal(cert: Certificate, daysBefore = 30): boolean {
    return new Date(cert.notAfter).getTime() - Date.now() < daysBefore * 24 * 3600 * 1000;
  }
}

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

/**
 * Domain service: DNS instructions -> verification -> certificate -> active.
 * The edge asks it which site a Host header belongs to.
 */
export class DomainService {
  private file!: JsonFile<{ domains: Domain[] }>;
  private poller: NodeJS.Timeout | null = null;

  constructor(
    private dir: string,
    public readonly edgeHost: string,
    private resolver: DnsResolver,
    private certs: CertificateManager,
  ) {}

  async init(pollMs = 60_000): Promise<void> {
    this.file = await JsonFile.load(path.join(this.dir, 'domains.json'), () => ({ domains: [] }));
    if (pollMs > 0) {
      this.poller = setInterval(() => this.poll().catch(() => undefined), pollMs);
      this.poller.unref();
    }
  }

  all(): Domain[] {
    return this.file.value.domains;
  }

  forSite(siteId: string): Domain[] {
    return this.all().filter((d) => d.siteId === siteId);
  }

  get(siteId: string, id: string): Domain {
    const d = this.all().find((x) => x.id === id && x.siteId === siteId);
    if (!d) throw new HttpError(404, 'domain not found');
    return d;
  }

  byHostname(hostname: string): Domain | undefined {
    const h = hostname.toLowerCase().replace(/\.$/, '');
    return this.all().find((d) => d.hostname === h);
  }

  /** POST /sites/:id/domains {hostname} -> the DNS records the user must add. */
  add(siteId: string, hostnameInput: string): Domain {
    const hostname = String(hostnameInput ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (!HOSTNAME_RE.test(hostname)) throw new HttpError(422, 'invalid hostname');
    if (this.byHostname(hostname)) throw new HttpError(409, 'hostname already added');
    const token = `studio-verify=${crypto.randomBytes(12).toString('hex')}`;
    const isApex = hostname.split('.').length === 2;
    const domain: Domain = {
      id: newId('dom'),
      siteId,
      hostname,
      status: 'pending_dns',
      verificationToken: token,
      records: [
        isApex ? { type: 'A', name: hostname, value: '203.0.113.10' } : { type: 'CNAME', name: hostname, value: this.edgeHost },
        { type: 'TXT', name: `_studio-verify.${hostname}`, value: token },
      ],
      createdAt: nowIso(),
    };
    this.file.value.domains.push(domain);
    this.file.save();
    return domain;
  }

  remove(siteId: string, id: string): void {
    const d = this.get(siteId, id);
    this.file.value.domains = this.file.value.domains.filter((x) => x.id !== d.id);
    this.file.save();
  }

  /** Check DNS, then issue a certificate. Safe to call repeatedly. */
  async verify(siteId: string, id: string): Promise<Domain> {
    const d = this.get(siteId, id);
    if (d.status === 'active' && d.certificate && !this.certs.needsRenewal(d.certificate)) return d;
    d.status = 'verifying';
    d.lastCheckedAt = nowIso();
    d.error = undefined;
    this.file.save();
    try {
      const txt = await this.resolver.resolveTxt(`_studio-verify.${d.hostname}`).catch(() => [] as string[][]);
      const hasTxt = txt.some((parts) => parts.join('') === d.verificationToken);
      if (!hasTxt) throw new Error(`TXT record _studio-verify.${d.hostname} not found or does not match`);
      const routed = await this.pointsAtEdge(d);
      if (!routed) throw new Error(`${d.hostname} does not point at ${this.edgeHost} yet`);
      d.status = 'issuing_certificate';
      this.file.save();
      d.certificate = await this.certs.issue(d.hostname);
      d.status = 'active';
    } catch (err) {
      d.status = d.certificate ? 'active' : 'pending_dns';
      d.error = (err as Error).message;
    }
    this.file.save();
    return d;
  }

  private async pointsAtEdge(d: Domain): Promise<boolean> {
    const cname = await this.resolver.resolveCname(d.hostname).catch(() => [] as string[]);
    if (cname.some((c) => c.replace(/\.$/, '').toLowerCase() === this.edgeHost)) return true;
    const a = await this.resolver.resolve4(d.hostname).catch(() => [] as string[]);
    const expected = d.records.find((r) => r.type === 'A')?.value;
    return !!expected && a.includes(expected);
  }

  /** Background: keep checking pending domains and renew certificates that are close to expiry. */
  async poll(): Promise<void> {
    for (const d of this.all()) {
      if (d.status === 'pending_dns' || d.status === 'verifying' || (d.certificate && this.certs.needsRenewal(d.certificate))) {
        await this.verify(d.siteId, d.id);
      }
    }
  }

  async close(): Promise<void> {
    if (this.poller) clearInterval(this.poller);
    await this.file.close();
  }
}
