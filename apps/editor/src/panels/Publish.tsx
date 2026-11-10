import { useCallback, useEffect, useState } from 'react';
import { api, waitForDeployment, type Deployment, type DomainRecord, type SiteInfo } from '../api.js';
import { getStore, useEditor } from '../state/store.js';
import { Section } from './Inspector.js';

export function usePublish(siteId: string) {
  const store = getStore();
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ site }, { deployments }] = await Promise.all([api.site(siteId), api.deployments(siteId)]);
    setSite(site);
    setDeployments(deployments);
  }, [siteId]);

  useEffect(() => {
    refresh().catch((e) => store.toast((e as Error).message, 'error'));
  }, [refresh, store]);

  const publish = async (mode: 'preview' | 'production') => {
    setBusy(mode);
    try {
      const { deploymentId } = await api.publish(siteId, mode);
      const d = await waitForDeployment(deploymentId, () => refresh().catch(() => undefined));
      await refresh();
      if (d.status === 'failed') store.toast(`Build failed: ${d.error}`, 'error');
      else if (mode === 'preview') window.open(d.url, '_blank');
      else store.toast('Published. The live pointer now points at the new build.');
      return d;
    } catch (e) {
      store.toast((e as Error).message, 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  return { site, deployments, busy, publish, refresh };
}

export function PublishPanel() {
  const siteId = useEditor((s) => s.siteId);
  const version = useEditor((s) => s.doc?.version ?? 0);
  const { site, deployments, busy, publish, refresh } = usePublish(siteId);
  const store = getStore();

  if (!site) return <div className="panel-body muted">Loading…</div>;
  const liveIsStale = site.live && site.live.documentVersion < version;

  return (
    <div className="panel-body">
      <h2>Publish</h2>
      <div className="status-card">
        <div>
          <b>{site.live ? 'Live' : 'Not published yet'}</b>
          {site.live && (
            <div className="muted">
              version {site.live.documentVersion} · {new Date(site.live.finishedAt ?? site.live.createdAt).toLocaleString()}
              {liveIsStale ? ' · unpublished changes' : ''}
            </div>
          )}
        </div>
        {site.live && (
          <a className="button secondary" href={site.liveUrl} target="_blank" rel="noreferrer">
            Open
          </a>
        )}
      </div>
      <div className="row">
        <button className="secondary" disabled={!!busy} onClick={() => publish('preview')}>
          {busy === 'preview' ? 'Building…' : 'Preview'}
        </button>
        <button disabled={!!busy} onClick={() => publish('production')}>
          {busy === 'production' ? 'Building…' : 'Publish'}
        </button>
      </div>
      <p className="hint">Preview builds the current document to a temporary URL. Publish runs the same build and switches the live pointer to it.</p>

      <Section title="Deployments">
        {deployments.length === 0 && <p className="muted">Nothing built yet.</p>}
        {deployments.slice(0, 12).map((d) => {
          const isLive = site.liveDeploymentId === d.id;
          return (
            <div key={d.id} className="deploy-row">
              <div>
                <span className={`pill ${d.status}`}>{d.status}</span> <b>{d.mode}</b> <span className="muted">v{d.documentVersion}</span>
                <div className="muted small">{new Date(d.createdAt).toLocaleString()}{isLive ? ' · live' : ''}{d.error ? ` · ${d.error}` : ''}</div>
              </div>
              <div className="row">
                {d.status === 'ready' && (
                  <a className="link" href={d.url} target="_blank" rel="noreferrer">
                    open
                  </a>
                )}
                {d.status === 'ready' && d.mode === 'production' && !isLive && (
                  <button
                    className="link"
                    onClick={async () => {
                      await api.setLive(siteId, d.id);
                      await refresh();
                      store.toast('Rolled back: live pointer switched.');
                    }}
                  >
                    make live
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      <Domains siteId={siteId} initial={site.domains} />

      <Section title="Webhooks">
        {site.webhooks.map((w) => (
          <div key={w.id} className="deploy-row">
            <span className="mono small">{w.url}</span>
            <button className="link danger" onClick={() => api.removeWebhook(siteId, w.id).then(refresh)}>
              remove
            </button>
          </div>
        ))}
        <button
          className="secondary"
          onClick={async () => {
            const url = prompt('Webhook URL (receives site.published)');
            if (!url) return;
            try {
              await api.addWebhook(siteId, url);
              await refresh();
            } catch (e) {
              store.toast((e as Error).message, 'error');
            }
          }}
        >
          + Webhook
        </button>
      </Section>
    </div>
  );
}

function Domains({ siteId, initial }: { siteId: string; initial: DomainRecord[] }) {
  const store = getStore();
  const [domains, setDomains] = useState<DomainRecord[]>(initial);
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setDomains(initial), [initial]);

  const reload = async () => setDomains((await api.domains(siteId)).domains);

  const add = async () => {
    if (!hostname.trim()) return;
    try {
      await api.addDomain(siteId, hostname.trim());
      setHostname('');
      await reload();
    } catch (e) {
      store.toast((e as Error).message, 'error');
    }
  };

  const verify = async (d: DomainRecord) => {
    setBusy(d.id);
    try {
      const { domain } = await api.verifyDomain(siteId, d.id);
      await reload();
      store.toast(domain.status === 'active' ? `${domain.hostname} is live with HTTPS. Publish again to bake it into the build.` : domain.error ?? domain.status, domain.status === 'active' ? 'info' : 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Custom domains">
      <div className="row">
        <input value={hostname} placeholder="www.yourdomain.com" inputMode="url" autoCapitalize="none" onChange={(e) => setHostname(e.target.value)} />
        <button className="secondary" onClick={add}>
          Add
        </button>
      </div>
      {domains.map((d) => (
        <div key={d.id} className="domain-card">
          <div className="row between">
            <b>{d.hostname}</b>
            <span className={`pill ${d.status}`}>{d.status.replace('_', ' ')}</span>
          </div>
          {d.status !== 'active' && (
            <>
              <p className="hint">Add these DNS records at your registrar, then tap Verify. We check them, then issue a certificate automatically.</p>
              <table className="dns">
                <tbody>
                  {d.records.map((r, i) => (
                    <tr key={i}>
                      <td>{r.type}</td>
                      <td className="mono">{r.name}</td>
                      <td className="mono">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {d.certificate && (
            <p className="muted small">
              Certificate by {d.certificate.issuer}, renews before {d.certificate.notAfter.slice(0, 10)}.
            </p>
          )}
          {d.error && <p className="error">{d.error}</p>}
          <div className="row">
            <button className="secondary small" disabled={busy === d.id} onClick={() => verify(d)}>
              {busy === d.id ? 'Checking…' : d.status === 'active' ? 'Re-check' : 'Verify'}
            </button>
            <button className="link danger" onClick={() => api.removeDomain(siteId, d.id).then(reload)}>
              remove
            </button>
          </div>
        </div>
      ))}
    </Section>
  );
}
