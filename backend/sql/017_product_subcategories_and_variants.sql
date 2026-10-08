-- Adds Zoho-driven subcategory + variant grouping fields to products.
-- Subcategory values come from Zoho's "Product Sub Category" custom field;
-- website_serial/color/size come from the matching custom fields. Items that
-- share the same non-empty website_serial are "the same design" (differing
-- only by color/size); is_primary_variant marks the single representative
-- row (smallest size) that storefront listing/grid pages should show.
-- Run after 016_zoho_offline_sale_webhook.sql.

alter table moksha_collection.products
  add column if not exists subcategory_name text,
  add column if not exists subcategory_slug text,
  add column if not exists website_serial text,
  add column if not exists color text,
  add column if not exists size text,
  add column if not exists is_primary_variant boolean not null default true;

create index if not exists products_subcategory_slug_idx on moksha_collection.products (subcategory_slug);
create index if not exists products_website_serial_idx on moksha_collection.products (website_serial);
create index if not exists products_is_primary_variant_idx on moksha_collection.products (is_primary_variant);
