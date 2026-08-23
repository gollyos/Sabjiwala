-- =============================================================================
-- MIGRATION: SIMPLIFY PRODUCT DISPLAY NAMES
-- Date: 2026-08-23
-- Only change: strip marketing filler ("Fresh", "Farm", "Tender", "તાજા/તાજી/તાજું",
-- "કૂમળી", etc.) from name_en / name_gu so the catalog shows just the
-- vegetable/fruit name (English name + local name in brackets, or the plain
-- Gujarati name). No other columns (description, image, price, category) touched.
-- =============================================================================

BEGIN;

UPDATE products SET name_en = 'Carrot (Gajar)', name_gu = 'ગાજર' WHERE slug = 'fresh-carrot';
UPDATE products SET name_en = 'Bottle Gourd (Dudhi)', name_gu = 'દૂધી' WHERE slug = 'green-dudhi';
UPDATE products SET name_en = 'Lemon (Limbu)', name_gu = 'લીંબુ' WHERE slug = 'fresh-lemon';
UPDATE products SET name_en = 'Fenugreek Leaves (Methi)', name_gu = 'મેથીની ભાજી' WHERE slug = 'fresh-methi';
UPDATE products SET name_en = 'Coriander (Kothmir)', name_gu = 'કોથમીર' WHERE slug = 'fresh-coriander';
UPDATE products SET name_en = 'Cabbage (Kobij)', name_gu = 'કોબીજ' WHERE slug = 'fresh-cabbage';
UPDATE products SET name_en = 'Onion (Dungri)', name_gu = 'ડુંગળી' WHERE slug = 'red-onion';
UPDATE products SET name_en = 'Potato (Bataka)', name_gu = 'બટાકા' WHERE slug = 'fresh-potato';
UPDATE products SET name_en = 'Tomato (Tameta)', name_gu = 'ટામેટા' WHERE slug = 'desi-tomato';
UPDATE products SET name_en = 'Spring Onion (Lili Dungri)', name_gu = 'લીલી ડુંગળી' WHERE slug = 'fresh-spring-onion';
UPDATE products SET name_en = 'Spiny Gourd (Kantola)', name_gu = 'કંટોલા' WHERE slug = 'fresh-kankoda';
UPDATE products SET name_en = 'Mint (Fudino)', name_gu = 'ફુદીનો' WHERE slug = 'fresh-mint';
UPDATE products SET name_en = 'Capsicum (Shimla Mirch)', name_gu = 'કેપ્સીકમ (શિમલા મરચાં)' WHERE slug = 'fresh-capsicum';
UPDATE products SET name_en = 'Green Chilli (Marcha)', name_gu = 'લીલા મરચાં' WHERE slug = 'green-chilli';
UPDATE products SET name_en = 'Long Chilli (Mora Marcha)', name_gu = 'મોરા મરચાં' WHERE slug = 'mora-marcha-lamba';
UPDATE products SET name_en = 'Bitter Gourd (Karela)', name_gu = 'કારેલા' WHERE slug = 'fresh-karela';
UPDATE products SET name_en = 'Cauliflower (Fulevar)', name_gu = 'ફુલેવર' WHERE slug = 'fresh-cauliflower';
UPDATE products SET name_en = 'Cluster Beans (Gavar)', name_gu = 'ગવારસિંગ' WHERE slug = 'fresh-gavar';
UPDATE products SET name_en = 'Ginger (Aadu)', name_gu = 'આદુ' WHERE slug = 'fresh-ginger';
UPDATE products SET name_en = 'Brinjal (Ringan)', name_gu = 'રીંગણ' WHERE slug = 'fresh-brinjal';
UPDATE products SET name_en = 'Pointed Gourd (Parvar)', name_gu = 'પરવર' WHERE slug = 'fresh-parvar';
UPDATE products SET name_en = 'Flat Beans (Valor Papdi)', name_gu = 'વાલોર પાપડી' WHERE slug = 'fresh-valor';
UPDATE products SET name_en = 'Ivy Gourd (Tindora)', name_gu = 'ટીંડોળા (ઘીલોડા)' WHERE slug = 'fresh-ghiloda';
UPDATE products SET name_en = 'Sweet Corn (Makai)', name_gu = 'મકાઈ' WHERE slug = 'fresh-sweet-corn';
UPDATE products SET name_en = 'Okra (Bhindi)', name_gu = 'ભીંડા' WHERE slug = 'tender-bhindi';
UPDATE products SET name_en = 'Patra Leaves (Pattarveli Paan)', name_gu = 'પત્તરવેલીના પાન' WHERE slug = 'fresh-patra-leaves';
UPDATE products SET name_en = 'Pumpkin (Kolu)', name_gu = 'કોળુ' WHERE slug = 'fresh-pumpkin';
UPDATE products SET name_en = 'Apple (Safarjan)', name_gu = 'સફરજન' WHERE slug = 'fresh-apple';
UPDATE products SET name_en = 'Banana (Kela)', name_gu = 'કેળાં' WHERE slug = 'fresh-banana';
UPDATE products SET name_en = 'Spinach (Palak)', name_gu = 'પાલક' WHERE slug = 'fresh-palak';
UPDATE products SET name_en = 'Pomegranate (Dadam)', name_gu = 'દાડમ' WHERE slug = 'fresh-pomegranate';
UPDATE products SET name_en = 'Sweet Lime (Mosambi)', name_gu = 'મોસંબી' WHERE slug = 'fresh-mosambi';
UPDATE products SET name_en = 'Papaya (Papaiyu)', name_gu = 'પપૈયું' WHERE slug = 'fresh-papaya';
UPDATE products SET name_en = 'Sapota (Chiku)', name_gu = 'ચીકુ' WHERE slug = 'fresh-chiku';

COMMIT;
