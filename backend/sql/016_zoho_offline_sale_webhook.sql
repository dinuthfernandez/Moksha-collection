-- Idempotent offline-sale notifications from Zoho automation.
-- Run after 015_website_analytics.sql. Do not run automatically.

create table if not exists moksha_collection.zoho_offline_sale_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table moksha_collection.zoho_offline_sale_events enable row level security;
revoke all on moksha_collection.zoho_offline_sale_events from anon, authenticated;
grant all on moksha_collection.zoho_offline_sale_events to service_role;

create or replace function moksha_collection.apply_zoho_offline_sale(
  p_event_id text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = moksha_collection, public
as $$
declare
  v_inserted_event text;
  v_line jsonb;
  v_item_id text;
  v_quantity integer;
  v_stock integer;
  v_new_stock integer;
  v_results jsonb := '[]'::jsonb;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id_required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;

  insert into zoho_offline_sale_events (event_id)
    values (p_event_id)
    on conflict (event_id) do nothing
    returning event_id into v_inserted_event;

  if v_inserted_event is null then
    return jsonb_build_object('event_id', p_event_id, 'duplicate', true, 'items', '[]'::jsonb);
  end if;

  for v_line in
    select value from jsonb_array_elements(p_items) order by value->>'item_id'
  loop
    v_item_id := nullif(trim(v_line->>'item_id'), '');
    v_quantity := (v_line->>'quantity')::integer;
    if v_item_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_sale_line';
    end if;

    select p.stock_quantity into v_stock
      from products p
      where p.zoho_item_id = v_item_id
      for update;
    if not found then
      raise exception 'zoho_item_not_found:%', v_item_id;
    end if;

    v_new_stock := greatest(v_stock - v_quantity, 0);
    update products set stock_quantity = v_new_stock where zoho_item_id = v_item_id;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id,
      'quantity_sold', v_quantity,
      'stock_before', v_stock,
      'stock_after', v_new_stock,
      'uncovered_quantity', greatest(v_quantity - v_stock, 0)
    ));
  end loop;

  return jsonb_build_object('event_id', p_event_id, 'duplicate', false, 'items', v_results);
end;
$$;

revoke all on function moksha_collection.apply_zoho_offline_sale(text, jsonb) from public, anon, authenticated;
grant execute on function moksha_collection.apply_zoho_offline_sale(text, jsonb) to service_role;