-- Product images are downloaded from Zoho Inventory, compressed to <= 300 KB and
-- stored in the public Supabase Storage bucket `product-images`.
-- image_source_id remembers which Zoho image was stored so unchanged images are not re-downloaded.
-- has_image lets listings show products with images first.
-- Run after 022_restock_and_reset_orders.sql.

alter table moksha_collection.products
  add column if not exists image_source_id text,
  add column if not exists has_image boolean
    generated always as (image_url is not null and image_url <> '') stored;

create index if not exists products_has_image_idx on moksha_collection.products (has_image);
