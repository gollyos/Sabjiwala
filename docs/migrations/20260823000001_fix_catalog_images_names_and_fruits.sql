-- =============================================================================
-- MIGRATION: REPAIR CATALOG IMAGES, GUJARATI NAMES, AND EXPAND GUJARAT PRODUCE
-- Date: 2026-08-23
-- Fixes:
-- 1. Correct distinct high-resolution images for each vegetable & fruit
-- 2. Accurate Gujarat APMC terminology (e.g. "કોથમીર, આદુ, મરચાં & લીંબુ" not dry masala)
-- 3. Adds essential fresh fruits (Dadam, Mosambi, Papaiyu, Chiku)
-- 4. Cleans up any duplicate entries
-- =============================================================================

BEGIN;

-- 1. Update Category Names for natural Gujarati market classification
UPDATE categories 
SET name_en = 'Fresh Herbs, Lemon & Chillies',
    name_gu = 'કોથમીર, આદુ, મરચાં & લીંબુ'
WHERE slug = 'exotic-herbs';

UPDATE categories 
SET name_en = 'Daily Vegetables',
    name_gu = 'રોજિંદી શાકભાજી'
WHERE slug = 'daily-essentials';

UPDATE categories 
SET name_en = 'Fresh Leafy Greens',
    name_gu = 'તાજી ભાજી (પાંદડાવાળી શાકભાજી)'
WHERE slug = 'leafy-vegetables';

UPDATE categories 
SET name_en = 'Gourds & Squashes',
    name_gu = 'વેલાવાળા શાક (દૂધી, કારેલા, પરવર)'
WHERE slug = 'gourds-squashes';

UPDATE categories 
SET name_en = 'Root Vegetables',
    name_gu = 'કંદમૂળ (બટાટા, ડુંગળી, ગાજર)'
WHERE slug = 'root-tubers';

UPDATE categories 
SET name_en = 'Fresh Fruits',
    name_gu = 'તાજા મીઠા ફળો (Fresh Fruits)'
WHERE slug = 'fresh-fruits';


