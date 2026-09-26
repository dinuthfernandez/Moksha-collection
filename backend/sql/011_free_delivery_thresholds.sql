-- Optional per-tier free-delivery thresholds, measured against the merchandise subtotal.
-- Run this migration in the Supabase SQL editor after 010_coupons_and_order_discounts.sql.

alter table moksha_collection.delivery_rates
  add column if not exists free_delivery_over_bhd numeric(10, 3);

alter table moksha_collection.delivery_rates
  drop constraint if exists delivery_rates_free_delivery_over_nonnegative;

alter table moksha_collection.delivery_rates
  add constraint delivery_rates_free_delivery_over_nonnegative
  check (free_delivery_over_bhd is null or free_delivery_over_bhd >= 0);
