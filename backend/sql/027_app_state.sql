-- Shared application state, including test homepage visibility settings.
create table if not exists moksha_collection.app_state (
  key text primary key,
  value jsonb not null
);

alter table moksha_collection.app_state enable row level security;
grant all on moksha_collection.app_state to service_role;
