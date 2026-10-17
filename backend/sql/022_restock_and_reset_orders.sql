-- One-off: restock the two completed, non-returned orders, then wipe all orders.
-- Orders: INV/MCD/0133 and INV/MCD/0139 (1 x "TOP" at 5.600 each).
-- Their order_items.product_id is NULL (product was re-synced), so the products
-- are matched by hand. Candidates: the two "TOP" products at 5.600 with stock 0.
-- Verify these ids in Supabase before running.
begin;

update moksha_collection.products
set stock_quantity = stock_quantity + 1
where id in (
  'd5599748-7df8-44e0-93d3-5a4dbe8f859b',  -- zoho_item_id 6877211000003514380
  '50b1ea6f-0f00-4c8e-a1eb-821d50c74cd3'   -- zoho_item_id 6877211000003199242
);

-- order_items, reviews and delivery tokens are removed via ON DELETE CASCADE.
delete from moksha_collection.orders;

commit;
