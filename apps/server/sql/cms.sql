-- Postgres schema for the CMS. The file-backed store in src/cms.ts mirrors it
-- one-to-one so the two can be swapped behind the same REST API.

create table collections (
  id          text primary key,
  site_id     text not null,
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (site_id, slug)
);

create table fields (
  id                      text primary key,
  collection_id           text not null references collections(id) on delete cascade,
  name                    text not null,
  slug                    text not null,
  type                    text not null check (type in ('text','richText','number','boolean','date','image','slug','color','reference')),
  required                boolean not null default false,
  reference_collection_id text references collections(id),
  position                integer not null default 0,
  unique (collection_id, slug)
);

create table items (
  id            text primary key,
  collection_id text not null references collections(id) on delete cascade,
  values        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index items_collection_idx on items (collection_id, created_at);
create index items_values_idx on items using gin (values);

-- Slugs are unique per collection: enforced in the validator and here.
create unique index items_slug_idx on items (collection_id, (values->>'slug')) where values ? 'slug';
