-- =============================================================================
-- MIGRATION: ADD FRESH FRUITS CATEGORIES & SEED FRUIT CATALOG FOR HALOL
-- Supports Dual Vegetables & Fruits Storefront with Multi-pack Sizes
-- =============================================================================

BEGIN;

-- 1. Insert 'dozen' unit if not exists
INSERT INTO product_units (code, name_en, name_gu, unit_type, is_active) VALUES
('dozen', 'Dozen (12 Pcs)', 'ડઝન (૧૨ નંગ)', 'count', true),
('box', 'Pack / Box', 'બોક્સ / પેક', 'bundle', true)
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Fruits Categories
INSERT INTO categories (slug, name_en, name_gu, display_order, is_active) VALUES
('fresh-fruits', 'Fresh Fruits', 'તાજા ફળો', 6, true),
('seasonal-exotic-fruits', 'Exotic & Special Fruits', 'સ્પેશિયલ અને એક્ઝોટિક ફળો', 7, true)
ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu,
    display_order = EXCLUDED.display_order,
    is_active = true;

-- 3. Insert Fruits Products & Multi-Variants
DO $$
DECLARE
    v_cat_fruits UUID;
    v_cat_exotic_fruits UUID;
    v_unit_kg UUID;
    v_unit_gram UUID;
    v_unit_piece UUID;
    v_unit_dozen UUID;
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_cat_fruits FROM categories WHERE slug = 'fresh-fruits';
    SELECT id INTO v_cat_exotic_fruits FROM categories WHERE slug = 'seasonal-exotic-fruits';

    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg';
    SELECT id INTO v_unit_gram FROM product_units WHERE code = 'gram';
    SELECT id INTO v_unit_piece FROM product_units WHERE code = 'piece';
    SELECT id INTO v_unit_dozen FROM product_units WHERE code = 'dozen';

    -- 1. Royal Gala / Shimla Apple (સફરજન)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-apple', 'Fresh Shimla / Royal Apple', 'તાજા લાલ સફરજન', 'Crisp, sweet, and juicy handpicked mountain apples.', 'મીઠા, રસદાર અને તાજા લાલ સફરજન.', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=60', 10)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'APPLE-500G', '500 Grams (~2-3 Pcs)', '૫૦૦ ગ્રામ (૨-૩ નંગ)', 0.500, 75.00, 55.00, false, 1),
    (v_prod_id, v_unit_kg, 'APPLE-1KG', '1 Kilogram (~5-6 Pcs)', '૧ કિલોગ્રામ (૫-૬ નંગ)', 1.000, 140.00, 105.00, true, 2);

    -- 2. Robusta Banana / Kela (પાકાં કેળાં)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_dozen, 'fresh-banana', 'Fresh Robusta Banana (Kela)', 'તાજા મીઠા પાકાં કેળાં', 'Naturally ripened sweet bananas packed with energy and potassium.', 'કુદરતી રીતે પાકેલા મીઠા અને તાજા કેળાં.', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=60', 11)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_dozen, 'BANANA-6PC', 'Half Dozen (6 Pcs)', 'અડધો ડઝન (૬ નંગ)', 0.500, 25.00, 18.00, false, 1),
    (v_prod_id, v_unit_dozen, 'BANANA-1DOZ', '1 Full Dozen (12 Pcs)', '૧ ડઝન (૧૨ નંગ)', 1.000, 48.00, 34.00, true, 2);

    -- 3. Bhagwa Pomegranate / Dadam (લાલ દાડમ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-pomegranate', 'Bhagwa Red Pomegranate (Dadam)', 'મીઠા લાલ દાડમ', 'Ruby red arils, sweet and antioxidant-rich Bhagwa variety.', 'લાલચટક દાણાવાળા સ્વાદિષ્ટ ભગવા દાડમ.', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=60', 12)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'DADAM-500G', '500 Grams (~2 Pcs)', '૫૦૦ ગ્રામ (૨ નંગ)', 0.500, 80.00, 60.00, false, 1),
    (v_prod_id, v_unit_kg, 'DADAM-1KG', '1 Kilogram (~4-5 Pcs)', '૧ કિલોગ્રામ (૪-૫ નંગ)', 1.000, 150.00, 115.00, true, 2);

    -- 4. Sweet Lime / Mosambi (મોસંબી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-mosambi', 'Juicy Sweet Lime (Mosambi)', 'રસદાર મીઠી મોસંબી', 'Citrusy, sweet, and perfect for fresh breakfast juice.', 'તાજી અને રસથી ભરેલી મીઠી મોસંબી.', 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=500&auto=format&fit=crop&q=60', 13)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'MOSAMBI-1KG', '1 Kilogram (~6-7 Pcs)', '૧ કિલોગ્રામ (૬-૭ નંગ)', 1.000, 70.00, 52.00, true, 1),
    (v_prod_id, v_unit_kg, 'MOSAMBI-2KG', '2 Kilograms (~12-14 Pcs)', '૨ કિલોગ્રામ (૧૨-૧૪ નંગ)', 2.000, 135.00, 100.00, false, 2);

    -- 5. Nagpur Orange / Santra (સંતરા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-orange', 'Fresh Nagpur Orange (Santra)', 'તાજા નાગપુરી સંતરા', 'Rich in Vitamin C, tangy-sweet and aromatic fresh oranges.', 'વિટામિન સી થી ભરપૂર તાજા અને રસદાર સંતરા.', 'https://images.unsplash.com/photo-1547514701-42782101795e?w=500&auto=format&fit=crop&q=60', 14)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'ORANGE-1KG', '1 Kilogram (~5-6 Pcs)', '૧ કિલોગ્રામ (૫-૬ નંગ)', 1.000, 80.00, 60.00, true, 1);

    -- 6. Papaya / Papaiyu (પપૈયું)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_piece, 'fresh-papaya', 'Taiwan Red Lady Papaya', 'તાજું પાકું પપૈયું', 'Sweet reddish pulp, digestion-friendly fresh ripe papaya.', 'મીઠો લાલ ગર્ભ અને ઉત્તમ પાચન ગુણવાળું પપૈયું.', 'https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=500&auto=format&fit=crop&q=60', 15)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_piece, 'PAPAYA-1PC', '1 Medium Piece (~1.0-1.3 kg)', '૧ નંગ (આશરે ૧ થી ૧.૩ કિલો)', 1.000, 45.00, 32.00, true, 1);

    -- 7. Guava / Jamrukh (જામફળ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-guava', 'Fresh Sweet Guava (Jamrukh)', 'તાજા મીઠા જામફળ', 'Crisp green skin with aromatic sweet center.', 'તાજા, ક્રિસ્પી અને સ્વાદિષ્ટ જામફળ.', 'https://images.unsplash.com/photo-1536511135899-73e4b77c3e38?w=500&auto=format&fit=crop&q=60', 16)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'GUAVA-500G', '500 Grams (~3-4 Pcs)', '૫૦૦ ગ્રામ (૩-૪ નંગ)', 0.500, 35.00, 24.00, false, 1),
    (v_prod_id, v_unit_kg, 'GUAVA-1KG', '1 Kilogram (~6-8 Pcs)', '૧ કિલોગ્રામ (૬-૮ નંગ)', 1.000, 65.00, 46.00, true, 2);

    -- 8. Watermelon / Tarbuch (તરબૂચ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_fruits, v_unit_piece, 'fresh-watermelon', 'Black Sugar Watermelon (Tarbuch)', 'મીઠું કાળું તરબૂચ', 'Refreshing, deep red juicy core, extra sweet and thirst-quenching.', 'એકદમ લાલચટક અને મીઠું રસદાર તરબૂચ.', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop&q=60', 17)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_piece, 'WATERMELON-1PC', '1 Whole Piece (~2.5 - 3.5 kg)', '૧ આખું નંગ (૨.૫ થી ૩.૫ કિલો)', 1.000, 65.00, 45.00, true, 1);

    -- 9. Dragon Fruit / Kamalam (કમલમ / ડ્રેગન ફ્રૂટ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_exotic_fruits, v_unit_piece, 'dragon-fruit', 'Red Dragon Fruit (Kamalam)', 'લાલ કમલમ (ડ્રેગન ફ્રુટ)', 'Exotic nutrient-rich red dragon fruit grown in Gujarat.', 'ગુજરાતમાં પાકેલું પૌષ્ટિક અને મીઠું લાલ કમલમ.', 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=500&auto=format&fit=crop&q=60', 18)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url
    RETURNING id INTO v_prod_id;

    DELETE FROM product_variants WHERE product_id = v_prod_id;
    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_piece, 'DRAGON-1PC', '1 Piece (~350-450g)', '૧ નંગ (૩૫૦-૪૫૦ ગ્રામ)', 1.000, 65.00, 48.00, true, 1),
    (v_prod_id, v_unit_piece, 'DRAGON-2PC', 'Pack of 2 Pcs (~800g)', '૨ નંગનું પેક (આશરે ૮૦૦ ગ્રામ)', 2.000, 120.00, 90.00, false, 2);

END $$;

COMMIT;
