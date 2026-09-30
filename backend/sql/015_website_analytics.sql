-- Anonymous source-attributed website sessions. No IP addresses or personal data are stored.
-- Run after 014_cart_stock_reservation_rpc_overload_fix.sql. Do not run automatically.

create table if not exists moksha_collection.website_analytics_visits (
  visit_id uuid primary key,
  source text not null check (
    source in ('facebook', 'instagram', 'youtube', 'whatsapp', 'tiktok', 'linkedin', 'email', 'google', 'direct', 'other')
  ),
  created_at timestamptz not null default now()
);

create index if not exists website_analytics_visits_source_created_idx
  on moksha_collection.website_analytics_visits (source, created_at desc);

alter table moksha_collection.website_analytics_visits enable row level security;
revoke all on moksha_collection.website_analytics_visits from anon, authenticated;
grant all on moksha_collection.website_analytics_visits to service_role;