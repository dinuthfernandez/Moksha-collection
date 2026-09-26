-- Percentage coupon tiers and order discount snapshots.
-- Run in Supabase after 005_admin_orders_campaigns.sql.

create table if not exists moksha_collection.coupons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  percentage numeric(5, 2) not null check (percentage > 0 and percentage <= 100),
  is_active boolean not null default true,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  minimum_cart_amount numeric(10, 3) not null default 0 check (minimum_cart_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_validity_range_check check (valid_to > valid_from)
);

create index if not exists coupons_active_window_idx
  on moksha_collection.coupons (is_active, valid_from, valid_to);
create index if not exists coupons_minimum_cart_amount_idx
  on moksha_collection.coupons (minimum_cart_amount);

alter table moksha_collection.orders
  add column if not exists discount_amount numeric(10, 3) not null default 0,
  add column if not exists coupon_id uuid references moksha_collection.coupons (id) on delete set null,
  add column if not exists coupon_name text,
  add column if not exists coupon_percentage numeric(5, 2);

alter table moksha_collection.coupons enable row level security;
