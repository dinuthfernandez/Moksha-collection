-- Home page banner slideshow, managed from the admin "Banner" page.
-- Images live in the public Supabase Storage bucket `home-banners` (created automatically on first upload).
-- Run after 025_product_clearance.sql.

create table if not exists moksha_collection.home_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists home_banners_order_idx on moksha_collection.home_banners (display_order);

-- Single-row switch that shows/hides the whole banner section on the home page.
create table if not exists moksha_collection.banner_settings (
  id boolean primary key default true check (id),
  section_enabled boolean not null default true,
  interval_seconds integer not null default 5
);

insert into moksha_collection.banner_settings (id) values (true) on conflict (id) do nothing;

grant all on moksha_collection.home_banners, moksha_collection.banner_settings to service_role;
