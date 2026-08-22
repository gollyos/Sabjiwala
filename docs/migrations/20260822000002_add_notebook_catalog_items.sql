-- =============================================================================
-- MIGRATION: ADD NOTEBOOK CATALOG ITEMS WITH HIGH-RESOLUTION IMAGES & PRICING
-- Date: 2026-08-22
-- Includes all 29 items from handwritten APMC Halol notebook
-- =============================================================================

BEGIN;

-- Clean up unused placeholder if any
DELETE FROM products WHERE slug = 'apple' AND id NOT IN (SELECT product_id FROM order_items);

-- 1. Ensure units exist
INSERT INTO product_units (code, name_en, name_gu, unit_type, is_active) VALUES
('kg', 'Kilogram', 'કિલોગ્રામ', 'weight', true),
('gram', 'Gram', 'ગ્રામ', 'weight', true),
('piece', 'Piece / Item', 'નંગ', 'count', true),
('bunch', 'Bunch / Bundle', 'પૂંજી/જુડી', 'bundle', true),
('dozen', 'Dozen (12 Pcs)', 'ડઝન (૧૨ નંગ)', 'count', true)
ON CONFLICT (code) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_gu = EXCLUDED.name_gu,
    is_active = true;

-- 2. Upsert Products and Variants
DO $$
DECLARE
    v_cat_daily UUID;
    v_cat_leafy UUID;
    v_cat_gourds UUID;
    v_cat_root UUID;
    v_cat_herbs UUID;
    v_cat_fruits UUID;
    
    v_unit_kg UUID;
    v_unit_gram UUID;
    v_unit_piece UUID;
    v_unit_bunch UUID;
    v_unit_dozen UUID;
    
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_cat_daily FROM categories WHERE slug = 'daily-essentials';
    SELECT id INTO v_cat_leafy FROM categories WHERE slug = 'leafy-vegetables';
    SELECT id INTO v_cat_gourds FROM categories WHERE slug = 'gourds-squashes';
    SELECT id INTO v_cat_root FROM categories WHERE slug = 'root-tubers';
    SELECT id INTO v_cat_herbs FROM categories WHERE slug = 'exotic-herbs';
    SELECT id INTO v_cat_fruits FROM categories WHERE slug = 'fresh-fruits';

    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg';
    SELECT id INTO v_unit_gram FROM product_units WHERE code = 'gram';
    SELECT id INTO v_unit_piece FROM product_units WHERE code = 'piece';
    SELECT id INTO v_unit_bunch FROM product_units WHERE code = 'bunch';
    SELECT id INTO v_unit_dozen FROM product_units WHERE code = 'dozen';

    -- 1. Gajar / Carrot (ગાજર)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_root, v_unit_kg, 'fresh-carrot', 'Fresh Farm Carrot (Gajar)', 'તાજા લાલ-કેસરી ગાજર', 'Crisp, sweet, and crunchy fresh carrots for salad and sabji.', 'તાજા, ક્રિસ્પી અને મીઠા દેશી ગાજર.', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80', 1, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'CARROT-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 18.00, 10.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'CARROT-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 32.00, 20.00, true, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 2. Dudhi / Bottle Gourd (દૂધી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_gourds, v_unit_piece, 'green-dudhi', 'Tender Dudhi (Bottle Gourd)', 'કૂમળી ગોળ / લાંબી દૂધી', 'Sweet and tender green bottle gourd, perfect for thepla, muthia, and sabji.', 'કુમળી દૂધી - થેપલા અને શાક માટે ઉત્તમ.', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80', 2, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_piece, 'DUDHI-1PC', '1 Medium Piece (~600-800g)', '૧ નંગ (૬૦૦-૮૦૦ ગ્રામ)', 1.000, 20.00, 8.00, true, 1, true),
    (v_prod_id, v_unit_piece, 'DUDHI-2PC', '2 Medium Pieces (~1.5 kg)', '૨ નંગ (આશરે ૧.૫ કિલો)', 2.000, 38.00, 15.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 3. Limbu / Lemon (લીંબુ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_kg, 'fresh-lemon', 'Fresh Juicy Lemon (Limbu)', 'તાજા રસદાર પીળા લીંબુ', 'Thin skinned, juicy, tangy yellow lemons.', 'પાતળી છાલવાળા રસથી ભરપૂર દેશી લીંબુ.', 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', 3, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'LEMON-250G', '250 Grams (~6-8 Pcs)', '૨૫૦ ગ્રામ (૬-૮ નંગ)', 0.250, 25.00, 12.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'LEMON-500G', '500 Grams (~12-15 Pcs)', '૫૦૦ ગ્રામ (૧૨-૧૫ નંગ)', 0.500, 48.00, 23.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'LEMON-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 90.00, 45.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 4. Methi / Fenugreek Leaves (મેથીની ભાજી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_leafy, v_unit_bunch, 'fresh-methi', 'Fresh Farm Methi (Fenugreek)', 'તાજી લીલી મેથીની ભાજી', 'Early morning plucked tender green fenugreek leaves bunch.', 'ખેતરમાંથી તાજી ચૂંટેલી કૂમળી લીલી મેથીની જુડી.', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80', 4, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'METHI-1BUNCH', '1 Fresh Bunch (~250g)', '૧ જુડી (આશરે ૨૫૦ ગ્રામ)', 1.000, 20.00, 10.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'METHI-2BUNCH', '2 Fresh Bunches (~500g)', '૨ જુડી (આશરે ૫૦૦ ગ્રામ)', 2.000, 38.00, 18.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 5. Dhana / Coriander / Kothmir (લીલી કોથમીર)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_bunch, 'fresh-coriander', 'Aromatic Fresh Coriander (Kothmir)', 'સુગંધિત લીલી કોથમીર (ધાણા)', 'Super fresh aromatic coriander bunch from Halol farmers.', 'તાજી સુગંધિત દેશી લીલી કોથમીર.', 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&auto=format&fit=crop&q=80', 5, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'KOTHMIR-100G', '1 Bunch (~100g)', '૧ જુડી (૧૦૦ ગ્રામ)', 1.000, 15.00, 8.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'KOTHMIR-250G', 'Large Bunch (~250g)', 'મોટી જુડી (૨૫૦ ગ્રામ)', 2.500, 32.00, 18.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 6. Kobij / Cabbage (કોબીજ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_piece, 'fresh-cabbage', 'Fresh Green Cabbage (Kobij)', 'તાજી લીલી કોબીજ', 'Tight, fresh, crispy green cabbage head.', 'તાજી, કડક અને મીઠી લીલી કોબીજ.', 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80', 6, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_piece, 'CABBAGE-1PC', '1 Medium Head (~500-700g)', '૧ નંગ (૫૦૦-૭૦૦ ગ્રામ)', 1.000, 20.00, 10.00, true, 1, true),
    (v_prod_id, v_unit_piece, 'CABBAGE-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.500, 35.00, 16.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 7. Dungri / Onion (લાલ ડુંગળી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_root, v_unit_kg, 'red-onion', 'Nashik / Local Red Onion', 'તાજી લાલ ડુંગળી', 'Crisp pungent fresh onions sorted for maximum shelf life.', 'સ્વાદિષ્ટ અને તીખી લાલ ડુંગળી.', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80', 7, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'ONION-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 35.00, 25.00, true, 1, true),
    (v_prod_id, v_unit_kg, 'ONION-2KG', '2 Kilograms', '૨ કિલોગ્રામ', 2.000, 68.00, 48.00, false, 2, true),
    (v_prod_id, v_unit_kg, 'ONION-5KG', '5 Kilograms (Bachat Pack)', '૫ કિલોગ્રામ (બચત પેક)', 5.000, 165.00, 120.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 8. Bataka / Potato (બટાકા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_root, v_unit_kg, 'fresh-potato', 'Farm Fresh Potato (Bataka)', 'તાજા બટાકા (સાદા / લોકર)', 'Top grade sorting potatoes, thin skin, ideal for daily sabji.', 'ઉત્તમ ગુણવત્તાવાળા બટાટા.', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80', 8, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'POTATO-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 25.00, 14.00, true, 1, true),
    (v_prod_id, v_unit_kg, 'POTATO-2KG', '2 Kilograms', '૨ કિલોગ્રામ', 2.000, 48.00, 27.00, false, 2, true),
    (v_prod_id, v_unit_kg, 'POTATO-5KG', '5 Kilograms (Bachat Pack)', '૫ કિલોગ્રામ (બચત પેક)', 5.000, 115.00, 65.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 9. Tameta / Tomato (ટામેટા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'desi-tomato', 'Fresh Desi Tomato (Tameta)', 'તાજા દેશી ટામેટા', 'Farm-fresh juicy sour-sweet desi tomatoes from Halol outskirts.', 'ખેતરમાંથી તાજા ચૂંટેલા લાલચટક દેશી ટામેટા.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80', 9, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'TOMATO-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 20.00, 12.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'TOMATO-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 38.00, 22.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'TOMATO-2KG', '2 Kilograms', '૨ કિલોગ્રામ', 2.000, 72.00, 42.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 10. Lili Dungri / Spring Onion (લીલી ડુંગળી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_leafy, v_unit_bunch, 'fresh-spring-onion', 'Fresh Spring Onion (Lili Dungri)', 'તાજી લીલી ડુંગળી', 'Fresh crisp green spring onions with tender bulbs.', 'તાજી, કડક અને સ્વાદિષ્ટ લીલી ડુંગળી.', 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=600&auto=format&fit=crop&q=80', 10, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'SPRING-ONION-250G', '1 Bunch (~250g)', '૧ જુડી (૨૫૦ ગ્રામ)', 1.000, 25.00, 15.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'SPRING-ONION-500G', '2 Bunches (~500g)', '૨ જુડી (૫૦૦ ગ્રામ)', 2.000, 48.00, 28.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 11. Kankoda / Kantola (કંકોડા - કંટોલા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock, is_seasonal)
    VALUES (v_cat_gourds, v_unit_kg, 'fresh-kankoda', 'Fresh Kankoda / Kantola (Spiny Gourd)', 'તાજા દેશી કંકોડા (કંટોલા)', 'Seasonal nutrient-rich fresh spiny gourd from local farms.', 'પૌષ્ટિક અને તાજા દેશી કંકોડા.', 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80', 11, true, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true, is_seasonal = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'KANKODA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 45.00, 28.00, true, 1, true),
    (v_prod_id, v_unit_kg, 'KANKODA-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 85.00, 55.00, false, 2, true),
    (v_prod_id, v_unit_kg, 'KANKODA-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 165.00, 110.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 12. Fudino / Fresh Mint (ફુદીનો)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_bunch, 'fresh-mint', 'Fresh Mint Leaves (Fudino)', 'તાજો સુગંધિત ફુદીનો', 'Fragrant, fresh, refreshing green mint leaves.', 'તાજી સુગંધથી ભરપૂર લીલા ફુદીનાની જુડી.', 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=600&auto=format&fit=crop&q=80', 12, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'MINT-100G', '1 Bunch (~100g)', '૧ જુડી (૧૦૦ ગ્રામ)', 1.000, 15.00, 7.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'MINT-250G', 'Large Bunch (~250g)', 'મોટી જુડી (૨૫૦ ગ્રામ)', 2.500, 32.00, 16.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 13. Capsicum (કેપ્સીકમ - શિમલા મરચાં)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'fresh-capsicum', 'Fresh Green Capsicum (Shimla Mirch)', 'તાજા લીલા કેપ્સીકમ (શિમલા મરચાં)', 'Crisp, sweet, deep green bell peppers.', 'તાજા, ક્રિસ્પી અને સ્વાદિષ્ટ કેપ્સીકમ.', 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80', 13, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'CAPSICUM-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 20.00, 10.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'CAPSICUM-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 38.00, 20.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'CAPSICUM-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 72.00, 40.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 14. Tikha Marcha / Spicy Green Chilli (તીખા લીલા મરચાં)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_kg, 'green-chilli', 'Spicy Green Chilli (Tikha Marcha)', 'તીખા દેશી લીલા મરચાં', 'Fresh hot green chillies, crisp and spicy.', 'તીખા અને તાજા દેશી લીલા મરચાં.', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80', 14, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'MARCHA-100G', '100 Grams', '૧૦૦ ગ્રામ', 0.100, 12.00, 5.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'MARCHA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 24.00, 10.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'MARCHA-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 45.00, 20.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 15. Mora Marcha / Mild Long Chilli (મોરા મરચાં - ભજીયાના)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_kg, 'mora-marcha-lamba', 'Mild Long Green Chilli (Bhajiya Marcha)', 'લાંબા મોરા મરચાં (ભજીયા માટે)', 'Mild light green long chillies, ideal for stuffing and bhajiyas.', 'ભજીયા અને સંભારા માટે ઉત્તમ લાંબા મોરા મરચાં.', 'https://images.unsplash.com/photo-1592417817098-8f3d6eb2251a?w=600&auto=format&fit=crop&q=80', 15, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'MORA-MARCHA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 20.00, 9.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'MORA-MARCHA-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 38.00, 17.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'MORA-MARCHA-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 70.00, 32.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 16. Karela / Bitter Gourd (કારેલા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_gourds, v_unit_kg, 'fresh-karela', 'Fresh Bitter Gourd (Karela)', 'તાજા કૂમળા દેશી કારેલા', 'Firm green non-fibrous bitter gourds, rich in health benefits.', 'કૂમળા અને ઉત્તમ ગુણવત્તાવાળા દેશી કારેલા.', 'https://images.unsplash.com/photo-1589135233689-d56d1134a627?w=600&auto=format&fit=crop&q=80', 16, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'KARELA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 18.00, 9.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'KARELA-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 32.00, 16.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'KARELA-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 60.00, 32.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 17. Fulevar / Cauliflower (ફુલેવર - ફૂલગોભી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_piece, 'fresh-cauliflower', 'Fresh White Cauliflower (Fulevar)', 'તાજુ સફેદ ફુલેવર (ફૂલગોભી)', 'Compact, snow-white fresh cauliflower florets.', 'તાજુ અને કડક સફેદ ફુલેવર.', 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=600&auto=format&fit=crop&q=80', 17, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_piece, 'CAULIFLOWER-1PC', '1 Medium Head (~500-700g)', '૧ નંગ (૫૦૦-૭૦૦ ગ્રામ)', 1.000, 30.00, 14.00, true, 1, true),
    (v_prod_id, v_unit_piece, 'CAULIFLOWER-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.500, 55.00, 25.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 18. Gavar / Cluster Beans (ગવારસિંગ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'fresh-gavar', 'Tender Cluster Beans (Gavar)', 'કૂમળી દેશી ગવારસિંગ', 'Tender, fresh, non-fibrous cluster beans.', 'એકદમ કૂમળી અને તાજી દેશી ગવાર.', 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80', 18, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'GAVAR-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 25.00, 12.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'GAVAR-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 48.00, 22.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'GAVAR-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 90.00, 42.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 19. Aadu / Fresh Ginger (આદુ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_herbs, v_unit_kg, 'fresh-ginger', 'Fresh Aromatic Ginger (Aadu)', 'તાજુ દેશી આદુ', 'Clean, strong aromatic ginger roots with thin skin.', 'સ્વાદ અને સુગંધથી ભરપૂર તાજુ દેશી આદુ.', 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&auto=format&fit=crop&q=80', 19, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'GINGER-100G', '100 Grams', '૧૦૦ ગ્રામ', 0.100, 18.00, 9.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'GINGER-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 40.00, 20.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'GINGER-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 75.00, 40.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 20. Ringan / Brinjal / Eggplant (રીંગણ - ઓળો / રવૈયા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'fresh-brinjal', 'Fresh Brinjal / Eggplant (Ringan)', 'તાજા દેશી રીંગણ (ઓળા/રવૈયા)', 'Shiny, fresh, tender purple & green brinjals for bharthu or stuffed sabji.', 'ઓળો અને રવૈયા માટે તાજા દેશી રીંગણ.', 'https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?w=600&auto=format&fit=crop&q=80', 20, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'BRINJAL-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 38.00, 25.00, true, 1, true),
    (v_prod_id, v_unit_kg, 'BRINJAL-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 70.00, 48.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 21. Parvar / Pointed Gourd (પરવર)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_gourds, v_unit_kg, 'fresh-parvar', 'Fresh Pointed Gourd (Parwal / Parvar)', 'તાજા લીલા પરવર', 'Crisp and tender green pointed gourds.', 'કૂમળા અને તાજા લીલા પરવર.', 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&auto=format&fit=crop&q=80', 21, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'PARVAR-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 18.00, 9.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'PARVAR-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 32.00, 16.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'PARVAR-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 60.00, 30.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 22. Valor / Flat Beans (વાલોર પાપડી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'fresh-valor', 'Tender Valor Papdi (Flat Beans)', 'કૂમળી વાલોર પાપડી', 'Sweet tender flat beans, essential for Gujarati undhiyu and muthia sabji.', 'ઉંધિયું અને શાક માટે તાજી વાલોર પાપડી.', 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=600&auto=format&fit=crop&q=80', 22, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'VALOR-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 30.00, 17.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'VALOR-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 58.00, 33.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'VALOR-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 110.00, 65.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 23. Ghiloda / Tindora / Ivy Gourd (ઘીલોડા - ટીંડોળા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_gourds, v_unit_kg, 'fresh-ghiloda', 'Fresh Tindora / Ghiloda (Ivy Gourd)', 'તાજા કૂમળા ઘીલોડા (ટીંડોળા)', 'Crisp, tender, green ivy gourd for quick stir fry.', 'કૂમળા અને તાજા દેશી ઘીલોડા (ટીંડોળા).', 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80', 23, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'GHILODA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 22.00, 13.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'GHILODA-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 40.00, 25.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'GHILODA-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 75.00, 48.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 24. Makai / Sweet Corn Cob (મકાઈનો દોડો)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_piece, 'fresh-sweet-corn', 'Fresh Sweet Corn Cob (Makai)', 'તાજી દેશી મીઠી મકાઈ (દોડો)', 'Juicy, tender sweet corn cobs with fresh green husk.', 'તાજી, મીઠી અને રસદાર દેશી મકાઈ.', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80', 24, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_piece, 'CORN-1PC', '1 Fresh Cob', '૧ નંગ', 1.000, 18.00, 9.00, true, 1, true),
    (v_prod_id, v_unit_piece, 'CORN-2PC', '2 Fresh Cobs', '૨ નંગ', 2.000, 34.00, 17.00, false, 2, true),
    (v_prod_id, v_unit_piece, 'CORN-4PC', '4 Fresh Cobs', '૪ નંગ', 4.000, 64.00, 32.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 25. Bhinda / Okra / Ladyfinger (ભીંડા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_daily, v_unit_kg, 'tender-bhindi', 'Tender Green Bhindi (Okra)', 'કૂમળા લીલા ભીંડા', 'Tender non-fibrous lady fingers picked early morning.', 'એકદમ કૂમળા અને તાજા લીલા ભીંડા.', 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80', 25, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'BHINDI-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 15.00, 8.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'BHINDI-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 28.00, 15.00, true, 2, true),
    (v_prod_id, v_unit_kg, 'BHINDI-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 52.00, 28.00, false, 3, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 26. Pattarveli Paan / Patra Leaves (પત્તરવેલીના પાન)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_leafy, v_unit_bunch, 'fresh-patra-leaves', 'Fresh Patra Leaves (Pattarveli Paan)', 'તાજા પત્તરવેલીના પાન (પાત્રા માટે)', 'Fresh, large, intact colocasia leaves for making traditional Gujarati patra.', 'પાત્રા બનાવવા માટે તાજા અને મુલાયમ પત્તરવેલીના પાન.', 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&auto=format&fit=crop&q=80', 26, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'PATRA-5PC', 'Pack of 5-6 Leaves', '૫-૬ પાનની જુડી', 1.000, 35.00, 18.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'PATRA-10PC', 'Pack of 10-12 Leaves', '૧૦-૧૨ પાનની જુડી', 2.000, 65.00, 35.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 27. Kolu / Pumpkin (કોળુ - કદ્દૂ)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_gourds, v_unit_kg, 'fresh-pumpkin', 'Fresh Sweet Pumpkin (Kolu / Kaddu)', 'તાજું મીઠું કોળુ (કદ્દૂ)', 'Fresh orange/yellow sweet pumpkin for sambar, sabji, and halwa.', 'મીઠું, સ્વાદિષ્ટ અને તાજું દેશી કોળુ.', 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&auto=format&fit=crop&q=80', 27, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'PUMPKIN-500G', '500 Grams Cut', '૫૦૦ ગ્રામ ટુકડો', 0.500, 18.00, 9.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'PUMPKIN-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 30.00, 16.00, true, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 28. Safarjan / Apple (સફરજન)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-apple', 'Fresh Shimla / Royal Apple', 'તાજા લાલ સફરજન', 'Crisp, sweet, and juicy handpicked mountain apples.', 'મીઠા, રસદાર અને તાજા લાલ સફરજન.', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80', 28, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'APPLE-500G', '500 Grams (~2-3 Pcs)', '૫૦૦ ગ્રામ (૨-૩ નંગ)', 0.500, 75.00, 50.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'APPLE-1KG', '1 Kilogram (~5-6 Pcs)', '૧ કિલોગ્રામ (૫-૬ નંગ)', 1.000, 140.00, 95.00, true, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- 29. Kela / Banana (પાકાં કેળાં)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_dozen, 'fresh-banana', 'Fresh Robusta Banana (Kela)', 'તાજા મીઠા પાકાં કેળાં', 'Naturally ripened sweet bananas packed with energy and potassium.', 'કુદરતી રીતે પાકેલા મીઠા અને તાજા કેળાં.', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80', 29, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_dozen, 'BANANA-6PC', 'Half Dozen (6 Pcs)', 'અડધો ડઝન (૬ નંગ)', 0.500, 25.00, 12.00, false, 1, true),
    (v_prod_id, v_unit_dozen, 'BANANA-1DOZ', '1 Full Dozen (12 Pcs)', '૧ ડઝન (૧૨ નંગ)', 1.000, 48.00, 24.00, true, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

    -- Palak (Spinach) - keep active
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_leafy, v_unit_bunch, 'fresh-palak', 'Fresh Farm Palak (Spinach)', 'તાજી પાલક ભાજી', 'Clean sorted green spinach bunch, washed and trimmed.', 'તાજી અને હરિયાળી પાલક ની જુડી.', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80', 30, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, image_url = EXCLUDED.image_url, display_order = 30, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_bunch, 'PALAK-1BUNCH', '1 Fresh Bunch (~250g)', '૧ જુડી (આશરે ૨૫૦ ગ્રામ)', 1.000, 20.00, 10.00, true, 1, true),
    (v_prod_id, v_unit_bunch, 'PALAK-2BUNCH', '2 Fresh Bunches (~500g)', '૨ જુડી (આશરે ૫૦૦ ગ્રામ)', 2.000, 36.00, 18.00, false, 2, true)
    ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        unit_id = EXCLUDED.unit_id,
        variant_name_en = EXCLUDED.variant_name_en,
        variant_name_gu = EXCLUDED.variant_name_gu,
        multiplier_to_base_unit = EXCLUDED.multiplier_to_base_unit,
        selling_price = EXCLUDED.selling_price,
        current_estimated_cost = EXCLUDED.current_estimated_cost,
        is_default = EXCLUDED.is_default,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active;

END $$;

COMMIT;
