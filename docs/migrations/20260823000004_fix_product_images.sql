-- =============================================================================
-- MIGRATION: FIX MISMATCHED / BROKEN PRODUCT IMAGES
-- Date: 2026-08-23
-- Context: an audit of every product image in the catalog (fetched and visually
-- verified each images.unsplash.com URL) found that most were wrong or 404s —
-- e.g. Dudhi showed a strawberry, Lemon showed a coffee cup, Cabbage showed a
-- vinyl record, Patra Leaves showed a birthday cake, and 5 URLs (Kankoda,
-- Mora Marcha, Karela, Ghiloda, Bhindi) didn't resolve at all.
-- Every replacement URL below was downloaded and visually confirmed to show
-- the correct vegetable/fruit before being used here. Only image_url is
-- touched — no other columns.
-- =============================================================================

BEGIN;

UPDATE products SET image_url = 'https://images.pexels.com/photos/39130946/pexels-photo-39130946.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'green-dudhi';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1432457990754-c8b5f21448de?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-lemon';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1707065879790-256dec8f3760?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-methi';
UPDATE products SET image_url = 'https://images.pexels.com/photos/10434722/pexels-photo-10434722.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-coriander';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1693500387488-e2ca0aa70019?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-cabbage';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1559836833-2a2c99b1f54f?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-spring-onion';
UPDATE products SET image_url = 'https://images.pexels.com/photos/33661630/pexels-photo-33661630.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-kankoda';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1618130070080-91f4d55a2383?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-mint';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1767201276838-26d43822504f?w=600&auto=format&fit=crop&q=80' WHERE slug = 'green-chilli';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1576763595295-c0371a32af78?w=600&auto=format&fit=crop&q=80' WHERE slug = 'mora-marcha-lamba';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1766714534617-b3cffc7f9085?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-karela';
UPDATE products SET image_url = 'https://images.pexels.com/photos/34016415/pexels-photo-34016415.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-gavar';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1758055660285-d32b7b3b1e77?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-ginger';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1730202452902-3b0fa8d96536?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-brinjal';
UPDATE products SET image_url = 'https://images.pexels.com/photos/38661460/pexels-photo-38661460.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-parvar';
UPDATE products SET image_url = 'https://images.unsplash.com/flagged/photo-1564468851711-9f084313d5bf?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-valor';
UPDATE products SET image_url = 'https://images.pexels.com/photos/36113343/pexels-photo-36113343.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-ghiloda';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1558408525-1092038389ae?w=600&auto=format&fit=crop&q=80' WHERE slug = 'tender-bhindi';
UPDATE products SET image_url = 'https://images.pexels.com/photos/38730146/pexels-photo-38730146.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-patra-leaves';
UPDATE products SET image_url = 'https://images.pexels.com/photos/37917425/pexels-photo-37917425.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-pomegranate';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1600498302770-5c73dcf8d89c?w=600&auto=format&fit=crop&q=80' WHERE slug = 'fresh-mosambi';
UPDATE products SET image_url = 'https://images.pexels.com/photos/3942502/pexels-photo-3942502.jpeg?auto=compress&cs=tinysrgb&w=600' WHERE slug = 'fresh-chiku';

COMMIT;
