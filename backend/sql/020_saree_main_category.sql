alter table moksha_collection.categories drop constraint if exists categories_type_check;
alter table moksha_collection.categories add constraint categories_type_check check (type in ('clothing','accessories','saree'));
update moksha_collection.categories set type='saree' where slug in ('saree','set-saree');
update moksha_collection.products set category_slug='saree' where subcategory_slug in ('saree','set-saree');
