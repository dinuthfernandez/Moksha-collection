-- ============================================================================
-- Moksha Collections — Password reset codes
-- Schema: moksha_collection (never public). Run AFTER 005_admin_orders_campaigns.sql.
-- ============================================================================

create table if not exists moksha_collection.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references moksha_collection.customers (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_customer_id_idx
  on moksha_collection.password_reset_codes (customer_id, created_at desc);

alter table moksha_collection.password_reset_codes enable row level security;
