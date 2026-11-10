import { useEffect, useState } from 'react';
import { FIELD_TYPES, isRichText, richToPlain, type Collection, type Field, type FieldType, type Item } from '@studio/core';
import { api, ApiError } from '../api.js';
import { getStore, useEditor } from '../state/store.js';
import { RichTextEditor } from '../components/RichTextEditor.js';
import { Field as FieldRow } from './Inspector.js';

/** Loads every collection and its items into the store so the canvas can show real content. */
export async function refreshCms(siteId: string): Promise<void> {
  const store = getStore();
  const { collections } = await api.listCollections(siteId);
  const items: Item[] = [];
  for (const c of collections) items.push(...(await api.listItems(siteId, c.id)).items);
  store.set({ cms: { collections, items } });
}

export function CmsPanel() {
  const siteId = useEditor((s) => s.siteId);
  const cms = useEditor((s) => s.cms);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [view, setView] = useState<'items' | 'schema'>('items');
  const [itemId, setItemId] = useState<string | 'new' | null>(null);
  const store = getStore();

  useEffect(() => {
    refreshCms(siteId).catch((e) => store.toast(`CMS: ${(e as Error).message}`, 'error'));
  }, [siteId, store]);

  const collection = cms.collections.find((c) => c.id === collectionId) ?? null;

  const createCollection = async () => {
    const name = prompt('Collection name', 'Projects');
    if (!name) return;
    try {
      const { collection } = await api.createCollection(siteId, { name, fields: [{ name: 'Title', type: 'text', required: true }, { name: 'Slug', type: 'slug', required: true }] });
      await refreshCms(siteId);
      setCollectionId(collection.id);
      setView('schema');
    } catch (e) {
      store.toast((e as Error).message, 'error');
    }
  };

  if (!collection) {
    return (
      <div className="panel-body">
        <div className="panel-title">
          <h2>Collections</h2>
          <button className="secondary small" onClick={createCollection}>
            + Collection
          </button>
        </div>
        {cms.collections.length === 0 && <p className="muted">No collections yet. Collections hold structured content that pages and templates bind to.</p>}
        {cms.collections.map((c) => (
          <button key={c.id} className="row-btn" onClick={() => (setCollectionId(c.id), setItemId(null), setView('items'))}>
            {c.name} <span className="muted">{cms.items.filter((i) => i.collectionId === c.id).length} items · {c.fields.length} fields</span>
          </button>
        ))}
      </div>
    );
  }

  if (itemId) {
    const item = itemId === 'new' ? null : cms.items.find((i) => i.id === itemId) ?? null;
    return <ItemForm siteId={siteId} collection={collection} item={item} onDone={() => setItemId(null)} />;
  }

  return (
    <div className="panel-body">
      <button className="link back" onClick={() => setCollectionId(null)}>
        ‹ Collections
      </button>
      <div className="panel-title">
        <h2>{collection.name}</h2>
        <div className="seg small">
          <button className={view === 'items' ? 'on' : ''} onClick={() => setView('items')}>
            Items
          </button>
          <button className={view === 'schema' ? 'on' : ''} onClick={() => setView('schema')}>
            Fields
          </button>
        </div>
      </div>
      {view === 'schema' ? (
        <SchemaEditor siteId={siteId} collection={collection} all={cms.collections} onDeleted={() => setCollectionId(null)} />
      ) : (
        <>
          <button className="secondary" onClick={() => setItemId('new')}>
            + New item
          </button>
          {cms.items
            .filter((i) => i.collectionId === collection.id)
            .map((i) => (
              <button key={i.id} className="row-btn" onClick={() => setItemId(i.id)}>
                {itemTitle(collection, i)}
                <span className="muted">{i.updatedAt.slice(0, 10)}</span>
              </button>
            ))}
        </>
      )}
    </div>
  );
}

function itemTitle(c: Collection, item: Item): string {
  const first = c.fields.find((f) => f.type === 'text' || f.type === 'slug');
  const v = first ? item.values[first.slug] : undefined;
  return typeof v === 'string' && v ? v : item.id;
}

