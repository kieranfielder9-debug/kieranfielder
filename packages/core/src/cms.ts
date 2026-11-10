import type { Collection, Field, FieldType, ImageValue, Item } from './types.js';
import { isRichText, richToHtml, richToPlain } from './richtext.js';
import { slugify } from './ids.js';

/** Context the validator needs for cross-item rules (uniqueness, references). */
export interface ValidationContext {
  itemExists(collectionId: string, itemId: string): boolean;
  slugTaken(collectionId: string, slug: string, exceptItemId?: string): boolean;
}

export interface FieldTypeDef {
  type: FieldType;
  label: string;
  /** Which input the CMS UI renders for the field. */
  widget: 'input' | 'textarea' | 'richtext' | 'number' | 'checkbox' | 'date' | 'image' | 'slug' | 'color' | 'reference';
  validate(value: unknown, field: Field, ctx: ValidationContext): string | null;
  /** Text shown when the field is bound to a text prop. */
  toText(value: unknown): string;
  /** HTML when bound to rich text (defaults to escaped text). */
  toHtml?(value: unknown): string;
  /** URL when bound to an image `src`. */
  toUrl?(value: unknown): string;
  defaultValue(): unknown;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

function isImage(v: unknown): v is ImageValue {
  return !!v && typeof v === 'object' && typeof (v as ImageValue).src === 'string';
}

/**
 * One registry of field types shared by the CMS UI (widget), the validator
 * (validate) and the compiler (toText / toHtml / toUrl).
 */
export const FIELD_TYPES: Record<FieldType, FieldTypeDef> = {
  text: {
    type: 'text',
    label: 'Text',
    widget: 'input',
    validate: (v) => (typeof v === 'string' ? null : 'must be text'),
    toText: (v) => (typeof v === 'string' ? v : ''),
    defaultValue: () => '',
  },
  richText: {
    type: 'richText',
    label: 'Rich text',
    widget: 'richtext',
    validate: (v) => (isRichText(v) ? null : 'must be structured rich text'),
    toText: (v) => (isRichText(v) ? richToPlain(v) : ''),
    toHtml: (v) => (isRichText(v) ? richToHtml(v) : ''),
    defaultValue: () => ({ blocks: [{ type: 'paragraph', spans: [{ text: '' }] }] }),
  },
  number: {
    type: 'number',
    label: 'Number',
    widget: 'number',
    validate: (v) => (typeof v === 'number' && Number.isFinite(v) ? null : 'must be a number'),
    toText: (v) => (typeof v === 'number' ? String(v) : ''),
    defaultValue: () => 0,
  },
  boolean: {
    type: 'boolean',
    label: 'Toggle',
    widget: 'checkbox',
    validate: (v) => (typeof v === 'boolean' ? null : 'must be true or false'),
    toText: (v) => (v ? 'Yes' : 'No'),
    defaultValue: () => false,
  },
  date: {
    type: 'date',
    label: 'Date',
    widget: 'date',
    validate: (v) => (typeof v === 'string' && ISO_DATE.test(v) ? null : 'must be an ISO date'),
    toText: (v) => (typeof v === 'string' ? v.slice(0, 10) : ''),
    defaultValue: () => new Date().toISOString().slice(0, 10),
  },
  image: {
    type: 'image',
    label: 'Image',
    widget: 'image',
    validate: (v) => (isImage(v) ? null : 'must be an image {src, alt}'),
    toText: (v) => (isImage(v) ? v.alt ?? '' : ''),
    toUrl: (v) => (isImage(v) ? v.src : ''),
    defaultValue: () => ({ src: '', alt: '' }),
  },
  slug: {
    type: 'slug',
    label: 'Slug',
    widget: 'slug',
    validate: (v) => (typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? null : 'must be lowercase letters, numbers and dashes'),
    toText: (v) => (typeof v === 'string' ? v : ''),
    defaultValue: () => '',
  },
  color: {
    type: 'color',
    label: 'Color',
    widget: 'color',
    validate: (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? null : 'must be a hex color'),
    toText: (v) => (typeof v === 'string' ? v : ''),
    defaultValue: () => '#000000',
  },
  reference: {
    type: 'reference',
    label: 'Reference',
    widget: 'reference',
    validate: (v, field, ctx) => {
      if (typeof v !== 'string' || !v) return 'must reference an item';
      if (!field.referenceCollectionId) return 'reference field has no target collection';
      return ctx.itemExists(field.referenceCollectionId, v) ? null : 'referenced item does not exist';
    },
    toText: (v) => (typeof v === 'string' ? v : ''),
    defaultValue: () => '',
  },
};

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  if (isRichText(v)) return richToPlain(v).trim() === '';
  if (isImage(v)) return v.src === '';
  return false;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

export function validateItem(collection: Collection, values: Record<string, unknown>, ctx: ValidationContext, itemId?: string): ValidationResult {
  const errors: Record<string, string> = {};
  for (const field of collection.fields) {
    const value = values[field.slug];
    if (isEmptyValue(value)) {
      if (field.required) errors[field.slug] = 'is required';
      continue;
    }
    const def = FIELD_TYPES[field.type];
    if (!def) {
      errors[field.slug] = `unknown field type ${field.type}`;
      continue;
    }
    const err = def.validate(value, field, ctx);
    if (err) {
      errors[field.slug] = err;
      continue;
    }
    if (field.type === 'slug' && ctx.slugTaken(collection.id, value as string, itemId)) errors[field.slug] = 'is already used by another item';
  }
  for (const key of Object.keys(values)) {
    if (!collection.fields.some((f) => f.slug === key)) errors[key] = 'is not a field of this collection';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function makeField(partial: Pick<Field, 'name' | 'type'> & Partial<Field>): Field {
  return { id: partial.id ?? `f_${slugify(partial.name)}`, slug: partial.slug ?? slugify(partial.name), required: partial.required ?? false, ...partial, name: partial.name, type: partial.type };
}

/** Public, CMS-agnostic lookups used by the compiler and the editor. */
export class CmsIndex {
  readonly collections = new Map<string, Collection>();
  readonly bySlug = new Map<string, Collection>();
  readonly items = new Map<string, Item[]>();
  readonly itemById = new Map<string, Item>();

  constructor(collections: Collection[], items: Item[]) {
    for (const c of collections) {
      this.collections.set(c.id, c);
      this.bySlug.set(c.slug, c);
      this.items.set(c.id, []);
    }
    for (const it of items) {
      this.itemById.set(it.id, it);
      const list = this.items.get(it.collectionId);
      if (list) list.push(it);
    }
    for (const list of this.items.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  collection(idOrSlug: string): Collection | undefined {
    return this.collections.get(idOrSlug) ?? this.bySlug.get(idOrSlug);
  }

  itemsOf(idOrSlug: string): Item[] {
    const c = this.collection(idOrSlug);
    return c ? this.items.get(c.id) ?? [] : [];
  }

  field(collection: Collection, fieldSlugOrId: string): Field | undefined {
    return collection.fields.find((f) => f.slug === fieldSlugOrId || f.id === fieldSlugOrId);
  }

  /** Follows one level of `reference.field` paths, e.g. `author.name`. */
  fieldValue(collection: Collection, item: Item, path: string): { field: Field; value: unknown } | undefined {
    const [head, ...rest] = path.split('.');
    const field = this.field(collection, head);
    if (!field) return undefined;
    const value = item.values[field.slug];
    if (rest.length && field.type === 'reference' && typeof value === 'string' && field.referenceCollectionId) {
      const target = this.collections.get(field.referenceCollectionId);
      const refItem = this.itemById.get(value);
      if (target && refItem) return this.fieldValue(target, refItem, rest.join('.'));
      return undefined;
    }
    return { field, value };
  }

  validation(): ValidationContext {
    return {
      itemExists: (collectionId, itemId) => this.itemById.get(itemId)?.collectionId === collectionId,
      slugTaken: (collectionId, slug, exceptItemId) =>
        (this.items.get(collectionId) ?? []).some((it) => it.id !== exceptItemId && Object.values(it.values).includes(slug) && this.slugFields(collectionId).some((f) => it.values[f.slug] === slug)),
    };
  }

  private slugFields(collectionId: string): Field[] {
    return this.collections.get(collectionId)?.fields.filter((f) => f.type === 'slug') ?? [];
  }
}

/** Resolve a binding against an item for one of the bindable props. */
export function resolveBinding(
  index: CmsIndex,
  binding: { collection: string; field: string },
  item: Item | undefined,
  target: 'text' | 'html' | 'url',
): string | undefined {
  const collection = index.collection(binding.collection);
  if (!collection || !item || item.collectionId !== collection.id) return undefined;
  const hit = index.fieldValue(collection, item, binding.field);
  if (!hit) return undefined;
  const def = FIELD_TYPES[hit.field.type];
  if (target === 'url') return def.toUrl ? def.toUrl(hit.value) : def.toText(hit.value);
  if (target === 'html') return def.toHtml ? def.toHtml(hit.value) : undefined;
  return def.toText(hit.value);
}
