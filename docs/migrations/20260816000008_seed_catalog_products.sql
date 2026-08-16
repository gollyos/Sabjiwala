-- =============================================================================
-- SEED CATALOG PRODUCTS & VARIANTS FOR HALOL
-- Daily fresh vegetables with English & Gujarati names, multi-variants
-- =============================================================================

BEGIN;

-- Helper variables
DO $$
DECLARE
    v_cat_daily UUID;
    v_cat_leafy UUID;
    v_cat_gourds UUID;
    v_cat_root UUID;
    v_cat_herbs UUID;
    v_unit_kg UUID;
    v_unit_gram UUID;
    v_unit_piece UUID;
    v_unit_bunch UUID;
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_cat_daily FROM categories WHERE slug = 'daily-essentials';
    SELECT id INTO v_cat_leafy FROM categories WHERE slug = 'leafy-vegetables';
    SELECT id INTO v_cat_gourds FROM categories WHERE slug = 'gourds-squashes';
    SELECT id INTO v_cat_root FROM categories WHERE slug = 'root-tubers';
    SELECT id INTO v_cat_herbs FROM categories WHERE slug = 'exotic-herbs';

    SELECT id INTO v_unit_kg FROM product_units WHERE code = 'kg';
    SELECT id INTO v_unit_gram FROM product_units WHERE code = 'gram';
    SELECT id INTO v_unit_piece FROM product_units WHERE code = 'piece';
    SELECT id INTO v_unit_bunch FROM product_units WHERE code = 'bunch';

    -- 1. Desi Tomato (ટામેટા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_daily, v_unit_kg, 'desi-tomato', 'Fresh Desi Tomato', 'તાજા દેશી ટામેટા', 'Farm-fresh juicy sour-sweet desi tomatoes from Halol outskirts.', 'ખેતરમાંથી તાજા ચૂંટેલા લાલચટક દેશી ટામેટા.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60', 1)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'TOMATO-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 20.00, 14.00, false, 1),
    (v_prod_id, v_unit_kg, 'TOMATO-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 38.00, 28.00, true, 2);

    -- 2. Fresh Potato / Bataka (બટાટા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_root, v_unit_kg, 'fresh-potato', 'Farm Fresh Potato (Batata)', 'તાજા બટાટા', 'Top grade sorting potatoes, thin skin, ideal for daily sabji.', 'ઉત્તમ ગુણવત્તાવાળા બટાટા.', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60', 2)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'POTATO-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 30.00, 22.00, true, 1),
    (v_prod_id, v_unit_kg, 'POTATO-2KG', '2 Kilograms', '૨ કિલોગ્રામ', 2.000, 58.00, 42.00, false, 2);

    -- 3. Red Onion / Dungri (લાલ ડુંગળી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_root, v_unit_kg, 'red-onion', 'Nashik / Local Red Onion', 'તાજી લાલ ડુંગળી', 'Crisp pungent fresh onions sorted for maximum shelf life.', 'સ્વાદિષ્ટ અને તીખી લાલ ડુંગળી.', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=60', 3)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'ONION-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 35.00, 26.00, true, 1),
    (v_prod_id, v_unit_kg, 'ONION-2KG', '2 Kilograms', '૨ કિલોગ્રામ', 2.000, 68.00, 50.00, false, 2);

    -- 4. Bhindi / Okra (ભીંડા)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_daily, v_unit_kg, 'tender-bhindi', 'Tender Green Bhindi (Okra)', 'કૂમળા લીલા ભીંડા', 'Tender non-fibrous lady fingers picked early morning.', 'એકદમ કૂમળા અને તાજા લીલા ભીંડા.', 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=500&auto=format&fit=crop&q=60', 4)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'BHINDI-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 15.00, 10.00, false, 1),
    (v_prod_id, v_unit_kg, 'BHINDI-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 28.00, 20.00, true, 2),
    (v_prod_id, v_unit_kg, 'BHINDI-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 52.00, 38.00, false, 3);

    -- 5. Palak / Spinach (પાલક ભાજી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_leafy, v_unit_bunch, 'fresh-palak', 'Fresh Farm Palak (Spinach)', 'તાજી પાલક ભાજી', 'Clean sorted green spinach bunch, washed and trimmed.', 'તાજી અને હરિયાળી પાલક ની જુડી.', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop&q=60', 5)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_bunch, 'PALAK-1BUNCH', '1 Fresh Bunch (~250g)', '૧ જુડી (આશરે ૨૫૦ ગ્રામ)', 1.000, 20.00, 12.00, true, 1),
    (v_prod_id, v_unit_bunch, 'PALAK-2BUNCH', '2 Fresh Bunches (~500g)', '૨ જુડી (આશરે ૫૦૦ ગ્રામ)', 2.000, 36.00, 22.00, false, 2);

    -- 6. Dudhi / Bottle Gourd (દૂધી)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_gourds, v_unit_piece, 'green-dudhi', 'Tender Dudhi (Bottle Gourd)', 'કૂમળી ગોળ / લાંબી દૂધી', 'Sweet and juicy green bottle gourd, perfect for thepla and sabji.', 'કુમળી દૂધી - થેપલા અને શાક માટે ઉત્તમ.', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop&q=60', 6)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_piece, 'DUDHI-1PC', '1 Medium Piece (~600-800g)', '૧ નંગ (૬૦૦-૮૦૦ ગ્રામ)', 1.000, 25.00, 16.00, true, 1);

    -- 7. Fresh Coriander / Kothmir (લીલી કોથમીર)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_herbs, v_unit_bunch, 'fresh-coriander', 'Aromatic Fresh Coriander (Kothmir)', 'સુગંધિત લીલી કોથમીર', 'Super fresh aromatic coriander bunch from Halol farmers.', 'તાજી સુગંધિત દેશી કોથમીર.', 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=500&auto=format&fit=crop&q=60', 7)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_bunch, 'KOTHMIR-100G', '1 Bunch (~100g)', '૧ જુડી (૧૦૦ ગ્રામ)', 1.000, 15.00, 8.00, true, 1),
    (v_prod_id, v_unit_bunch, 'KOTHMIR-250G', 'Large Bunch (~250g)', 'મોટી જુડી (૨૫૦ ગ્રામ)', 2.500, 32.00, 18.00, false, 2);

    -- 8. Green Chilli / Marcha (તીખા લીલા મરચાં)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order)
    VALUES (v_cat_herbs, v_unit_kg, 'green-chilli', 'Spicy Green Chilli (Marcha)', 'તીખા લીલા મરચાં', 'Fresh hot green chillies, crisp and spicy.', 'તીખા અને તાજા લીલા મરચાં.', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500&auto=format&fit=crop&q=60', 8)
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order) VALUES
    (v_prod_id, v_unit_kg, 'MARCHA-100G', '100 Grams', '૧૦૦ ગ્રામ', 0.100, 10.00, 6.00, false, 1),
    (v_prod_id, v_unit_kg, 'MARCHA-250G', '250 Grams', '૨૫૦ ગ્રામ', 0.250, 22.00, 14.00, true, 2);

END $$;

COMMIT;
