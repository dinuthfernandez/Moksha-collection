-- Order shipment lifecycle and private rider links.
-- Run this migration in the Supabase SQL editor after 011_free_delivery_thresholds.sql.

alter table moksha_collection.orders
  add column if not exists cancelled_by text,
  add column if not exists delivery_attempt_at timestamptz,
  add column if not exists delivery_attempt_note text,
  add column if not exists expected_delivery_date date;

alter table moksha_collection.orders
  drop constraint if exists orders_status_check;

alter table moksha_collection.orders
  add constraint orders_status_check
  check (status in ('pending', 'accepted', 'shipped', 'delivered', 'cancelled'));

alter table moksha_collection.orders
  drop constraint if exists orders_cancelled_by_check;

alter table moksha_collection.orders
  add constraint orders_cancelled_by_check
  check (cancelled_by is null or cancelled_by in ('customer', 'admin', 'rider'));

create table if not exists moksha_collection.order_delivery_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references moksha_collection.orders (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists order_delivery_tokens_order_id_idx
  on moksha_collection.order_delivery_tokens (order_id);

alter table moksha_collection.order_delivery_tokens enable row level security;