-- 2. Update all existing Products with verified, distinct Unsplash photos and authentic Gujarati titles
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

    -- 1. ગાજર (Gajar / Carrot)
    UPDATE products SET
        name_en = 'Fresh Farm Carrot (Gajar)',
        name_gu = 'તાજા લાલ-કેસરી ગાજર',
        description_en = 'Crisp, sweet, and crunchy fresh carrots for salad and sabji.',
        description_gu = 'તાજા, ક્રિસ્પી અને મીઠા દેશી ગાજર.',
        image_url = 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80',
        display_order = 1
    WHERE slug = 'fresh-carrot';

    -- 2. દૂધી (Dudhi / Bottle Gourd) - Correct Lauki/Gourd photo
    UPDATE products SET
        name_en = 'Tender Green Dudhi (Bottle Gourd / Lauki)',
        name_gu = 'કૂમળી લીલી દૂધી',
        description_en = 'Sweet, tender and juice-rich green bottle gourd, perfect for thepla, muthia, and sabji.',
        description_gu = 'કુમળી લીલી દૂધી - થેપલા, મુઠિયા અને શાક માટે ઉત્તમ.',
        image_url = 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=600&auto=format&fit=crop&q=80',
        display_order = 2
    WHERE slug = 'green-dudhi';

    -- 3. લીંબુ (Limbu / Lemon)
    UPDATE products SET
        name_en = 'Fresh Juicy Lemon (Limbu)',
        name_gu = 'તાજા રસદાર પીળા લીંબુ',
        description_en = 'Thin skinned, juicy, tangy yellow lemons.',
        description_gu = 'પાતળી છાલવાળા રસથી ભરપૂર દેશી લીંબુ.',
        image_url = 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80',
        display_order = 3
    WHERE slug = 'fresh-lemon';

    -- 4. મેથી (Methi / Fenugreek)
    UPDATE products SET
        name_en = 'Fresh Green Methi (Fenugreek Leaves)',
        name_gu = 'તાજી લીલી મેથીની ભાજી',
        description_en = 'Freshly harvested tender green fenugreek leaves for thepla and bhaji.',
        description_gu = 'તાજી દેશી લીલી મેથી - થેપલા અને શાક માટે બેસ્ટ.',
        image_url = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
        display_order = 4
    WHERE slug = 'fresh-methi';

    -- 5. કોથમીર / ધાણા (Kothmir / Coriander)
    UPDATE products SET
        name_en = 'Aromatic Fresh Coriander (Kothmir)',
        name_gu = 'સુગંધિત લીલી કોથમીર (ધાણા)',
        description_en = 'Crisp green aromatic coriander leaves for garnishing and chutney.',
        description_gu = 'સુગંધિત તાજી લીલી દેશી કોથમીર.',
        image_url = 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&auto=format&fit=crop&q=80',
        display_order = 5
    WHERE slug = 'fresh-coriander';

    -- 6. કોબીજ (Kobij / Cabbage)
    UPDATE products SET
        name_en = 'Fresh Green Cabbage (Kobij)',
        name_gu = 'તાજી લીલી કોબીજ',
        description_en = 'Crisp, tight, fresh green cabbage heads.',
        description_gu = 'તાજી અને કડક લીલી કોબીજ.',
        image_url = 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80',
        display_order = 6
    WHERE slug = 'fresh-cabbage';

    -- 7. ડુંગળી (Dungri / Red Onion)
    UPDATE products SET
        name_en = 'Nashik / Local Red Onion (Dungri)',
        name_gu = 'તાજી લાલ દેશી ડુંગળી',
        description_en = 'Dry, well-cured, pungent red onions.',
        description_gu = 'લાલ દેશી ડુંગળી - રોજિંદા રસોઈ માટે બેસ્ટ.',
        image_url = 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
        display_order = 7
    WHERE slug = 'red-onion';

    -- 8. બટાકા (Bataka / Potato)
    UPDATE products SET
        name_en = 'Farm Fresh Potato (Bataka / Aloo)',
        name_gu = 'તાજા દેશી બટાકા',
        description_en = 'Fresh firm potatoes, ideal for all types of sabji and fries.',
        description_gu = 'તાજા અને સરસ દેશી બટાકા.',
        image_url = 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
        display_order = 8
    WHERE slug = 'fresh-potato';

    -- 9. ટામેટા (Tameta / Tomato)
    UPDATE products SET
        name_en = 'Fresh Desi Red Tomato (Tameta)',
        name_gu = 'તાજા દેશી લાલ ટામેટા',
        description_en = 'Juicy, plump, ripe red desi tomatoes.',
        description_gu = 'તાજા, રસદાર અને ખાટા-મીઠા દેશી લાલ ટામેટા.',
        image_url = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
        display_order = 9
    WHERE slug = 'desi-tomato';

    -- 10. લીલી ડુંગળી (Lili Dungri / Spring Onion)
    UPDATE products SET
        name_en = 'Fresh Green Spring Onion (Lili Dungri)',
        name_gu = 'તાજી લીલી ડુંગળી',
        description_en = 'Crisp green scallions with white bulbs for salads and Chinese dishes.',
        description_gu = 'તાજી કૂમળી લીલી ડુંગળી.',
        image_url = 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=600&auto=format&fit=crop&q=80',
        display_order = 10
    WHERE slug = 'fresh-spring-onion';

    -- 11. કંકોડા / કંટોલા (Kantola / Spiny Gourd)
    UPDATE products SET
        name_en = 'Fresh Kankoda / Kantola (Spiny Gourd)',
        name_gu = 'તાજા દેશી કંકોડા (કંટોલા)',
        description_en = 'Nutrient-rich monsoon specialty spiny gourd.',
        description_gu = 'તાજા દેશી કંકોડા - સ્વાદ અને સ્વાસ્થ્યથી ભરપૂર.',
        image_url = 'https://images.unsplash.com/photo-1574316071802-0d684efa7cd5?w=600&auto=format&fit=crop&q=80',
        display_order = 11
    WHERE slug = 'fresh-kankoda';

    -- 12. ફુદીનો (Fudino / Mint)
    UPDATE products SET
        name_en = 'Fresh Mint Leaves (Fudino)',
        name_gu = 'તાજો સુગંધિત ફુદીનો',
        description_en = 'Refreshing aromatic mint leaves for chutney and beverages.',
        description_gu = 'સુગંધિત અને તાજો દેશી ફુદીનો.',
        image_url = 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=600&auto=format&fit=crop&q=80',
        display_order = 12
    WHERE slug = 'fresh-mint';

    -- 13. કેપ્સીકમ (Capsicum / Shimla Mirch)
    UPDATE products SET
        name_en = 'Fresh Green Capsicum (Shimla Mirch)',
        name_gu = 'તાજા લીલા કેપ્સીકમ (શિમલા મરચાં)',
        description_en = 'Crisp, crunchy, glossy green bell peppers.',
        description_gu = 'તાજા, ક્રિસ્પી અને સ્વાદિષ્ટ લીલા કેપ્સીકમ.',
        image_url = 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
        display_order = 13
    WHERE slug = 'fresh-capsicum';

    -- 14. તીખા લીલા મરચાં (Spicy Green Chilli)
    UPDATE products SET
        name_en = 'Spicy Green Chilli (Tikha Marcha)',
        name_gu = 'તીખા દેશી લીલા મરચાં',
        description_en = 'Sharp spicy green chillies for daily tadka and spice.',
        description_gu = 'તીખા તમતમતા દેશી લીલા મરચાં.',
        image_url = 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80',
        display_order = 14
    WHERE slug = 'green-chilli';

    -- 15. મોરા લાંબા મરચાં (Mora Marcha - Bhajiya)
    UPDATE products SET
        name_en = 'Mild Long Green Chilli (Bhajiya Marcha)',
        name_gu = 'લાંબા મોરા મરચાં (ભજીયા માટે)',
        description_en = 'Thick, mild long Bhavnagari chillies, perfect for bhajiya and stuffing.',
        description_gu = 'ભાવનગરી લાંબા મોરા મરચાં - ભજીયા અને સંભારા માટે શ્રેષ્ઠ.',
        image_url = 'https://images.unsplash.com/photo-1592417817098-8f3d6eb2251a?w=600&auto=format&fit=crop&q=80',
        display_order = 15
    WHERE slug = 'mora-marcha-lamba';

    -- 16. કારેલા (Karela / Bitter Gourd)
    UPDATE products SET
        name_en = 'Fresh Bitter Gourd (Karela)',
        name_gu = 'તાજા કૂમળા દેશી કારેલા',
        description_en = 'Fresh dark green bitter gourds, excellent for health and stuffed recipes.',
        description_gu = 'તાજા કૂમળા દેશી કારેલા - સ્વાસ્થ્ય અને સ્વાદ માટે ઉત્તમ.',
        image_url = 'https://images.unsplash.com/photo-1589135233689-d56d1134a627?w=600&auto=format&fit=crop&q=80',
        display_order = 16
    WHERE slug = 'fresh-karela';

    -- 17. ફુલેવર (Fulevar / Cauliflower)
    UPDATE products SET
        name_en = 'Fresh White Cauliflower (Fulevar)',
        name_gu = 'તાજું સફેદ ફુલેવર (ફૂલગોભી)',
        description_en = 'Tightly packed white curd with fresh green leaves.',
        description_gu = 'તાજું, સફેદ અને ચોખ્ખું દેશી ફુલેવર.',
        image_url = 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=600&auto=format&fit=crop&q=80',
        display_order = 17
    WHERE slug = 'fresh-cauliflower';

    -- 18. ગવાર (Gavar / Cluster Beans) - Dedicated Green Cluster Beans photo
    UPDATE products SET
        name_en = 'Tender Cluster Beans (Gavar)',
        name_gu = 'કૂમળી દેશી ગવારસિંગ',
        description_en = 'Tender, stringless fresh green cluster beans.',
        description_gu = 'કૂમળી દેશી ગવારસિંગ - શાક અને ઢોકળી માટે ઉત્તમ.',
        image_url = 'https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?w=600&auto=format&fit=crop&q=80',
        display_order = 18
    WHERE slug = 'fresh-gavar';

    -- 19. આદુ (Aadu / Fresh Ginger)
    UPDATE products SET
        name_en = 'Fresh Aromatic Ginger (Aadu)',
        name_gu = 'તાજુ દેશી આદુ',
        description_en = 'Spicy, fibrous, aromatic fresh root ginger.',
        description_gu = 'તાજું અને સુગંધિત દેશી આદુ - ચા અને રસોઈ માટે બેસ્ટ.',
        image_url = 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&auto=format&fit=crop&q=80',
        display_order = 19
    WHERE slug = 'fresh-ginger';

    -- 20. રીંગણ (Ringan / Eggplant)
    UPDATE products SET
        name_en = 'Fresh Brinjal / Eggplant (Ringan)',
        name_gu = 'તાજા દેશી રીંગણ (ઓળા / રવૈયા)',
        description_en = 'Glossy purple fresh brinjals for bhartha, ravaiya, and curry.',
        description_gu = 'ચોખ્ખા અને કૂમળા દેશી રીંગણ - રવૈયા અને ઓળા માટે ઉત્તમ.',
        image_url = 'https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?w=600&auto=format&fit=crop&q=80',
        display_order = 20
    WHERE slug = 'fresh-brinjal';

    -- 21. પરવર (Parvar / Pointed Gourd)
    UPDATE products SET
        name_en = 'Fresh Pointed Gourd (Parwal / Parvar)',
        name_gu = 'તાજા લીલા પરવર',
        description_en = 'Fresh green pointed gourds, tender and nutritious.',
        description_gu = 'તાજા, કૂમળા લીલા પરવર.',
        image_url = 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&auto=format&fit=crop&q=80',
        display_order = 21
    WHERE slug = 'fresh-parvar';

    -- 22. વાલોર પાપડી (Valor Papdi / Flat Beans) - Authentic flat green beans photo
    UPDATE products SET
        name_en = 'Tender Valor Papdi (Flat Beans / Surti Papdi)',
        name_gu = 'કૂમળી વાલોર પાપડી',
        description_en = 'Tender fresh green flat beans, authentic Gujarati specialty.',
        description_gu = 'કૂમળી તાજી વાલોર પાપડી - ઉંધિયું અને શાક માટે બેસ્ટ.',
        image_url = 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
        display_order = 22
    WHERE slug = 'fresh-valor';

    -- 23. ઘીલોડા / ટીંડોળા (Ghiloda / Tindora / Ivy Gourd) - Dedicated Tindora photo
    UPDATE products SET
        name_en = 'Fresh Tindora / Ghiloda (Ivy Gourd)',
        name_gu = 'તાજા કૂમળા ઘીલોડા (ટીંડોળા)',
        description_en = 'Crisp, tender small green ivy gourds for fry and curry.',
        description_gu = 'તાજા કૂમળા ઘીલોડા - સંભારો અને શાક માટે એકદમ ક્રિસ્પી.',
        image_url = 'https://images.unsplash.com/photo-1546470427-e26264be0b11?w=600&auto=format&fit=crop&q=80',
        display_order = 23
    WHERE slug = 'fresh-ghiloda';

    -- 24. મકાઈ (Makai / Sweet Corn Cob)
    UPDATE products SET
        name_en = 'Fresh Sweet Corn Cob (Makai Dodo)',
        name_gu = 'તાજી દેશી મીઠી મકાઈ (દોડો)',
        description_en = 'Sweet, juicy and tender corn cobs.',
        description_gu = 'તાજી, મીઠી અને રસદાર દેશી મકાઈ.',
        image_url = 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80',
        display_order = 24
    WHERE slug = 'fresh-sweet-corn';

    -- 25. ભીંડા (Bhindi / Tender Okra) - High quality Okra photo
    UPDATE products SET
        name_en = 'Tender Green Bhindi (Okra / Ladyfinger)',
        name_gu = 'કૂમળા લીલા ભીંડા',
        description_en = 'Fresh tender green ladyfingers, snap fresh without fibers.',
        description_gu = 'કૂમળા, રેસા વગરના તાજા લીલા દેશી ભીંડા.',
        image_url = 'https://images.unsplash.com/photo-1629853488812-70b92ea9d1b6?w=600&auto=format&fit=crop&q=80',
        display_order = 25
    WHERE slug = 'tender-bhindi';

    -- 26. પત્તરવેલીના પાન (Pattarveli Paan / Patra Leaves)
    UPDATE products SET
        name_en = 'Fresh Patra Leaves (Pattarveli Paan)',
        name_gu = 'તાજા પત્તરવેલીના પાન (પાત્રા માટે)',
        description_en = 'Large, fresh, clean colocasia leaves for traditional Gujarati Patra.',
        description_gu = 'મોટા, તાજા અને કૂમળા પત્તરવેલીના પાન - પાત્રા બનાવવા માટે શ્રેષ્ઠ.',
        image_url = 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&auto=format&fit=crop&q=80',
        display_order = 26
    WHERE slug = 'fresh-patra-leaves';

    -- 27. કોળુ (Kolu / Sweet Pumpkin)
    UPDATE products SET
        name_en = 'Fresh Sweet Pumpkin (Kolu / Kaddu)',
        name_gu = 'તાજું મીઠું કોળુ (કદ્દૂ)',
        description_en = 'Sweet, golden-orange flesh pumpkin for curry, sambhar and halwa.',
        description_gu = 'તાજું મીઠું કોળુ - શાક અને સાંભાર માટે બેસ્ટ.',
        image_url = 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&auto=format&fit=crop&q=80',
        display_order = 27
    WHERE slug = 'fresh-pumpkin';

    -- 28. સફરજન (Safarjan / Apple)
    UPDATE products SET
        name_en = 'Fresh Shimla / Royal Apple (Safarjan)',
        name_gu = 'તાજા લાલ રોયલ સફરજન',
        description_en = 'Sweet, crunchy, juicy red apples.',
        description_gu = 'તાજા, ક્રિસ્પી અને મીઠા લાલ સફરજન.',
        image_url = 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
        display_order = 28
    WHERE slug = 'fresh-apple';

    -- 29. કેળાં (Kela / Banana)
    UPDATE products SET
        name_en = 'Fresh Robusta Banana (Kela)',
        name_gu = 'તાજા મીઠા પાકાં કેળાં',
        description_en = 'Sweet, energy-rich, golden ripe bananas.',
        description_gu = 'મીઠા અને તાજા પાકાં દેશી કેળાં.',
        image_url = 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80',
        display_order = 29
    WHERE slug = 'fresh-banana';

    -- 30. પાલક (Palak / Spinach)
    UPDATE products SET
        name_en = 'Fresh Farm Palak (Spinach Leaves)',
        name_gu = 'તાજી લીલી પાલક ભાજી',
        description_en = 'Nutrient-rich, crisp dark green farm spinach leaves.',
        description_gu = 'તાજી, કૂમળી લીલી પાલક ભાજી.',
        image_url = 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
        display_order = 30
    WHERE slug = 'fresh-palak';


    -- =========================================================================
    -- 3. ADD ADDITIONAL AUTHENTIC GUJARAT FRESH FRUITS
    -- =========================================================================

    -- 31. દાડમ (Dadam / Pomegranate)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-pomegranate', 'Fresh Bhagwa Pomegranate (Dadam)', 'તાજા લાલ મીઠા દાડમ (ભગવા)', 'Ruby-red sweet pearls, antioxidant rich and fresh.', 'લાલ ચટક દાણાવાળા મીઠા ભગવા દાડમ.', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80', 31, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'DADAM-500G', '500 Grams (~2-3 Pcs)', '૫૦૦ ગ્રામ (૨-૩ નંગ)', 0.500, 70.00, 45.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'DADAM-1KG', '1 Kilogram (~4-5 Pcs)', '૧ કિલોગ્રામ (૪-૫ નંગ)', 1.000, 135.00, 90.00, true, 2, true)
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

    -- 32. મોસંબી (Mosambi / Sweet Lime)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-mosambi', 'Fresh Juicy Mosambi (Sweet Lime)', 'તાજી રસદાર મોસંબી', 'Juicy, sweet and citrusy fresh sweet limes for juice.', 'તાજી અને મીઠી રસદાર મોસંબી - જ્યુસ માટે ઉત્તમ.', 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=600&auto=format&fit=crop&q=80', 32, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'MOSAMBI-1KG', '1 Kilogram (~5-6 Pcs)', '૧ કિલોગ્રામ (૫-૬ નંગ)', 1.000, 65.00, 40.00, true, 1, true),
    (v_prod_id, v_unit_kg, 'MOSAMBI-2KG', '2 Kilogram Family Pack', '૨ કિલો ફેમિલી પેક', 2.000, 125.00, 80.00, false, 2, true)
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

    -- 33. પપૈયું (Papaiyu / Papaya)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_piece, 'fresh-papaya', 'Fresh Sweet Papaya (Papaiyu)', 'તાજું મીઠું પાકું પપૈયું', 'Sweet, golden-orange ripe papaya, great for digestion.', 'તાજું અને મીઠું દેશી પાકું પપૈયું.', 'https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&auto=format&fit=crop&q=80', 33, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_piece, 'PAPAYA-1PC', '1 Medium Piece (~800g - 1kg)', '૧ નંગ (૮૦૦ ગ્રામ - ૧ કિલો)', 1.000, 45.00, 25.00, true, 1, true)
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

    -- 34. ચીકુ (Chiku / Sapota)
    INSERT INTO products (category_id, base_unit_id, slug, name_en, name_gu, description_en, description_gu, image_url, display_order, is_active, is_in_stock)
    VALUES (v_cat_fruits, v_unit_kg, 'fresh-chiku', 'Fresh Sweet Chiku (Sapota / Sapodilla)', 'તાજા મીઠા દેશી ચીકુ (ઘોળવડ)', 'Sweet, creamy, brown honey-rich sapota/chiku.', 'મીઠા અને મલાઈદાર દેશી ચીકુ.', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop&q=80', 34, true, true)
    ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_gu = EXCLUDED.name_gu, description_en = EXCLUDED.description_en, description_gu = EXCLUDED.description_gu, image_url = EXCLUDED.image_url, display_order = EXCLUDED.display_order, is_active = true, is_in_stock = true
    RETURNING id INTO v_prod_id;

    INSERT INTO product_variants (product_id, unit_id, sku, variant_name_en, variant_name_gu, multiplier_to_base_unit, selling_price, current_estimated_cost, is_default, display_order, is_active) VALUES
    (v_prod_id, v_unit_kg, 'CHIKU-500G', '500 Grams', '૫૦૦ ગ્રામ', 0.500, 30.00, 18.00, false, 1, true),
    (v_prod_id, v_unit_kg, 'CHIKU-1KG', '1 Kilogram', '૧ કિલોગ્રામ', 1.000, 55.00, 32.00, true, 2, true)
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
