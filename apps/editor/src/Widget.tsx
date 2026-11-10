import { usePublish } from './panels/Publish.js';
import { useEditor } from './state/store.js';

/**
 * Compact "widget" view for the home screen shortcut: status at a glance and
 * one-tap Publish / Preview. Opened via `/?view=widget` (an app shortcut in
 * the manifest, so on Android it is on the icon's long-press menu).
 */
export function Widget() {
  const siteId = useEditor((s) => s.siteId);
  const name = useEditor((s) => s.doc?.name ?? '…');
  const version = useEditor((s) => s.doc?.version ?? 0);
  const { site, busy, publish } = usePublish(siteId);
  const stale = !!site?.live && site.live.documentVersion < version;
  return (
    <div className="widget">
      <div className="widget-head">
        <img src="/icons/icon-192.png" alt="" width={36} height={36} />
        <div>
          <b>{name}</b>
          <div className="muted small">
            {site?.live ? (stale ? 'Unpublished changes' : 'Up to date') : 'Not published'}
            {site?.live ? ` · v${site.live.documentVersion}` : ''}
          </div>
        </div>
      </div>
      <button className="big" disabled={!!busy} onClick={() => publish('production')}>
        {busy === 'production' ? 'Publishing…' : 'Publish now'}
      </button>
      <button className="big secondary" disabled={!!busy} onClick={() => publish('preview')}>
        {busy === 'preview' ? 'Building…' : 'Preview'}
      </button>
      <div className="row between">
        {site?.live ? (
          <a className="link" href={site.liveUrl} target="_blank" rel="noreferrer">
            Open live site
          </a>
        ) : (
          <span />
        )}
        <a className="link" href="/">
          Open editor
        </a>
      </div>
    </div>
  );
}
