-- ============================================================================
-- Moksha Collections — Reference data seed
-- Safe, non-product content only: size charts + header announcements.
-- Categories/products are intentionally NOT seeded — run this after 001_schema.sql.
-- Image paths are root-relative and are served from the frontend's /public/assets.
-- ============================================================================

insert into moksha_collection.size_charts (name, slug, icon_url, chart_image_urls, display_order)
values
  ('Common Size Chart', 'common', '/assets/size-charts/commonsize.png', array['/assets/size-charts/Common.jpg'], 1),
  ('Pencil Bottom Size Chart', 'pencil-bottom', '/assets/size-charts/pencilbottom.png', array['/assets/size-charts/Bottom.jpg'], 2),
  ('Kurti Size Chart', 'kurti', '/assets/size-charts/kurthi.png', array['/assets/size-charts/Kurthi.jpg'], 3),
  ('Anarkali Size Chart', 'anarkali', '/assets/size-charts/anarkali.png', array['/assets/size-charts/anarkali1.jpg', '/assets/size-charts/anarkali2.jpg'], 4),
  ('Aline Size Chart', 'aline', '/assets/size-charts/aline.png', array['/assets/size-charts/aline1.jpg', '/assets/size-charts/aline2.jpg'], 5),
  ('Gown Size Chart', 'gown', '/assets/size-charts/gown.png', array['/assets/size-charts/gown1.jpg', '/assets/size-charts/gown2.jpg'], 6),
  ('Blouse Size Chart', 'blouse', '/assets/size-charts/blouse.png', array['/assets/size-charts/blouse.jpg'], 7),
  ('Fishcut Size Chart', 'fishcut', '/assets/size-charts/fishcut.png', array['/assets/size-charts/fishcut.jpg'], 8),
  ('Saree Size Chart', 'saree', '/assets/size-charts/saree.png', array['/assets/size-charts/saree.jpg'], 9)
on conflict (slug) do update set
  name = excluded.name,
  icon_url = excluded.icon_url,
  chart_image_urls = excluded.chart_image_urls,
  display_order = excluded.display_order;

insert into moksha_collection.announcements (message, display_order, is_active)
values
  ('FREE SHIPPING OVER 20 BHD • SHOP NEW ARRIVALS • CODE: MOKSHA10', 1, true),
  ('FREE SHIPPING OVER 20 BHD • EASY RETURNS • SECURE CHECKOUT • SHOP NOW', 2, true),
  ('DISCOVER NEW ARRIVALS • PREMIUM QUALITY • LIMITED-TIME OFFERS • SHOP MOKSHA COLLECTIONS', 3, true);
