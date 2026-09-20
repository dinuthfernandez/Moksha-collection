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
  country_code text,
  country_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_email_idx on moksha_collection.customers (email);
create unique index if not exists customers_phone_unique_idx on moksha_collection.customers (phone_country_code, phone);

-- International-ready delivery address book (multiple addresses per customer).
-- address_line1/city are intentionally nullable: Bahrain addresses route by
-- governorate/block/road instead of a street name, so different country
-- tiers populate different subsets of these columns.
create table if not exists moksha_collection.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references moksha_collection.customers (id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone_country_code text not null,
  phone text not null,
  country_code text not null,      -- ISO 3166-1 alpha-2, e.g. 'BH', 'US', 'IN'
  country_name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,               -- Bahrain governorate / GCC state-province-emirate / other region
  postal_code text,                -- also used for GCC national-address shortcodes
  block_number text,               -- Bahrain only
  road_number text,                -- Bahrain only
  building_name text,              -- Bahrain building/house, or GCC building/villa/unit
  apartment_number text,           -- Bahrain only, optional
  district text,                   -- GCC district/neighborhood
  tax_id text,                     -- International tax ID / VAT number, optional
  delivery_notes text,             -- doubles as Bahrain landmark/delivery instructions
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_id_idx on moksha_collection.customer_addresses (customer_id);

alter table moksha_collection.customers enable row level security;
alter table moksha_collection.customer_addresses enable row level security;
