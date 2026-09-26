-- Customer reviews for products. Run after 003_customers_and_addresses.sql
-- and 005_admin_orders_campaigns.sql, which create customers/order_items/order status.

create table if not exists moksha_collection.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references moksha_collection.products (id) on delete cascade,
  order_id uuid not null references moksha_collection.orders (id) on delete cascade,
  order_item_id uuid not null unique references moksha_collection.order_items (id) on delete cascade,
  customer_id uuid not null references moksha_collection.customers (id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1200),
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_created_idx
  on moksha_collection.product_reviews (product_id, created_at desc);
create index if not exists product_reviews_customer_idx
  on moksha_collection.product_reviews (customer_id);

create or replace view moksha_collection.product_review_summaries as
select
  product_id,
  count(*)::integer as total,
  round(avg(rating)::numeric, 2)::double precision as average_rating
from moksha_collection.product_reviews
group by product_id;

alter table moksha_collection.product_reviews enable row level security;
