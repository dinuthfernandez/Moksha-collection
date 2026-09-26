-- Add stable, customer-facing product codes for search and product detail pages.
-- Run this migration in the Supabase SQL editor after the existing migrations.
-- Safe to rerun: existing non-empty product codes are preserved.

alter table moksha_collection.products
  add column if not exists product_code text;

update moksha_collection.products
set product_code = 'MC-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where product_code is null or btrim(product_code) = '';

alter table moksha_collection.products
  alter column product_code set default (
    'MC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  );

alter table moksha_collection.products
  alter column product_code set not null;

create unique index if not exists products_product_code_uidx
  on moksha_collection.products (product_code);
