-- Temporary inventory holds created when a customer adds products to a cart.
-- Run after 012_delivery_rider_workflow.sql. Do not run automatically.

create table if not exists moksha_collection.cart_stock_reservations (
  cart_id uuid not null,
  product_id uuid not null references moksha_collection.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'releasing')),
  release_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (cart_id, product_id)
);

create index if not exists cart_stock_reservations_expiry_idx
  on moksha_collection.cart_stock_reservations (expires_at)
  where status = 'active';

alter table moksha_collection.cart_stock_reservations enable row level security;
revoke all on moksha_collection.cart_stock_reservations from anon, authenticated;
grant all on moksha_collection.cart_stock_reservations to service_role;

create or replace function moksha_collection.set_cart_stock_reservation(
  p_cart_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_expires_at timestamptz default null
)
returns table (
  previous_quantity integer,
  previous_expires_at timestamptz,
  delta_quantity integer,
  reserved_quantity integer,
  expires_at timestamptz,
  zoho_item_id text,
  stock_quantity integer
)
language plpgsql
security definer
set search_path = moksha_collection, public
as $$
declare
  v_stock integer;
  v_zoho_item_id text;
  v_previous_quantity integer := 0;
  v_previous_expiry timestamptz;
  v_previous_status text;
  v_delta integer;
  v_expiry timestamptz;
  v_new_stock integer;
begin
  if p_quantity < 0 then
    raise exception 'quantity_must_not_be_negative';
  end if;

  select p.stock_quantity, p.zoho_item_id
    into v_stock, v_zoho_item_id
    from products p
    where p.id = p_product_id
    for update;

  if not found then
    raise exception 'product_not_found';
  end if;

  select r.quantity, r.expires_at, r.status
    into v_previous_quantity, v_previous_expiry, v_previous_status
    from cart_stock_reservations r
    where r.cart_id = p_cart_id and r.product_id = p_product_id
    for update;

  if found and v_previous_status <> 'active' then
    raise exception 'reservation_is_being_released';
  end if;

  if found and v_previous_expiry <= now() and p_quantity > 0 then
    raise exception 'reservation_expired';
  end if;

  v_previous_quantity := coalesce(v_previous_quantity, 0);
  v_delta := p_quantity - v_previous_quantity;

  if p_quantity > 0 and (v_zoho_item_id is null or not exists (
    select 1 from products p where p.id = p_product_id and p.is_active
  )) then
    raise exception 'product_not_available_for_reservation';
  end if;

  if v_delta > v_stock then
    raise exception 'insufficient_stock';
  end if;

  v_new_stock := v_stock - v_delta;
  update products set stock_quantity = v_new_stock where id = p_product_id;

  if p_quantity = 0 then
    delete from cart_stock_reservations
      where cart_id = p_cart_id and product_id = p_product_id;
    v_expiry := null;
  else
    v_expiry := case
      when v_previous_quantity > 0 then v_previous_expiry
      else coalesce(p_expires_at, now() + interval '24 hours')
    end;
    insert into cart_stock_reservations (cart_id, product_id, quantity, expires_at, status, release_claimed_at)
      values (p_cart_id, p_product_id, p_quantity, v_expiry, 'active', null)
      on conflict (cart_id, product_id) do update
        set quantity = excluded.quantity,
            expires_at = excluded.expires_at,
            status = 'active',
            release_claimed_at = null;
  end if;

  return query select v_previous_quantity, v_previous_expiry, v_delta, p_quantity, v_expiry, v_zoho_item_id, v_new_stock;
end;
$$;

create or replace function moksha_collection.claim_expired_cart_stock_reservations(p_limit integer default 100)
returns table (
  cart_id uuid,
  product_id uuid,
  quantity integer,
  expires_at timestamptz,
  zoho_item_id text
)
language sql
security definer
set search_path = moksha_collection, public
as $$
  with candidates as (
    select r.cart_id, r.product_id
      from cart_stock_reservations r
      where r.status = 'active' and r.expires_at <= now()
      order by r.expires_at
      limit greatest(p_limit, 1)
      for update skip locked
  ), claimed as (
    update cart_stock_reservations r
      set status = 'releasing', release_claimed_at = now()
      from candidates c
      where r.cart_id = c.cart_id and r.product_id = c.product_id
      returning r.cart_id, r.product_id, r.quantity, r.expires_at
  )
  select c.cart_id, c.product_id, c.quantity, c.expires_at, p.zoho_item_id
    from claimed c
    join products p on p.id = c.product_id;
$$;

create or replace function moksha_collection.complete_expired_cart_stock_reservation(
  p_cart_id uuid,
  p_product_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = moksha_collection, public
as $$
declare
  v_quantity integer;
begin
  select r.quantity into v_quantity
    from cart_stock_reservations r
    where r.cart_id = p_cart_id
      and r.product_id = p_product_id
      and r.expires_at = p_expires_at
      and r.status = 'releasing'
    for update;

  if not found then
    return false;
  end if;

  update products
    set stock_quantity = stock_quantity + v_quantity
    where id = p_product_id;
  delete from cart_stock_reservations
    where cart_id = p_cart_id and product_id = p_product_id and expires_at = p_expires_at;
  return true;
end;
$$;

create or replace function moksha_collection.unclaim_expired_cart_stock_reservation(
  p_cart_id uuid,
  p_product_id uuid,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = moksha_collection, public
as $$
  update cart_stock_reservations
    set status = 'active', release_claimed_at = null
    where cart_id = p_cart_id
      and product_id = p_product_id
      and expires_at = p_expires_at
      and status = 'releasing';
$$;

create or replace function moksha_collection.consume_cart_stock_reservations(p_cart_id uuid)
returns integer
language plpgsql
security definer
set search_path = moksha_collection, public
as $$
declare
  v_deleted integer;
begin
  delete from cart_stock_reservations
    where cart_id = p_cart_id and status = 'active' and expires_at > now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function moksha_collection.set_cart_stock_reservation(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function moksha_collection.claim_expired_cart_stock_reservations(integer) from public, anon, authenticated;
revoke all on function moksha_collection.complete_expired_cart_stock_reservation(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function moksha_collection.unclaim_expired_cart_stock_reservation(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function moksha_collection.consume_cart_stock_reservations(uuid) from public, anon, authenticated;
grant execute on function moksha_collection.set_cart_stock_reservation(uuid, uuid, integer, timestamptz) to service_role;
grant execute on function moksha_collection.claim_expired_cart_stock_reservations(integer) to service_role;
grant execute on function moksha_collection.complete_expired_cart_stock_reservation(uuid, uuid, timestamptz) to service_role;
grant execute on function moksha_collection.unclaim_expired_cart_stock_reservation(uuid, uuid, timestamptz) to service_role;
grant execute on function moksha_collection.consume_cart_stock_reservations(uuid) to service_role;