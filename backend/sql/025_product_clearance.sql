-- Clearance sale flag, synced from the Zoho item "Clearance Sale" checkbox (cf_clearance_sale).
-- Run after 024_product_discounts.sql.

alter table moksha_collection.products
  add column if not exists is_clearance boolean not null default false;

create index if not exists products_is_clearance_idx on moksha_collection.products (is_clearance) where is_clearance;
