-- Scheduled product discounts set from the admin panel (Discounts page).
-- The Zoho price stays in products.price (the sync keeps overwriting it); the storefront shows
-- discount_price instead, only between discount_starts_at and discount_ends_at.
-- Run this migration in the Supabase SQL editor after 023_product_image_storage.sql.

alter table moksha_collection.products
  add column if not exists discount_price numeric,
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz;

alter table moksha_collection.products
  drop constraint if exists products_discount_window_check;
alter table moksha_collection.products
  add constraint products_discount_window_check check (
    (discount_price is null and discount_starts_at is null and discount_ends_at is null)
    or (discount_price is not null and discount_price > 0
        and discount_starts_at is not null and discount_ends_at is not null
        and discount_ends_at > discount_starts_at)
  );

create index if not exists products_discount_ends_idx
  on moksha_collection.products (discount_ends_at)
  where discount_price is not null;

notify pgrst, 'reload schema';
