// ---------------------------------------------------------------------------
// Document model shared by the editor, the document store and the compiler.
// ---------------------------------------------------------------------------

export type BreakpointId = 'desktop' | 'tablet' | 'phone';

export interface Breakpoint {
  id: BreakpointId;
  label: string;
  /** Canvas artboard width used in the editor. */
  width: number;
  /** Upper bound for the CSS media query. Desktop has none: it is the base. */
  maxWidth?: number;
}

/** Desktop is the base; tablet and phone cascade on top of it (in that order). */
export const BREAKPOINTS: Breakpoint[] = [
  { id: 'desktop', label: 'Desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', width: 834, maxWidth: 1199 },
  { id: 'phone', label: 'Phone', width: 390, maxWidth: 767 },
];

export type NodeType = 'frame' | 'text' | 'image' | 'instance';

export type Size = number | 'fill' | 'hug';

export interface StackLayout {
  type: 'stack';
  direction: 'horizontal' | 'vertical';
  gap: number;
  padding: number | [number, number, number, number];
  align: 'start' | 'center' | 'end' | 'stretch';
  justify: 'start' | 'center' | 'end' | 'space-between';
  wrap?: boolean;
}
export interface FreeLayout {
  type: 'none';
  padding?: number | [number, number, number, number];
}
export type Layout = StackLayout | FreeLayout;

export interface Mark {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  link?: string;
}
export interface Span {
  text: string;
  marks?: Mark;
}
export interface Block {
  type: 'paragraph' | 'heading' | 'list-item';
  level?: 1 | 2 | 3 | 4;
  spans: Span[];
}
/** Rich text is structured JSON, never raw HTML. */
export interface RichText {
  blocks: Block[];
}

export interface Repeat {
  /** Collection id or slug: the frame's children are repeated once per item. */
  collection: string;
  limit?: number;
}

export interface NodeProps {
  name?: string;
  // Position inside a parent with `layout.type === 'none'`.
  x?: number;
  y?: number;
  width?: Size;
  height?: Size;
  minHeight?: number;
  fill?: string;
  color?: string;
  radius?: number;
  opacity?: number;
  clip?: boolean;
  border?: string;
  shadow?: string;
  layout?: Layout;
  // Text
  text?: RichText;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right';
  // Image
  src?: string;
  alt?: string;
  objectFit?: 'cover' | 'contain';
  // Misc
  link?: string;
  tag?: 'div' | 'section' | 'header' | 'footer' | 'nav' | 'main' | 'article' | 'aside';
  visible?: boolean;
  repeat?: Repeat;
}

/** A node prop bound to a CMS field: resolved per item when the page compiles. */
export interface Binding {
  collection: string;
  field: string;
}

export type BindableProp = 'text' | 'src' | 'alt' | 'link' | 'fill' | 'color';

export interface DocNode {
  id: string;
  type: NodeType;
  parentId: string | null;
  children: string[];
  props: NodeProps;
  /** Per-breakpoint overrides; they cascade desktop -> tablet -> phone. */
  overrides: Partial<Record<BreakpointId, Partial<NodeProps>>>;
  bindings?: Partial<Record<BindableProp, Binding>>;
  /** Instance nodes only: the component they reference. */
  componentId?: string;
  /** Instance nodes only: `${masterNodeId}.${prop}` -> value. */
  instanceOverrides?: Record<string, unknown>;
}

export interface SeoMeta {
  title?: string | Binding;
  description?: string | Binding;
  ogImage?: string | Binding;
  noIndex?: boolean;
}

export interface Page {
  id: string;
  name: string;
  /** Route pattern, e.g. `/`, `/about`, `/blog/:slug`. */
  path: string;
  rootId: string;
  seo: SeoMeta;
  /** When set, the page is a dynamic template: one page is generated per item. */
  collectionId?: string;
}

export interface ComponentDef {
  id: string;
  name: string;
  /** Root node of the master subtree (its parentId is null). */
  rootId: string;
}

export interface FontRef {
  family: string;
  weights: number[];
}

export interface Document {
  id: string;
  name: string;
  version: number;
  nodes: Record<string, DocNode>;
  pages: Record<string, Page>;
  pageOrder: string[];
  components: Record<string, ComponentDef>;
  fonts: FontRef[];
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'richText'
  | 'number'
  | 'boolean'
  | 'date'
  | 'image'
  | 'slug'
  | 'color'
  | 'reference';

export interface Field {
  id: string;
  name: string;
  slug: string;
  type: FieldType;
  required?: boolean;
  /** Reference fields: the collection the referenced item belongs to. */
  referenceCollectionId?: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  fields: Field[];
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  collectionId: string;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ImageValue {
  src: string;
  alt?: string;
}

/** Everything the compiler needs from the CMS, snapshotted at build time. */
export interface CmsSnapshot {
  collections: Collection[];
  items: Item[];
}
