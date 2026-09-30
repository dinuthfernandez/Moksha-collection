-- Remove the original 3-argument function so PostgREST can resolve the
-- 4-argument version (whose expiry parameter has a default) unambiguously.
drop function if exists moksha_collection.set_cart_stock_reservation(uuid, uuid, integer);