-- Password reset brute-force lockout (5 wrong codes -> locked for 1 hour)
-- and tracking of Zoho invoices voided when an order is cancelled/returned.
-- Run after 017_product_subcategories_and_variants.sql.

alter table moksha_collection.customers
  add column if not exists reset_failed_attempts integer not null default 0,
  add column if not exists reset_locked_until timestamptz;

alter table moksha_collection.orders
  add column if not exists zoho_invoice_voided_at timestamptz;
