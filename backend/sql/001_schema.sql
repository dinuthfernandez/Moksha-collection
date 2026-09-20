-- ============================================================================
-- Moksha Collections — Database schema
-- Run this file in the Supabase SQL editor (or via psql) on your project.
-- Everything lives under the `moksha_collection` schema — never `public`.
--
-- IMPORTANT (one-time dashboard step, cannot be done via SQL):
-- In Supabase, go to Project Settings > API > "Exposed schemas" and add
-- `moksha_collection` to the list (alongside `public`). Without this,
-- PostgREST/supabase-py cannot query tables in this schema.
-- ============================================================================

create schema if not exists moksha_collection;

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- categories
-- Only the two fixed sections exist in the app UI (Clothing / Accessories).
-- This table stores the SUBCATEGORIES that live under each section.
-- Intentionally left EMPTY until content is provided — do not seed rows here.
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null check (type in ('clothing', 'accessories')),
  parent_id uuid references moksha_collection.categories (id) on delete cascade,
  image_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists categories_type_idx on moksha_collection.categories (type);
create index if not exists categories_parent_id_idx on moksha_collection.categories (parent_id);

-- ----------------------------------------------------------------------------
-- products (kept empty until products are provided)
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references moksha_collection.categories (id) on delete set null,
  category_slug text,
  zoho_item_id text,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10, 3) not null default 0,
  compare_at_price numeric(10, 3),
  is_active boolean not null default true,
  is_new_arrival boolean not null default false,
  is_on_sale boolean not null default false,
  is_under_5bhd boolean not null default false,
  stock_quantity integer not null default 0,
  image_url text,
  zoho_sku text,
  brand text,
  length numeric(10, 3),
  width numeric(10, 3),
  height numeric(10, 3),
  weight numeric(10, 3),
  dimension_unit text,
  weight_unit text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on moksha_collection.products (category_id);
create index if not exists products_category_slug_idx on moksha_collection.products (category_slug);
create index if not exists products_zoho_item_id_idx on moksha_collection.products (zoho_item_id);

create table if not exists moksha_collection.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references moksha_collection.products (id) on delete cascade,
  url text not null,
  alt_text text,
  display_order integer not null default 0
);

create index if not exists product_images_product_id_idx on moksha_collection.product_images (product_id);

create table if not exists moksha_collection.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references moksha_collection.products (id) on delete cascade,
  size text,
  color text,
  sku text,
  stock_quantity integer not null default 0,
  price_override numeric(10, 3)
);

create index if not exists product_variants_product_id_idx on moksha_collection.product_variants (product_id);

-- ----------------------------------------------------------------------------
-- size_charts (safe to seed — see 002_seed_reference_data.sql)
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.size_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon_url text not null,
  chart_image_urls text[] not null default '{}',
  display_order integer not null default 0
);

-- ----------------------------------------------------------------------------
-- announcements (rotating header announcement bar text)
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  display_order integer not null default 0,
  is_active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- contact_messages (submissions from the Contact Us form)
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- orders / order_items (WhatsApp + bank-transfer checkout flow)
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  notes text,
  total_amount numeric(10, 3) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
  zoho_invoice_id text,
  zoho_invoice_number text,
  created_at timestamptz not null default now()
);

create table if not exists moksha_collection.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references moksha_collection.orders (id) on delete cascade,
  product_id uuid references moksha_collection.products (id) on delete set null,
  variant_id uuid references moksha_collection.product_variants (id) on delete set null,
  quantity integer not null default 1,
  price numeric(10, 3) not null default 0
);

create index if not exists order_items_order_id_idx on moksha_collection.order_items (order_id);

-- ----------------------------------------------------------------------------
-- Row Level Security — locked down by default.
-- The backend talks to Supabase with the service-role key, which bypasses RLS,
-- so no public policies are required. This just prevents any accidental
-- exposure if the anon/public key is ever used against these tables directly.
-- ----------------------------------------------------------------------------
alter table moksha_collection.categories enable row level security;
alter table moksha_collection.products enable row level security;
alter table moksha_collection.product_images enable row level security;
alter table moksha_collection.product_variants enable row level security;
alter table moksha_collection.size_charts enable row level security;
alter table moksha_collection.announcements enable row level security;
alter table moksha_collection.contact_messages enable row level security;
alter table moksha_collection.orders enable row level security;
alter table moksha_collection.order_items enable row level security;
