-- ============================================================================
-- Moksha Collections — Customers & delivery addresses
-- Schema: moksha_collection (never public). Run AFTER 001_schema.sql.
-- ============================================================================

create table if not exists moksha_collection.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  phone_country_code text not null,
  phone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_email_idx on moksha_collection.customers (email);

-- International-ready delivery address book (multiple addresses per customer).
create table if not exists moksha_collection.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references moksha_collection.customers (id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone_country_code text not null,
  phone text not null,
  country_code text not null,      -- ISO 3166-1 alpha-2, e.g. 'BH', 'US', 'IN'
  country_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state_region text,
  postal_code text,
  delivery_notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_id_idx on moksha_collection.customer_addresses (customer_id);

alter table moksha_collection.customers enable row level security;
alter table moksha_collection.customer_addresses enable row level security;
