-- ============================================================================
-- Moksha Collections - customer wishlists
-- Schema: moksha_collection (never public). Run after 003_customers_and_addresses.sql.
-- ============================================================================

create table if not exists moksha_collection.customer_wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references moksha_collection.customers (id) on delete cascade,
  product_id text not null,
  product_name text not null,
  product_slug text,
  image_url text,
  price numeric(12, 3),
  currency text not null default 'BHD',
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index if not exists customer_wishlists_customer_id_idx
  on moksha_collection.customer_wishlists (customer_id, created_at desc);

alter table moksha_collection.customer_wishlists enable row level security;
