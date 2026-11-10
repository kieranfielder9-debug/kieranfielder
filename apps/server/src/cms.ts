import path from 'node:path';
import { CmsIndex, newId, slugify, validateItem, FIELD_TYPES, type Collection, type Field, type FieldType, type Item, type CmsSnapshot } from '@studio/core';
import { HttpError, JsonFile, nowIso } from './util.js';

interface CmsState {
  collections: Collection[];
  items: Item[];
}

/**
 * CMS storage, kept apart from the design document. This file-backed store
 * mirrors the Postgres schema in `apps/server/sql/cms.sql` (collections,
 * fields, items with JSONB values) so it can be swapped for a real database
 * without touching the API or the compiler.
 */
export class CmsStore {
  private file!: JsonFile<CmsState>;

  constructor(private dir: string, private siteId: string) {}

  async init(seed?: CmsSnapshot): Promise<void> {
    this.file = await JsonFile.load<CmsState>(path.join(this.dir, `${this.siteId}.json`), () => ({
      collections: seed?.collections ?? [],
      items: seed?.items ?? [],
    }));
  }

  snapshot(): CmsSnapshot {
    return structuredClone({ collections: this.file.value.collections, items: this.file.value.items });
  }

  index(): CmsIndex {
    return new CmsIndex(this.file.value.collections, this.file.value.items);
  }

  listCollections(): Collection[] {
    return this.file.value.collections;
  }

  getCollection(idOrSlug: string): Collection {
    const c = this.file.value.collections.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
    if (!c) throw new HttpError(404, 'collection not found');
    return c;
  }

  createCollection(input: { name: string; slug?: string; fields?: Partial<Field>[] }): Collection {
    if (!input.name?.trim()) throw new HttpError(422, 'name is required');
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (this.file.value.collections.some((c) => c.slug === slug)) throw new HttpError(409, `collection slug "${slug}" already exists`);
    const now = nowIso();
    const collection: Collection = { id: newId('col'), name: input.name.trim(), slug, fields: [], createdAt: now, updatedAt: now };
    for (const f of input.fields ?? []) collection.fields.push(this.normalizeField(collection, f));
    this.file.value.collections.push(collection);
    this.file.save();
    return collection;
  }

  updateCollection(id: string, patch: { name?: string; slug?: string; fields?: Partial<Field>[] }): Collection {
    const c = this.getCollection(id);
    if (patch.name !== undefined) c.name = patch.name.trim() || c.name;
    if (patch.slug !== undefined) {
      const slug = slugify(patch.slug);
      if (this.file.value.collections.some((x) => x.id !== c.id && x.slug === slug)) throw new HttpError(409, 'slug already used');
      c.slug = slug;
    }
    if (patch.fields) {
      const next: Field[] = [];
      for (const f of patch.fields) next.push(this.normalizeField({ ...c, fields: next }, f));
      c.fields = next;
    }
    c.updatedAt = nowIso();
    this.file.save();
    return c;
  }

  deleteCollection(id: string): void {
    const c = this.getCollection(id);
    this.file.value.collections = this.file.value.collections.filter((x) => x.id !== c.id);
    this.file.value.items = this.file.value.items.filter((x) => x.collectionId !== c.id);
    this.file.save();
  }

  listItems(collectionId: string): Item[] {
    const c = this.getCollection(collectionId);
    return this.file.value.items.filter((i) => i.collectionId === c.id);
  }

  getItem(collectionId: string, itemId: string): Item {
    const c = this.getCollection(collectionId);
    const it = this.file.value.items.find((i) => i.id === itemId && i.collectionId === c.id);
    if (!it) throw new HttpError(404, 'item not found');
    return it;
  }

  createItem(collectionId: string, values: Record<string, unknown>): Item {
    const c = this.getCollection(collectionId);
    const filled = this.withDefaults(c, values);
    const result = validateItem(c, filled, this.index().validation());
    if (!result.ok) throw new HttpError(422, 'validation failed', result.errors);
    const now = nowIso();
    const item: Item = { id: newId('it'), collectionId: c.id, values: filled, createdAt: now, updatedAt: now };
    this.file.value.items.push(item);
    this.file.save();
    return item;
  }

  patchItem(collectionId: string, itemId: string, values: Record<string, unknown>): Item {
    const c = this.getCollection(collectionId);
    const item = this.getItem(c.id, itemId);
    const merged = { ...item.values, ...values };
    const result = validateItem(c, merged, this.index().validation(), item.id);
    if (!result.ok) throw new HttpError(422, 'validation failed', result.errors);
    item.values = merged;
    item.updatedAt = nowIso();
    this.file.save();
    return item;
  }

  deleteItem(collectionId: string, itemId: string): void {
    const item = this.getItem(collectionId, itemId);
    this.file.value.items = this.file.value.items.filter((i) => i.id !== item.id);
    this.file.save();
  }

  async close(): Promise<void> {
    await this.file.close();
  }

  private withDefaults(c: Collection, values: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of c.fields) {
      const v = values[f.slug];
      if (v !== undefined) out[f.slug] = v;
      else if (f.type === 'slug' && typeof values.title === 'string') out[f.slug] = slugify(values.title);
    }
    for (const k of Object.keys(values)) if (!(k in out)) out[k] = values[k];
    return out;
  }

  private normalizeField(c: Collection, f: Partial<Field>): Field {
    if (!f.name?.trim()) throw new HttpError(422, 'field name is required');
    const type = (f.type ?? 'text') as FieldType;
    if (!FIELD_TYPES[type]) throw new HttpError(422, `unknown field type "${type}"`);
    const slug = f.slug ? slugify(f.slug) : slugify(f.name);
    if (c.fields.some((x) => x.slug === slug && x.id !== f.id)) throw new HttpError(409, `field slug "${slug}" already exists`);
    if (type === 'reference') {
      if (!f.referenceCollectionId) throw new HttpError(422, 'reference fields need referenceCollectionId');
      this.getCollection(f.referenceCollectionId);
    }
    return { id: f.id ?? newId('f'), name: f.name.trim(), slug, type, required: !!f.required, referenceCollectionId: f.referenceCollectionId };
  }
}
