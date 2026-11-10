import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Widget } from './Widget.js';
import { api } from './api.js';
import { initStore, type Panel } from './state/store.js';
import { LiveSync } from './sync.js';
import { refreshCms } from './panels/Cms.js';
import './styles.css';

async function boot() {
  const params = new URLSearchParams(location.search);
  let siteId = params.get('site') ?? localStorage.getItem('studio:lastSite') ?? '';
  if (!siteId) {
    try {
      const { documents } = await api.listDocuments();
      siteId = documents[0]?.id ?? 'site_demo';
    } catch {
      siteId = 'site_demo';
    }
  }
  localStorage.setItem('studio:lastSite', siteId);

  const store = initStore(siteId);
  const panel = params.get('panel') as Panel | null;
  if (panel && ['canvas', 'layers', 'inspect', 'cms', 'publish'].includes(panel)) store.set({ panel });
  if (window.matchMedia('(min-width: 900px)').matches) store.set({ breakpoint: 'desktop', viewport: { x: 40, y: 40, zoom: 0.4 } });

  const sync = new LiveSync(store, siteId);
  await sync.start();
  refreshCms(siteId).catch(() => undefined);

  const widget = params.get('view') === 'widget';
  createRoot(document.getElementById('root')!).render(<React.StrictMode>{widget ? <Widget /> : <App />}</React.StrictMode>);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }
}

void boot();
