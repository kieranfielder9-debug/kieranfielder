import { useMemo } from 'react';
import {
  FONT_CATALOG,
  emptyRichText,
  ops,
  plainToRich,
  resolveProps,
  subtreeIds,
  type BindableProp,
  type Binding,
  type Collection,
  type DocNode,
  type Layout,
  type NodeProps,
  type Page,
  type Size,
  type StackLayout,
} from '@studio/core';
import { getStore, useEditor } from '../state/store.js';
import { RichTextEditor } from '../components/RichTextEditor.js';

/** Every `collection.field` pair a prop can be bound to, one level of references deep. */
function bindingOptions(collections: Collection[]): { value: string; label: string; binding: Binding }[] {
  const out: { value: string; label: string; binding: Binding }[] = [];
  for (const c of collections) {
    for (const f of c.fields) {
      out.push({ value: `${c.slug}.${f.slug}`, label: `${c.name} › ${f.name}`, binding: { collection: c.slug, field: f.slug } });
      if (f.type === 'reference' && f.referenceCollectionId) {
        const target = collections.find((x) => x.id === f.referenceCollectionId);
        for (const tf of target?.fields ?? []) out.push({ value: `${c.slug}.${f.slug}.${tf.slug}`, label: `${c.name} › ${f.name} › ${tf.name}`, binding: { collection: c.slug, field: `${f.slug}.${tf.slug}` } });
      }
    }
  }
  return out;
}

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const bp = useEditor((s) => s.breakpoint);
  const collections = useEditor((s) => s.cms.collections);
  const store = getStore();
  const options = useMemo(() => bindingOptions(collections), [collections]);

  if (!doc) return null;
  const node = selection ? doc.nodes[selection] : null;
  if (!node) {
    return (
      <div className="panel-body">
        <h2>Site</h2>
        <Field label="Site name">
          <input value={doc.name} onChange={(e) => store.apply([ops.renameDocument(e.target.value)])} />
        </Field>
        <p className="muted">Tap a layer on the canvas to edit it. Double-tap to jump straight here.</p>
        <h3>Pages</h3>
        {doc.pageOrder.map((id) => (
          <button key={id} className="row-btn" onClick={() => store.select(doc.pages[id].rootId)}>
            {doc.pages[id].name} <span className="muted">{doc.pages[id].path}</span>
          </button>
        ))}
      </div>
    );
  }

  const props = resolveProps(node, bp);
  const overridesHere = (bp !== 'desktop' ? node.overrides[bp] : undefined) ?? {};
  const set = (patch: Partial<NodeProps>) => store.apply([ops.updateNode(node.id, patch, { breakpoint: bp })]);
  const isOv = (k: keyof NodeProps) => bp !== 'desktop' && k in overridesHere;
  const reset = (k: keyof NodeProps) => store.apply([ops.updateNode(node.id, { [k]: undefined }, { breakpoint: bp })]);
  const page = Object.values(doc.pages).find((p) => p.rootId === node.id);
  const parent = node.parentId ? doc.nodes[node.parentId] : null;
  const parentLayout = parent ? resolveProps(parent, bp).layout : undefined;
  const free = !!parent && (!parentLayout || parentLayout.type === 'none');
  const isMaster = Object.values(doc.components).some((c) => c.rootId === node.id);
  const component = node.type === 'instance' && node.componentId ? doc.components[node.componentId] : null;

  const bindRow = (prop: BindableProp) => {
    const current = node.bindings?.[prop];
    const value = current ? `${current.collection}.${current.field}` : '';
    return (
      <Field label={`Bind ${prop}`} key={prop}>
        <select value={value} onChange={(e) => store.apply([ops.bindProp(node.id, prop, options.find((o) => o.value === e.target.value)?.binding ?? null)])}>
          <option value="">Not bound</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  };

  return (
    <div className="panel-body">
      <div className="insp-head">
        <span className={`badge ${node.type}`}>{isMaster ? 'component' : node.type}</span>
        <input className="name" value={props.name ?? ''} placeholder={node.type} onChange={(e) => set({ name: e.target.value })} />
        {!page && !isMaster && (
          <button className="danger" onClick={() => store.apply([ops.deleteNode(node.id)])} aria-label="Delete">
            ✕
          </button>
        )}
      </div>
      {bp !== 'desktop' && (
        <p className="hint">
          Editing <b>{bp}</b> overrides. Values marked <span className="ov">●</span> override the desktop base.
        </p>
      )}

      {page && <PageSettings page={page} options={options} />}

      {node.type !== 'instance' && !isMaster && !page && (
        <button className="secondary" onClick={() => store.apply([ops.createComponent(node.id, props.name || 'Component')])}>
          Make component
        </button>
      )}
      {component && <InstanceOverrides node={node} />}

      {(node.type === 'frame' || isMaster) && !component && (
        <Section title="Layout">
          <Field label="Mode" ov={isOv('layout')} onReset={() => reset('layout')}>
            <select
              value={props.layout?.type ?? 'none'}
              onChange={(e) =>
                set({
                  layout: e.target.value === 'stack' ? ({ direction: 'vertical', gap: 12, padding: 16, align: 'stretch', justify: 'start', ...((props.layout as Partial<StackLayout>) ?? {}), type: 'stack' } as Layout) : { type: 'none', padding: props.layout?.padding },
                })
              }
            >
              <option value="none">Free (absolute)</option>
              <option value="stack">Stack (auto-layout)</option>
            </select>
          </Field>
          {props.layout?.type === 'stack' && <StackControls layout={props.layout} onChange={(l) => set({ layout: l })} />}
        </Section>
      )}

      <Section title="Size & position">
        <div className="grid2">
          <SizeInput label="Width" value={props.width} ov={isOv('width')} onChange={(v) => set({ width: v })} onReset={() => reset('width')} />
          <SizeInput label="Height" value={props.height} ov={isOv('height')} onChange={(v) => set({ height: v })} onReset={() => reset('height')} />
        </div>
        {free && (
          <div className="grid2">
            <NumInput label="X" value={props.x ?? 0} ov={isOv('x')} onChange={(v) => set({ x: v })} />
            <NumInput label="Y" value={props.y ?? 0} ov={isOv('y')} onChange={(v) => set({ y: v })} />
          </div>
        )}
        {!free && parent && <p className="hint">Position is managed by the parent stack. Reorder it in Layers.</p>}
        {node.type === 'frame' && <NumInput label="Min height" value={props.minHeight ?? 0} ov={isOv('minHeight')} onChange={(v) => set({ minHeight: v || undefined })} />}
      </Section>

      {node.type === 'text' && (
        <Section title="Text">
          {!node.bindings?.text && <RichTextEditor value={props.text ?? emptyRichText()} onChange={(text) => store.apply([ops.setText(node.id, text)])} />}
          {bindRow('text')}
          <Field label="Font" ov={isOv('fontFamily')} onReset={() => reset('fontFamily')}>
            <select value={props.fontFamily ?? 'System'} onChange={(e) => set({ fontFamily: e.target.value === 'System' ? undefined : e.target.value })}>
              {FONT_CATALOG.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.family} ({f.provider === 'self' ? 'self-hosted' : f.provider})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <NumInput label="Size" value={props.fontSize ?? 16} ov={isOv('fontSize')} onChange={(v) => set({ fontSize: v })} />
            <Field label="Weight" ov={isOv('fontWeight')}>
              <select value={props.fontWeight ?? 400} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
                {[300, 400, 500, 600, 700, 800].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <NumInput label="Line height" value={props.lineHeight ?? 1.4} step={0.05} ov={isOv('lineHeight')} onChange={(v) => set({ lineHeight: v })} />
            <Field label="Align" ov={isOv('textAlign')}>
              <select value={props.textAlign ?? 'left'} onChange={(e) => set({ textAlign: e.target.value as NodeProps['textAlign'] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Field>
          </div>
          <ColorInput label="Color" value={props.color ?? '#111111'} ov={isOv('color')} onChange={(v) => set({ color: v })} />
        </Section>
      )}

      {node.type === 'image' && (
        <Section title="Image">
          <Field label="Source URL">
            <input value={props.src ?? ''} placeholder="https://…" onChange={(e) => set({ src: e.target.value })} />
          </Field>
          {bindRow('src')}
          <Field label="Alt text">
            <input value={props.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} />
          </Field>
          {bindRow('alt')}
          <Field label="Fit" ov={isOv('objectFit')}>
            <select value={props.objectFit ?? 'cover'} onChange={(e) => set({ objectFit: e.target.value as 'cover' | 'contain' })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </Field>
        </Section>
      )}

      {node.type !== 'instance' && (
        <Section title="Appearance">
          {node.type !== 'image' && <ColorInput label="Fill" value={props.fill ?? ''} ov={isOv('fill')} onChange={(v) => set({ fill: v || undefined })} allowEmpty />}
          {node.type === 'frame' && bindRow('fill')}
          <div className="grid2">
            <NumInput label="Radius" value={props.radius ?? 0} ov={isOv('radius')} onChange={(v) => set({ radius: v })} />
            <NumInput label="Opacity" value={props.opacity ?? 1} step={0.05} min={0} max={1} ov={isOv('opacity')} onChange={(v) => set({ opacity: v })} />
          </div>
          <Field label="Border" ov={isOv('border')}>
            <input value={props.border ?? ''} placeholder="1px solid #e5e7eb" onChange={(e) => set({ border: e.target.value || undefined })} />
          </Field>
          <Field label="Shadow" ov={isOv('shadow')}>
            <input value={props.shadow ?? ''} placeholder="0 8px 24px rgba(0,0,0,.12)" onChange={(e) => set({ shadow: e.target.value || undefined })} />
          </Field>
          {node.type === 'frame' && (
            <label className="check">
              <input type="checkbox" checked={!!props.clip} onChange={(e) => set({ clip: e.target.checked })} /> Clip content
            </label>
          )}
        </Section>
      )}

      <Section title="Behaviour">
        <Field label="Link to">
          <input value={props.link ?? ''} placeholder="/about or https://…" onChange={(e) => set({ link: e.target.value || undefined })} />
        </Field>
        {node.type === 'frame' && bindRow('link')}
        {node.type === 'frame' && !page && (
          <Field label="HTML tag">
            <select value={props.tag ?? 'div'} onChange={(e) => set({ tag: e.target.value as NodeProps['tag'] })}>
              {['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}
        <label className="check">
          <input type="checkbox" checked={props.visible !== false} onChange={(e) => set({ visible: e.target.checked ? undefined : false })} /> Visible on {bp}
        </label>
        {node.type === 'frame' && !page && (
          <>
            <Field label="Repeat for each item in">
              <select value={props.repeat?.collection ?? ''} onChange={(e) => set({ repeat: e.target.value ? { collection: e.target.value, limit: props.repeat?.limit } : undefined })}>
                <option value="">Don't repeat</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {props.repeat && <NumInput label="Limit" value={props.repeat.limit ?? 0} onChange={(v) => set({ repeat: { ...props.repeat!, limit: v || undefined } })} />}
          </>
        )}
      </Section>
    </div>
  );
}

function PageSettings({ page, options }: { page: Page; options: ReturnType<typeof bindingOptions> }) {
  const doc = useEditor((s) => s.doc)!;
  const collections = useEditor((s) => s.cms.collections);
  const store = getStore();
  const update = (patch: Partial<Omit<Page, 'id' | 'rootId'>>) => store.apply([ops.updatePage(page.id, patch)]);
  const seo = page.seo ?? {};
  const seoField = (key: 'title' | 'description' | 'ogImage', label: string) => {
    const v = seo[key];
    const bound = v && typeof v === 'object';
    return (
      <Field label={label} key={key}>
        <div className="row">
          <input value={bound ? '' : (v as string) ?? ''} placeholder={bound ? '(bound to CMS)' : ''} disabled={!!bound} onChange={(e) => update({ seo: { ...seo, [key]: e.target.value || undefined } })} />
          <select value={bound ? `${(v as Binding).collection}.${(v as Binding).field}` : ''} onChange={(e) => update({ seo: { ...seo, [key]: options.find((o) => o.value === e.target.value)?.binding } })}>
            <option value="">Static</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Field>
    );
  };
  return (
    <Section title="Page">
      <Field label="Name">
        <input value={page.name} onChange={(e) => update({ name: e.target.value })} />
      </Field>
      <Field label="Path">
        <input value={page.path} placeholder="/about or /blog/:slug" onChange={(e) => update({ path: e.target.value })} />
      </Field>
      <Field label="Generate one page per item in">
        <select value={page.collectionId ?? ''} onChange={(e) => update({ collectionId: e.target.value || undefined, path: e.target.value && !page.path.includes(':') ? `${page.path.replace(/\/$/, '')}/:slug` : page.path })}>
          <option value="">Static page</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {page.collectionId && <p className="hint">Use :slug (or any field slug) in the path; each item becomes a page.</p>}
      <h4>SEO</h4>
      {seoField('title', 'Title')}
      {seoField('description', 'Description')}
      {seoField('ogImage', 'Social image')}
      <label className="check">
        <input type="checkbox" checked={!!seo.noIndex} onChange={(e) => update({ seo: { ...seo, noIndex: e.target.checked || undefined } })} /> Hide from search engines
      </label>
      {doc.pageOrder.length > 1 && (
        <button className="danger" onClick={() => confirm(`Delete page "${page.name}"?`) && store.apply([ops.deletePage(page.id)])}>
          Delete page
        </button>
      )}
    </Section>
  );
}

function InstanceOverrides({ node }: { node: DocNode }) {
  const doc = useEditor((s) => s.doc)!;
  const store = getStore();
  const comp = doc.components[node.componentId!];
  const ids = subtreeIds(doc, comp.rootId);
  const overrides = node.instanceOverrides ?? {};
  const setOv = (path: string, value: unknown) => store.apply([ops.setOverride(node.id, path, value)]);
  return (
    <Section title={`Instance of ${comp.name}`}>
      <p className="hint">Edits to the master update every instance; overrides below apply to this one only.</p>
      <div className="row">
        <button className="secondary" onClick={() => store.select(comp.rootId)}>
          Edit master
        </button>
        <button className="secondary" onClick={() => store.apply([ops.detachInstance(node.id)])}>
          Detach
        </button>
      </div>
      {ids.map((id) => {
        const n = doc.nodes[id];
        if (n.type === 'text') {
          const path = `${id}.text`;
          const has = path in overrides;
          return (
            <Field key={path} label={`${n.props.name ?? 'Text'} text`} ov={has} onReset={has ? () => setOv(path, undefined) : undefined}>
              <RichTextEditor value={(has ? overrides[path] : n.props.text) as NodeProps['text']} onChange={(v) => setOv(path, v)} />
            </Field>
          );
        }
        if (n.type === 'frame') {
          const path = `${id}.fill`;
          const has = path in overrides;
          return <ColorInput key={path} label={`${n.props.name ?? 'Frame'} fill`} value={(has ? (overrides[path] as string) : n.props.fill) ?? ''} ov={has} onChange={(v) => setOv(path, v)} onReset={has ? () => setOv(path, undefined) : undefined} allowEmpty />;
        }
        if (n.type === 'image') {
          const path = `${id}.src`;
          const has = path in overrides;
          return (
            <Field key={path} label={`${n.props.name ?? 'Image'} source`} ov={has} onReset={has ? () => setOv(path, undefined) : undefined}>
              <input value={(has ? (overrides[path] as string) : n.props.src) ?? ''} onChange={(e) => setOv(path, e.target.value)} />
            </Field>
          );
        }
        return null;
      })}
    </Section>
  );
}

function StackControls({ layout, onChange }: { layout: StackLayout; onChange: (l: StackLayout) => void }) {
  const pad = typeof layout.padding === 'number' ? layout.padding : layout.padding[0];
  return (
    <>
      <div className="seg">
        <button className={layout.direction === 'vertical' ? 'on' : ''} onClick={() => onChange({ ...layout, direction: 'vertical' })}>
          ↓ Vertical
        </button>
        <button className={layout.direction === 'horizontal' ? 'on' : ''} onClick={() => onChange({ ...layout, direction: 'horizontal' })}>
          → Horizontal
        </button>
      </div>
      <div className="grid2">
        <NumInput label="Gap" value={layout.gap} onChange={(v) => onChange({ ...layout, gap: v })} />
        <NumInput label="Padding" value={pad} onChange={(v) => onChange({ ...layout, padding: v })} />
        <Field label="Align">
          <select value={layout.align} onChange={(e) => onChange({ ...layout, align: e.target.value as StackLayout['align'] })}>
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="stretch">Stretch</option>
          </select>
        </Field>
        <Field label="Distribute">
          <select value={layout.justify} onChange={(e) => onChange({ ...layout, justify: e.target.value as StackLayout['justify'] })}>
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="space-between">Space between</option>
          </select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!layout.wrap} onChange={(e) => onChange({ ...layout, wrap: e.target.checked })} /> Wrap
      </label>
    </>
  );
}

// ---- Small controls ----

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="section" open>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Field({ label, children, ov, onReset }: { label: string; children: React.ReactNode; ov?: boolean; onReset?: () => void }) {
  return (
    <label className="field">
      <span className="label">
        {ov && <span className="ov">●</span>} {label}
        {ov && onReset && (
          <button className="link" onClick={(e) => (e.preventDefault(), onReset())}>
            reset
          </button>
        )}
      </span>
      {children}
    </label>
  );
}

function NumInput({ label, value, onChange, step = 1, min, max, ov }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; ov?: boolean }) {
  return (
    <Field label={label} ov={ov}>
      <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

function SizeInput({ label, value, onChange, ov, onReset }: { label: string; value: Size | undefined; onChange: (v: Size | undefined) => void; ov?: boolean; onReset?: () => void }) {
  const mode = value === 'fill' || value === 'hug' ? value : value === undefined ? 'auto' : 'px';
  return (
    <Field label={label} ov={ov} onReset={onReset}>
      <div className="row">
        <select value={mode} onChange={(e) => onChange(e.target.value === 'px' ? (typeof value === 'number' ? value : 200) : e.target.value === 'auto' ? undefined : (e.target.value as Size))}>
          <option value="auto">Auto</option>
          <option value="px">Fixed</option>
          <option value="fill">Fill</option>
          <option value="hug">Hug</option>
        </select>
        {mode === 'px' && <input type="number" inputMode="numeric" value={value as number} onChange={(e) => onChange(Number(e.target.value))} />}
      </div>
    </Field>
  );
}

function ColorInput({ label, value, onChange, ov, allowEmpty, onReset }: { label: string; value: string; onChange: (v: string) => void; ov?: boolean; allowEmpty?: boolean; onReset?: () => void }) {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Field label={label} ov={ov} onReset={onReset}>
      <div className="row">
        <input type="color" value={isHex ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
        <input value={value} placeholder={allowEmpty ? 'none' : ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

export function defaultText(): NodeProps['text'] {
  return plainToRich('New text');
}
