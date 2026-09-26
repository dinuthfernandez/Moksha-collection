-- Estimated delivery ranges configured per delivery tier in the admin dashboard.
-- Run this migration in the Supabase SQL editor after 005_admin_orders_campaigns.sql.

alter table moksha_collection.delivery_rates
  add column if not exists delivery_days_from integer,
  add column if not exists delivery_days_to integer;

update moksha_collection.delivery_rates
set delivery_days_from = coalesce(
      delivery_days_from,
      case delivery_type when 'bahrain' then 1 when 'gcc' then 3 else 7 end
    ),
    delivery_days_to = coalesce(
      delivery_days_to,
      case delivery_type when 'bahrain' then 3 when 'gcc' then 7 else 14 end
    )
where delivery_days_from is null or delivery_days_to is null;

alter table moksha_collection.delivery_rates
  alter column delivery_days_from set default 1,
  alter column delivery_days_from set not null,
  alter column delivery_days_to set default 3,
  alter column delivery_days_to set not null;

alter table moksha_collection.delivery_rates
  drop constraint if exists delivery_rates_delivery_days_range_check;

alter table moksha_collection.delivery_rates
  add constraint delivery_rates_delivery_days_range_check
  check (
    delivery_days_from >= 0
    and delivery_days_to >= delivery_days_from
    and delivery_days_to <= 90
  );
