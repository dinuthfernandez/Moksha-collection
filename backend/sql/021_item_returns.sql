-- Per-item returns and return rider links.
alter table moksha_collection.order_items
  add column if not exists return_status text not null default 'none',
  add column if not exists return_requested_at timestamptz,
  add column if not exists return_completed_at timestamptz;

alter table moksha_collection.order_delivery_tokens
  add column if not exists kind text not null default 'delivery';

-- Carry existing order-level returns down to their items.
update moksha_collection.order_items oi
set return_status = o.return_status,
    return_requested_at = o.return_requested_at,
    return_completed_at = o.return_completed_at
from moksha_collection.orders o
where oi.order_id = o.id and o.return_status in ('requested', 'completed') and oi.return_status = 'none';

notify pgrst, 'reload schema';
