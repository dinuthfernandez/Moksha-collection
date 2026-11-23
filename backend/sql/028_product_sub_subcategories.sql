-- Run before deploying the sub-subcategory sync and API.
alter table moksha_collection.products
  add column if not exists sub_subcategory_name text,
  add column if not exists sub_subcategory_slug text,
  add column if not exists category_hierarchy_valid boolean not null default true;

create index if not exists products_sub_subcategory_idx
  on moksha_collection.products (category_slug, subcategory_slug, sub_subcategory_slug)
  where is_active and category_hierarchy_valid;
