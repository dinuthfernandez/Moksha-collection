-- ============================================================================
-- Moksha Collections — Admin panel, order lifecycle, returns, campaigns
-- Schema: moksha_collection (never public). Run AFTER 004_wishlists.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_settings — single row holding IBAN, receipts WhatsApp number and the
-- return window (in days) customers are allowed to request a return within.
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.admin_settings (
  id boolean primary key default true,
  iban_number text,
  whatsapp_number text,
  return_window_days integer not null default 7,
  updated_at timestamptz not null default now(),
  constraint admin_settings_singleton check (id)
);

insert into moksha_collection.admin_settings (id)
values (true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- delivery_rates — one row per delivery tier, each with a BHD rate and a
-- customer-facing description shown on the order confirmation/delivery page.
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  delivery_type text not null unique check (delivery_type in ('bahrain', 'gcc', 'international')),
  rate_bhd numeric(10, 3) not null default 0,
  description text,
  updated_at timestamptz not null default now()
);

insert into moksha_collection.delivery_rates (delivery_type, rate_bhd, description)
values
  ('bahrain', 1.000, 'Local delivery within Bahrain, usually within 1-3 business days.'),
  ('gcc', 3.000, 'Delivery across GCC countries (Saudi Arabia, UAE, Kuwait, Qatar, Oman).'),
  ('international', 8.000, 'International delivery outside the GCC region.')
on conflict (delivery_type) do nothing;

-- ----------------------------------------------------------------------------
-- orders — extend with customer link, delivery + return lifecycle fields.
-- ----------------------------------------------------------------------------
alter table moksha_collection.orders
  add column if not exists customer_id uuid references moksha_collection.customers (id) on delete set null,
  add column if not exists delivery_type text check (delivery_type in ('bahrain', 'gcc', 'international')),
  add column if not exists delivery_charge numeric(10, 3) not null default 0,
  add column if not exists subtotal_amount numeric(10, 3) not null default 0,
  add column if not exists return_status text not null default 'none' check (return_status in ('none', 'requested', 'completed')),
  add column if not exists return_requested_at timestamptz,
  add column if not exists return_completed_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists orders_customer_id_idx on moksha_collection.orders (customer_id);
create index if not exists orders_status_idx on moksha_collection.orders (status);
create index if not exists orders_return_status_idx on moksha_collection.orders (return_status);

-- Widen the status lifecycle to match the admin dashboard workflow.
alter table moksha_collection.orders drop constraint if exists orders_status_check;
alter table moksha_collection.orders
  add constraint orders_status_check check (status in ('pending', 'accepted', 'delivered', 'cancelled'));

-- ----------------------------------------------------------------------------
-- order_items — snapshot product name/image so history still renders correctly
-- even if a product is later renamed, re-imaged or removed from the catalog.
-- ----------------------------------------------------------------------------
alter table moksha_collection.order_items
  add column if not exists product_name text,
  add column if not exists product_image_url text;

-- ----------------------------------------------------------------------------
-- customers — allow admins to ban an account.
-- ----------------------------------------------------------------------------
alter table moksha_collection.customers
  add column if not exists is_banned boolean not null default false;

-- ----------------------------------------------------------------------------
-- campaigns — log of marketing emails sent to all customers.
-- ----------------------------------------------------------------------------
create table if not exists moksha_collection.campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table moksha_collection.admin_settings enable row level security;
alter table moksha_collection.delivery_rates enable row level security;
alter table moksha_collection.campaigns enable row level security;