function SchemaEditor({ siteId, collection, all, onDeleted }: { siteId: string; collection: Collection; all: Collection[]; onDeleted: () => void }) {
  const [fields, setFields] = useState<Partial<Field>[]>(collection.fields);
  const [saving, setSaving] = useState(false);
  const store = getStore();
  useEffect(() => setFields(collection.fields), [collection]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateCollection(siteId, collection.id, { fields });
      await refreshCms(siteId);
      store.toast('Fields saved');
    } catch (e) {
      store.toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const update = (i: number, patch: Partial<Field>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div>
      {fields.map((f, i) => (
        <div key={f.id ?? i} className="field-card">
          <div className="row">
            <input value={f.name ?? ''} placeholder="Field name" onChange={(e) => update(i, { name: e.target.value })} />
            <select value={f.type ?? 'text'} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
              {Object.values(FIELD_TYPES).map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} /> Required
            </label>
            {f.type === 'reference' && (
              <select value={f.referenceCollectionId ?? ''} onChange={(e) => update(i, { referenceCollectionId: e.target.value })}>
                <option value="">Target collection…</option>
                {all.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button className="link danger" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
              remove
            </button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="secondary" onClick={() => setFields([...fields, { name: '', type: 'text' }])}>
          + Field
        </button>
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save fields'}
        </button>
      </div>
      <button
        className="link danger"
        onClick={async () => {
          if (!confirm(`Delete collection "${collection.name}" and all its items?`)) return;
          await api.deleteCollection(siteId, collection.id);
          await refreshCms(siteId);
          onDeleted();
        }}
      >
        Delete collection
      </button>
    </div>
  );
}

function ItemForm({ siteId, collection, item, onDone }: { siteId: string; collection: Collection; item: Item | null; onDone: () => void }) {
  const cms = useEditor((s) => s.cms);
  const store = getStore();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of collection.fields) v[f.slug] = item?.values[f.slug] ?? FIELD_TYPES[f.type].defaultValue();
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (slug: string, v: unknown) => setValues((prev) => ({ ...prev, [slug]: v }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (item) await api.patchItem(siteId, collection.id, item.id, values);
      else await api.createItem(siteId, collection.id, values);
      await refreshCms(siteId);
      store.toast(item ? 'Item saved' : 'Item created');
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.details as Record<string, string>);
      store.toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const widget = (f: Field) => {
    const v = values[f.slug];
    const def = FIELD_TYPES[f.type];
    switch (def.widget) {
      case 'richtext':
        return <RichTextEditor value={isRichText(v) ? v : undefined} onChange={(rt) => set(f.slug, rt)} />;
      case 'number':
        return <input type="number" inputMode="decimal" value={typeof v === 'number' ? v : ''} onChange={(e) => set(f.slug, e.target.value === '' ? undefined : Number(e.target.value))} />;
      case 'checkbox':
        return <input type="checkbox" checked={!!v} onChange={(e) => set(f.slug, e.target.checked)} />;
      case 'date':
        return <input type="date" value={typeof v === 'string' ? v.slice(0, 10) : ''} onChange={(e) => set(f.slug, e.target.value)} />;
      case 'color':
        return (
          <div className="row">
            <input type="color" value={typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'} onChange={(e) => set(f.slug, e.target.value)} />
            <input value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.slug, e.target.value)} />
          </div>
        );
      case 'image': {
        const img = (v && typeof v === 'object' ? v : { src: '', alt: '' }) as { src: string; alt?: string };
        return (
          <div className="stack">
            {img.src && <img className="thumb" src={img.src} alt="" />}
            <input value={img.src} placeholder="Image URL" onChange={(e) => set(f.slug, { ...img, src: e.target.value })} />
            <input value={img.alt ?? ''} placeholder="Alt text" onChange={(e) => set(f.slug, { ...img, alt: e.target.value })} />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 800 * 1024) return store.toast('Keep inline images under 800 KB', 'error');
                const reader = new FileReader();
                reader.onload = () => set(f.slug, { ...img, src: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </div>
        );
      }
      case 'reference': {
        const target = cms.collections.find((c) => c.id === f.referenceCollectionId);
        return (
          <select value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.slug, e.target.value)}>
            <option value="">— none —</option>
            {target &&
              cms.items.filter((i) => i.collectionId === target.id).map((i) => (
                <option key={i.id} value={i.id}>
                  {itemTitle(target, i)}
                </option>
              ))}
          </select>
        );
      }
      case 'slug':
        return <input value={typeof v === 'string' ? v : ''} placeholder="my-item" onChange={(e) => set(f.slug, e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} />;
      default:
        return <input value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.slug, e.target.value)} />;
    }
  };

  return (
    <div className="panel-body">
      <button className="link back" onClick={onDone}>
        ‹ {collection.name}
      </button>
      <h2>{item ? itemTitle(collection, item) : 'New item'}</h2>
      {collection.fields.map((f) => (
        <div key={f.id} className={errors[f.slug] ? 'invalid' : ''}>
          <FieldRow label={`${f.name}${f.required ? ' *' : ''}`}>{widget(f)}</FieldRow>
          {errors[f.slug] && <p className="error">{errors[f.slug]}</p>}
        </div>
      ))}
      <div className="row">
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {item && (
          <button
            className="danger"
            onClick={async () => {
              if (!confirm('Delete this item?')) return;
              await api.deleteItem(siteId, collection.id, item.id);
              await refreshCms(siteId);
              onDone();
            }}
          >
            Delete
          </button>
        )}
      </div>
      {item && <p className="muted">{richToPlain(undefined) || `id ${item.id}`}</p>}
    </div>
  );
}
