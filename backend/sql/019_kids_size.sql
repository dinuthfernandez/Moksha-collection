-- Kids age-range size (Zoho custom field "Kids size", api name cf_kids_size), e.g. 0-1, 2-3.
alter table moksha_collection.products
  add column if not exists kids_size text;
