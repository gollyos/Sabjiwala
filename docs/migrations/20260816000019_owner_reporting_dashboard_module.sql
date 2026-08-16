-- =============================================================================
-- SABJIWALA: OWNER REPORTING DASHBOARD & VISUAL ANALYTICS MODULE
-- =============================================================================

BEGIN;

-- 1. Performance Indexes for Fast Reporting & Dashboard Aggregations
CREATE INDEX IF NOT EXISTS idx_orders_reporting_date_status ON orders(delivery_date, order_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_reporting_customer ON orders(customer_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_reporting_area ON orders(delivery_area_snapshot, delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_items_reporting_product ON order_items(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_proc_batches_reporting ON procurement_batches(batch_date, status);
CREATE INDEX IF NOT EXISTS idx_proc_items_reporting ON procurement_items(batch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_proc_purchases_reporting ON procurement_purchase_lines(supplier_id, purchased_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_reporting ON deliveries(delivery_batch_id, status, driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_reporting ON driver_cash_settlements(delivery_date, status);
CREATE INDEX IF NOT EXISTS idx_promo_usage_reporting ON promotion_usage(promotion_id, status, used_at);


-- =============================================================================
-- 2. RPC: get_owner_dashboard_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_owner_dashboard_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_compare_start_date DATE DEFAULT NULL,
    p_compare_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    -- Primary Metrics
    v_total_sales NUMERIC := 0.00;
    v_gross_sales NUMERIC := 0.00;
    v_first500_discount NUMERIC := 0.00;
    v_cod_discount NUMERIC := 0.00;
    v_total_orders INT := 0;
    v_delivered_orders INT := 0;
    v_failed_orders INT := 0;
    v_pending_orders INT := 0;
    v_unique_customers INT := 0;
    v_total_weight_kg NUMERIC := 0.000;
    v_procurement_cost NUMERIC := 0.00;
    v_wastage_cost NUMERIC := 0.00;
    v_gross_contribution NUMERIC := 0.00;

    -- COD Metrics
    v_expected_cod NUMERIC := 0.00;
    v_collected_cod NUMERIC := 0.00;
    v_collected_cash NUMERIC := 0.00;
    v_collected_upi NUMERIC := 0.00;
    v_pending_cod NUMERIC := 0.00;
    v_settlement_discrepancy NUMERIC := 0.00;

    -- Comparison Metrics
    v_comp_total_sales NUMERIC := 0.00;
    v_comp_total_orders INT := 0;
    v_comp_unique_customers INT := 0;
    v_comp_gross_contribution NUMERIC := 0.00;

    -- Trends & Breakdowns
    v_sales_trend JSONB := '[]'::jsonb;
    v_orders_trend JSONB := '[]'::jsonb;
    v_top_products JSONB := '[]'::jsonb;
    v_category_sales JSONB := '[]'::jsonb;
    v_needs_attention JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- 1. Primary Aggregate Calculations (Active Orders only)
    SELECT 
        COALESCE(SUM(o.final_payable_amount), 0.00),
        COALESCE(SUM(o.subtotal_amount), 0.00),
        COALESCE(SUM(o.first_order_discount), 0.00),
        COALESCE(SUM(o.cod_discount), 0.00),
        COUNT(*),
        COUNT(CASE WHEN o.order_status = 'delivered' THEN 1 END),
        COUNT(CASE WHEN o.order_status = 'failed_delivery' THEN 1 END),
        COUNT(CASE WHEN o.order_status NOT IN ('delivered', 'cancelled', 'failed_delivery') THEN 1 END),
        COUNT(DISTINCT o.customer_id)
    INTO 
        v_total_sales,
        v_gross_sales,
        v_first500_discount,
        v_cod_discount,
        v_total_orders,
        v_delivered_orders,
        v_failed_orders,
        v_pending_orders,
        v_unique_customers
    FROM orders o
    WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
      AND o.order_status <> 'cancelled';

    -- Weight & Quantity aggregate from order_items
    SELECT COALESCE(SUM(CASE WHEN oi.unit_code_snapshot = 'kg' THEN oi.equivalent_base_qty ELSE 0 END), 0.000)
    INTO v_total_weight_kg
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
      AND o.order_status <> 'cancelled';

    -- 2. Procurement & Wastage Cost
    SELECT 
        COALESCE(SUM(pb.total_procurement_cost), 0.00)
    INTO v_procurement_cost
    FROM procurement_batches pb
    WHERE pb.batch_date BETWEEN p_start_date AND p_end_date;

    -- Fallback to item cost snapshots if no frozen batch exists for the range
    IF v_procurement_cost = 0.00 THEN
        SELECT COALESCE(SUM(oi.line_cost_total), 0.00)
        INTO v_procurement_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled';
    END IF;

    -- Wastage Cost from procurement_items
    SELECT 
        COALESCE(SUM(pi.wastage_qty * COALESCE(pi.effective_cost_per_usable_unit, 0)), 0.00)
    INTO v_wastage_cost
    FROM procurement_items pi
    JOIN procurement_batches pb ON pi.batch_id = pb.id
    WHERE pb.batch_date BETWEEN p_start_date AND p_end_date;

    -- Gross Contribution = Net Revenue - Procurement Cost - Wastage Cost
    v_gross_contribution := v_total_sales - v_procurement_cost - v_wastage_cost;

    -- 3. COD & Delivery Metrics
    SELECT 
        COALESCE(SUM(d.cod_amount_expected), 0.00),
        COALESCE(SUM(d.cod_amount_collected), 0.00),
        COALESCE(SUM(d.cash_collected_amount), 0.00),
        COALESCE(SUM(d.upi_collected_amount), 0.00)
    INTO 
        v_expected_cod,
        v_collected_cod,
        v_collected_cash,
        v_collected_upi
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
      AND o.order_status <> 'cancelled';

    v_pending_cod := v_expected_cod - v_collected_cod;

    -- Settlement Discrepancy Total
    SELECT COALESCE(SUM(difference_amount), 0.00)
    INTO v_settlement_discrepancy
    FROM driver_cash_settlements
    WHERE delivery_date BETWEEN p_start_date AND p_end_date;

    -- 4. Comparison Calculations (if compare dates provided)
    IF p_compare_start_date IS NOT NULL AND p_compare_end_date IS NOT NULL THEN
        SELECT 
            COALESCE(SUM(o.final_payable_amount), 0.00),
            COUNT(*),
            COUNT(DISTINCT o.customer_id)
        INTO 
            v_comp_total_sales,
            v_comp_total_orders,
            v_comp_unique_customers
        FROM orders o
        WHERE o.delivery_date BETWEEN p_compare_start_date AND p_compare_end_date
          AND o.order_status <> 'cancelled';

        v_comp_gross_contribution := v_comp_total_sales - COALESCE((
            SELECT SUM(pb.total_procurement_cost)
            FROM procurement_batches pb
            WHERE pb.batch_date BETWEEN p_compare_start_date AND p_compare_end_date
        ), (
            SELECT SUM(oi.line_cost_total)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.delivery_date BETWEEN p_compare_start_date AND p_compare_end_date AND o.order_status <> 'cancelled'
        ), 0.00);
    END IF;

    -- 5. Sales & Orders Trend (Daily Breakdown)
    FOR v_rec IN
        SELECT 
            o.delivery_date,
            to_char(o.delivery_date, 'Dy, DD Mon') AS date_label,
            COUNT(*) AS total_orders,
            COUNT(CASE WHEN o.order_status = 'delivered' THEN 1 END) AS delivered_orders,
            COUNT(CASE WHEN o.order_status = 'failed_delivery' THEN 1 END) AS failed_orders,
            COALESCE(SUM(o.subtotal_amount), 0.00) AS gross_sales,
            COALESCE(SUM(o.final_payable_amount), 0.00) AS net_sales,
            COALESCE(SUM(o.first_order_discount + o.cod_discount), 0.00) AS total_discounts
        FROM orders o
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
        GROUP BY o.delivery_date
        ORDER BY o.delivery_date ASC
    LOOP
        v_sales_trend := v_sales_trend || jsonb_build_object(
            'date', v_rec.delivery_date,
            'label', v_rec.date_label,
            'gross_sales', v_rec.gross_sales,
            'net_sales', v_rec.net_sales,
            'discounts', v_rec.total_discounts,
            'total_orders', v_rec.total_orders
        );

        v_orders_trend := v_orders_trend || jsonb_build_object(
            'date', v_rec.delivery_date,
            'label', v_rec.date_label,
            'total', v_rec.total_orders,
            'delivered', v_rec.delivered_orders,
            'failed', v_rec.failed_orders
        );
    END LOOP;

    -- 6. Top Products (By Revenue & Base Quantity)
    FOR v_rec IN
        SELECT 
            p.id AS product_id,
            oi.product_name_en_snapshot AS name_en,
            oi.product_name_gu_snapshot AS name_gu,
            oi.unit_code_snapshot AS base_unit,
            COALESCE(SUM(oi.equivalent_base_qty), 0.00) AS total_quantity,
            COALESCE(SUM(oi.line_total), 0.00) AS total_revenue,
            COALESCE(SUM(oi.line_total - oi.line_cost_total), 0.00) AS gross_contribution,
            COUNT(DISTINCT oi.order_id) AS orders_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
        GROUP BY p.id, oi.product_name_en_snapshot, oi.product_name_gu_snapshot, oi.unit_code_snapshot
        ORDER BY total_revenue DESC
        LIMIT 10
    LOOP
        v_top_products := v_top_products || to_jsonb(v_rec);
    END LOOP;

    -- 7. Category Sales Distribution
    FOR v_rec IN
        SELECT 
            c.id AS category_id,
            c.name_en,
            c.name_gu,
            COALESCE(SUM(oi.line_total), 0.00) AS revenue,
            COUNT(DISTINCT oi.order_id) AS orders_count,
            COALESCE(SUM(oi.line_total - oi.line_cost_total), 0.00) AS contribution
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
        GROUP BY c.id, c.name_en, c.name_gu
        ORDER BY revenue DESC
    LOOP
        v_category_sales := v_category_sales || to_jsonb(v_rec);
    END LOOP;

    -- 8. Needs Attention Exceptions
    -- Discrepancies in Cash Settlements
    FOR v_rec IN
        SELECT 
            dcs.id,
            'COD_DISCREPANCY' AS type,
            format('Driver cash discrepancy of ₹%s on %s', dcs.difference_amount, to_char(dcs.delivery_date, 'DD Mon')) AS title,
            up.full_name AS subtitle,
            'high' AS severity
        FROM driver_cash_settlements dcs
        LEFT JOIN user_profiles up ON dcs.driver_user_id = up.id
        WHERE dcs.delivery_date BETWEEN p_start_date AND p_end_date
          AND dcs.difference_amount <> 0.00
    LOOP
        v_needs_attention := v_needs_attention || to_jsonb(v_rec);
    END LOOP;

    -- Failed Deliveries
    FOR v_rec IN
        SELECT 
            o.id,
            'FAILED_DELIVERY' AS type,
            format('Order %s delivery failed (%s)', o.order_number, COALESCE(d.failure_reason, 'Unreachable')) AS title,
            o.customer_name_snapshot || ' (' || o.delivery_area_snapshot || ')' AS subtitle,
            'medium' AS severity
        FROM orders o
        LEFT JOIN deliveries d ON d.order_id = o.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status = 'failed_delivery'
    LOOP
        v_needs_attention := v_needs_attention || to_jsonb(v_rec);
    END LOOP;

    -- Packing Problems
    FOR v_rec IN
        SELECT 
            o.id,
            'PACKING_PROBLEM' AS type,
            format('Order %s has packing problem: %s', o.order_number, COALESCE(o.packing_problem_notes, 'Needs review')) AS title,
            o.customer_name_snapshot AS subtitle,
            'high' AS severity
        FROM orders o
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.packing_status = 'problem'
    LOOP
        v_needs_attention := v_needs_attention || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'period', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date,
            'compare_start_date', p_compare_start_date,
            'compare_end_date', p_compare_end_date
        ),
        'kpis', jsonb_build_object(
            'total_sales', v_total_sales,
            'gross_sales', v_gross_sales,
            'first500_discount', v_first500_discount,
            'cod_discount', v_cod_discount,
            'total_orders', v_total_orders,
            'delivered_orders', v_delivered_orders,
            'failed_orders', v_failed_orders,
            'pending_orders', v_pending_orders,
            'unique_customers', v_unique_customers,
            'total_weight_kg', v_total_weight_kg,
            'procurement_cost', v_procurement_cost,
            'wastage_cost', v_wastage_cost,
            'gross_contribution', v_gross_contribution,
            'expected_cod', v_expected_cod,
            'collected_cod', v_collected_cod,
            'collected_cash', v_collected_cash,
            'collected_upi', v_collected_upi,
            'pending_cod', v_pending_cod,
            'settlement_discrepancy', v_settlement_discrepancy,
            -- Comparison deltas
            'comp_total_sales', v_comp_total_sales,
            'comp_total_orders', v_comp_total_orders,
            'comp_unique_customers', v_comp_unique_customers,
            'comp_gross_contribution', v_comp_gross_contribution
        ),
        'sales_trend', v_sales_trend,
        'orders_trend', v_orders_trend,
        'top_products', v_top_products,
        'category_sales', v_category_sales,
        'needs_attention', v_needs_attention
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_owner_dashboard_analytics(DATE, DATE, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_owner_dashboard_analytics(DATE, DATE, DATE, DATE) TO authenticated, service_role;


-- =============================================================================
-- 3. RPC: get_product_reporting_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_product_reporting_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_category_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_products JSONB := '[]'::jsonb;
    v_history JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- Product Table Aggregates
    FOR v_rec IN
        SELECT 
            p.id AS product_id,
            p.slug,
            c.name_en AS category_name_en,
            c.name_gu AS category_name_gu,
            oi.product_name_en_snapshot AS name_en,
            oi.product_name_gu_snapshot AS name_gu,
            oi.unit_code_snapshot AS base_unit,
            COALESCE(SUM(oi.equivalent_base_qty), 0.00) AS total_quantity_sold,
            COUNT(DISTINCT oi.order_id) AS total_orders,
            COALESCE(SUM(oi.line_total), 0.00) AS net_sales,
            COALESCE(SUM(oi.line_cost_total), 0.00) AS estimated_procurement_cost,
            COALESCE(SUM(oi.line_total - oi.line_cost_total), 0.00) AS gross_contribution,
            CASE 
                WHEN SUM(oi.equivalent_base_qty) > 0 
                THEN (SUM(oi.line_total) / SUM(oi.equivalent_base_qty)) 
                ELSE 0.00 
            END AS average_selling_price,
            CASE 
                WHEN SUM(oi.equivalent_base_qty) > 0 
                THEN (SUM(oi.line_cost_total) / SUM(oi.equivalent_base_qty)) 
                ELSE 0.00 
            END AS average_cost,
            CASE 
                WHEN SUM(oi.line_total) > 0 
                THEN ((SUM(oi.line_total - oi.line_cost_total) / SUM(oi.line_total)) * 100.0)
                ELSE 0.00 
            END AS margin_percentage
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
          AND (p_category_id IS NULL OR p.category_id = p_category_id)
          AND (p_product_id IS NULL OR p.id = p_product_id)
        GROUP BY p.id, p.slug, c.name_en, c.name_gu, oi.product_name_en_snapshot, oi.product_name_gu_snapshot, oi.unit_code_snapshot
        ORDER BY net_sales DESC
    LOOP
        v_products := v_products || to_jsonb(v_rec);
    END LOOP;

    -- If a specific product is requested, return daily history trend
    IF p_product_id IS NOT NULL THEN
        FOR v_rec IN
            SELECT 
                o.delivery_date,
                to_char(o.delivery_date, 'Dy, DD Mon') AS date_label,
                COALESCE(SUM(oi.equivalent_base_qty), 0.00) AS quantity_sold,
                COALESCE(SUM(oi.line_total), 0.00) AS revenue,
                CASE 
                    WHEN SUM(oi.equivalent_base_qty) > 0 
                    THEN (SUM(oi.line_total) / SUM(oi.equivalent_base_qty)) 
                    ELSE 0.00 
                END AS avg_selling_price,
                CASE 
                    WHEN SUM(oi.equivalent_base_qty) > 0 
                    THEN (SUM(oi.line_cost_total) / SUM(oi.equivalent_base_qty)) 
                    ELSE 0.00 
                END AS avg_cost
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = p_product_id
              AND o.delivery_date BETWEEN p_start_date AND p_end_date
              AND o.order_status <> 'cancelled'
            GROUP BY o.delivery_date
            ORDER BY o.delivery_date ASC
        LOOP
            v_history := v_history || to_jsonb(v_rec);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'products', v_products,
        'history', v_history
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_product_reporting_analytics(DATE, DATE, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_product_reporting_analytics(DATE, DATE, UUID, UUID) TO authenticated, service_role;


-- =============================================================================
-- 4. RPC: get_customer_reporting_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_customer_reporting_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_total_customers INT := 0;
    v_new_customers INT := 0;
    v_repeat_customers INT := 0;
    v_first500_stats JSONB;
    v_customers_list JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- Customer Cohort Counts
    SELECT COUNT(*) INTO v_total_customers FROM customers WHERE is_active = true;

    -- New vs Repeat in current period
    WITH customer_order_counts AS (
        SELECT 
            customer_id,
            COUNT(*) AS period_orders,
            MIN(delivery_date) AS first_order_date
        FROM orders
        WHERE delivery_date BETWEEN p_start_date AND p_end_date
          AND order_status <> 'cancelled'
        GROUP BY customer_id
    )
    SELECT 
        COUNT(CASE WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = coc.customer_id AND o2.delivery_date < p_start_date) = 0 THEN 1 END),
        COUNT(CASE WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = coc.customer_id AND o2.delivery_date < p_start_date) > 0 THEN 1 END)
    INTO v_new_customers, v_repeat_customers
    FROM customer_order_counts coc;

    -- FIRST500 Campaign Statistics
    SELECT jsonb_build_object(
        'max_eligible', 500,
        'reached_cohort', (SELECT COUNT(*) FROM customers WHERE verified_sequence <= 500),
        'reserved_count', (
            SELECT COUNT(*) 
            FROM promotion_usage pu 
            JOIN promotions pr ON pu.promotion_id = pr.id 
            WHERE pr.promo_code = 'FIRST500' AND pu.status = 'reserved'
        ),
        'consumed_count', (
            SELECT COUNT(*) 
            FROM promotion_usage pu 
            JOIN promotions pr ON pu.promotion_id = pr.id 
            WHERE pr.promo_code = 'FIRST500' AND pu.status = 'consumed'
        ),
        'released_count', (
            SELECT COUNT(*) 
            FROM promotion_usage pu 
            JOIN promotions pr ON pu.promotion_id = pr.id 
            WHERE pr.promo_code = 'FIRST500' AND pu.status = 'released'
        ),
        'remaining_eligible', (
            SELECT 500 - COUNT(*) 
            FROM promotion_usage pu 
            JOIN promotions pr ON pu.promotion_id = pr.id 
            WHERE pr.promo_code = 'FIRST500' AND pu.status IN ('consumed', 'reserved')
        ),
        'total_discount_given', (
            SELECT COALESCE(SUM(pu.discount_amount_applied), 0.00) 
            FROM promotion_usage pu 
            JOIN promotions pr ON pu.promotion_id = pr.id 
            WHERE pr.promo_code = 'FIRST500' AND pu.status = 'consumed'
        ),
        'revenue_from_first500', (
            SELECT COALESCE(SUM(o.final_payable_amount), 0.00) 
            FROM orders o
            JOIN promotion_usage pu ON pu.order_id = o.id
            JOIN promotions pr ON pu.promotion_id = pr.id
            WHERE pr.promo_code = 'FIRST500' AND pu.status = 'consumed'
        )
    ) INTO v_first500_stats;

    -- Top Customer List
    FOR v_rec IN
        SELECT 
            c.id AS customer_id,
            c.full_name,
            c.mobile,
            c.verified_sequence,
            c.created_at AS registration_date,
            c.is_active,
            COUNT(o.id) AS total_orders,
            COALESCE(SUM(o.final_payable_amount), 0.00) AS lifetime_spend,
            MAX(o.delivery_date) AS last_order_date,
            CASE WHEN COUNT(o.id) > 0 THEN (SUM(o.final_payable_amount) / COUNT(o.id)) ELSE 0.00 END AS average_order_value,
            EXISTS (
                SELECT 1 
                FROM promotion_usage pu 
                JOIN promotions pr ON pu.promotion_id = pr.id
                WHERE pu.customer_id = c.id AND pr.promo_code = 'FIRST500' AND pu.status = 'consumed'
            ) AS first500_consumed
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.order_status <> 'cancelled'
        GROUP BY c.id, c.full_name, c.mobile, c.verified_sequence, c.created_at, c.is_active
        ORDER BY lifetime_spend DESC
        LIMIT p_limit OFFSET p_offset
    LOOP
        v_customers_list := v_customers_list || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'metrics', jsonb_build_object(
            'total_customers', v_total_customers,
            'new_customers', v_new_customers,
            'repeat_customers', v_repeat_customers,
            'active_in_period', (v_new_customers + v_repeat_customers)
        ),
        'first500', v_first500_stats,
        'customers', v_customers_list
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_customer_reporting_analytics(DATE, DATE, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customer_reporting_analytics(DATE, DATE, INT, INT) TO authenticated, service_role;


-- =============================================================================
-- 5. RPC: get_supplier_reporting_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_supplier_reporting_analytics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_suppliers JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    FOR v_rec IN
        SELECT 
            s.id AS supplier_id,
            s.name AS supplier_name,
            s.contact_person,
            s.mobile,
            s.mandi_location AS apmc_market_location,
            COUNT(DISTINCT pb.id) AS total_batches,
            COALESCE(SUM(ppl.purchased_qty), 0.00) AS total_quantity_purchased,
            COALESCE(SUM(ppl.total_cost), 0.00) AS total_purchase_value,
            COALESCE(SUM(pi.wastage_qty), 0.00) AS total_wastage_quantity,
            CASE 
                WHEN SUM(ppl.purchased_qty) > 0 
                THEN (SUM(ppl.total_cost) / SUM(ppl.purchased_qty))
                ELSE 0.00 
            END AS average_rate,
            MAX(pb.batch_date) AS last_purchase_date
        FROM suppliers s
        LEFT JOIN procurement_purchase_lines ppl ON ppl.supplier_id = s.id
        LEFT JOIN procurement_items pi ON ppl.procurement_item_id = pi.id
        LEFT JOIN procurement_batches pb ON pi.batch_id = pb.id AND pb.batch_date BETWEEN p_start_date AND p_end_date
        GROUP BY s.id, s.name, s.contact_person, s.mobile, s.mandi_location
        ORDER BY total_purchase_value DESC
    LOOP
        v_suppliers := v_suppliers || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'suppliers', v_suppliers
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_supplier_reporting_analytics(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_supplier_reporting_analytics(DATE, DATE) TO authenticated, service_role;


-- =============================================================================
-- 6. RPC: get_procurement_reporting_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_procurement_reporting_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_batch_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
    v_batches JSONB := '[]'::jsonb;
    v_items JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- Summary KPIs
    SELECT jsonb_build_object(
        'total_batches', COUNT(DISTINCT pb.id),
        'total_cost', COALESCE(SUM(pb.total_procurement_cost), 0.00),
        'total_purchased_qty', COALESCE(SUM(pi.procured_qty), 0.00),
        'total_received_qty', COALESCE(SUM(pi.received_qty), 0.00),
        'total_usable_qty', COALESCE(SUM(pi.usable_qty), 0.00),
        'total_wastage_qty', COALESCE(SUM(pi.wastage_qty), 0.00),
        'total_wastage_cost', COALESCE(SUM(pi.wastage_qty * COALESCE(pi.effective_cost_per_usable_unit, 0)), 0.00)
    ) INTO v_summary
    FROM procurement_batches pb
    LEFT JOIN procurement_items pi ON pi.batch_id = pb.id
    WHERE pb.batch_date BETWEEN p_start_date AND p_end_date
      AND (p_batch_id IS NULL OR pb.id = p_batch_id);

    -- Batches List
    FOR v_rec IN
        SELECT 
            pb.id,
            pb.batch_number,
            pb.batch_date AS delivery_date,
            pb.status,
            pb.cutoff_timestamp,
            pb.total_procurement_cost AS total_cost,
            COUNT(pi.id) AS items_count,
            COALESCE(SUM(pi.wastage_qty), 0.00) AS total_wastage
        FROM procurement_batches pb
        LEFT JOIN procurement_items pi ON pi.batch_id = pb.id
        WHERE pb.batch_date BETWEEN p_start_date AND p_end_date
          AND (p_batch_id IS NULL OR pb.id = p_batch_id)
        GROUP BY pb.id, pb.batch_number, pb.batch_date, pb.status, pb.cutoff_timestamp, pb.total_procurement_cost
        ORDER BY pb.batch_date DESC
    LOOP
        v_batches := v_batches || to_jsonb(v_rec);
    END LOOP;

    -- Line Items
    FOR v_rec IN
        SELECT 
            pi.id,
            pi.batch_id,
            pb.batch_number,
            pb.batch_date AS delivery_date,
            p.name_en,
            p.name_gu,
            pu.code AS unit_code,
            pi.required_qty AS total_demand_quantity,
            pi.suggested_procurement_qty AS total_required_quantity,
            pi.procured_qty AS purchased_quantity,
            pi.received_qty AS received_quantity,
            pi.usable_qty AS usable_quantity,
            pi.wastage_qty AS wastage_quantity,
            pi.effective_cost_per_usable_unit AS actual_purchase_rate,
            pi.total_procurement_cost AS total_line_cost,
            (SELECT string_agg(s.name, ', ') FROM procurement_purchase_lines ppl JOIN suppliers s ON ppl.supplier_id = s.id WHERE ppl.procurement_item_id = pi.id) AS supplier_name
        FROM procurement_items pi
        JOIN procurement_batches pb ON pi.batch_id = pb.id
        JOIN products p ON pi.product_id = p.id
        JOIN product_units pu ON pi.base_unit_id = pu.id
        WHERE pb.batch_date BETWEEN p_start_date AND p_end_date
          AND (p_batch_id IS NULL OR pb.id = p_batch_id)
        ORDER BY pi.total_procurement_cost DESC
    LOOP
        v_items := v_items || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'summary', v_summary,
        'batches', v_batches,
        'items', v_items
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_procurement_reporting_analytics(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_procurement_reporting_analytics(DATE, DATE, UUID) TO authenticated, service_role;


-- =============================================================================
-- 7. RPC: get_sales_financial_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_sales_financial_analytics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_gross_sales NUMERIC := 0.00;
    v_first500_discount NUMERIC := 0.00;
    v_cod_discount NUMERIC := 0.00;
    v_net_revenue NUMERIC := 0.00;
    v_procurement_cost NUMERIC := 0.00;
    v_wastage_cost NUMERIC := 0.00;
    v_gross_contribution NUMERIC := 0.00;
    v_contribution_margin NUMERIC := 0.00;
    v_breakdown JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    SELECT 
        COALESCE(SUM(subtotal_amount), 0.00),
        COALESCE(SUM(first_order_discount), 0.00),
        COALESCE(SUM(cod_discount), 0.00),
        COALESCE(SUM(final_payable_amount), 0.00)
    INTO 
        v_gross_sales,
        v_first500_discount,
        v_cod_discount,
        v_net_revenue
    FROM orders
    WHERE delivery_date BETWEEN p_start_date AND p_end_date
      AND order_status <> 'cancelled';

    SELECT COALESCE(SUM(total_procurement_cost), 0.00)
    INTO v_procurement_cost
    FROM procurement_batches
    WHERE batch_date BETWEEN p_start_date AND p_end_date;

    IF v_procurement_cost = 0.00 THEN
        SELECT COALESCE(SUM(oi.line_cost_total), 0.00)
        INTO v_procurement_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled';
    END IF;

    SELECT COALESCE(SUM(pi.wastage_qty * COALESCE(pi.effective_cost_per_usable_unit, 0)), 0.00)
    INTO v_wastage_cost
    FROM procurement_items pi
    JOIN procurement_batches pb ON pi.batch_id = pb.id
    WHERE pb.batch_date BETWEEN p_start_date AND p_end_date;

    v_gross_contribution := v_net_revenue - v_procurement_cost - v_wastage_cost;
    IF v_net_revenue > 0 THEN
        v_contribution_margin := (v_gross_contribution / v_net_revenue) * 100.0;
    END IF;

    -- Daily financial step-down breakdown
    FOR v_rec IN
        SELECT 
            o.delivery_date,
            to_char(o.delivery_date, 'Dy, DD Mon') AS label,
            COALESCE(SUM(o.subtotal_amount), 0.00) AS gross_sales,
            COALESCE(SUM(o.first_order_discount), 0.00) AS first500_discount,
            COALESCE(SUM(o.cod_discount), 0.00) AS cod_discount,
            COALESCE(SUM(o.final_payable_amount), 0.00) AS net_revenue
        FROM orders o
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
        GROUP BY o.delivery_date
        ORDER BY o.delivery_date ASC
    LOOP
        v_breakdown := v_breakdown || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'waterfall', jsonb_build_object(
            'gross_sales', v_gross_sales,
            'first500_discount', v_first500_discount,
            'cod_discount', v_cod_discount,
            'total_discounts', (v_first500_discount + v_cod_discount),
            'net_revenue', v_net_revenue,
            'procurement_cost', v_procurement_cost,
            'wastage_cost', v_wastage_cost,
            'gross_contribution', v_gross_contribution,
            'contribution_margin_pct', v_contribution_margin
        ),
        'daily_breakdown', v_breakdown
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_sales_financial_analytics(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sales_financial_analytics(DATE, DATE) TO authenticated, service_role;


-- =============================================================================
-- 8. RPC: get_delivery_reporting_analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_delivery_reporting_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_driver_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_metrics JSONB;
    v_area_breakdown JSONB := '[]'::jsonb;
    v_driver_performance JSONB := '[]'::jsonb;
    v_settlements JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- Overall Delivery Metrics
    SELECT jsonb_build_object(
        'total_assigned', COUNT(*),
        'delivered', COUNT(CASE WHEN d.status = 'delivered' THEN 1 END),
        'failed', COUNT(CASE WHEN d.status = 'failed' THEN 1 END),
        'out_for_delivery', COUNT(CASE WHEN d.status = 'out_for_delivery' THEN 1 END),
        'pending', COUNT(CASE WHEN d.status = 'pending' THEN 1 END),
        'success_rate', CASE WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN d.status = 'delivered' THEN 1 END)::numeric / COUNT(*)::numeric * 100.0) ELSE 0.00 END,
        'expected_cod', COALESCE(SUM(d.cod_amount_expected), 0.00),
        'collected_cod', COALESCE(SUM(d.cod_amount_collected), 0.00),
        'collected_cash', COALESCE(SUM(d.cash_collected_amount), 0.00),
        'collected_upi', COALESCE(SUM(d.upi_collected_amount), 0.00)
    ) INTO v_metrics
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
      AND (p_driver_id IS NULL OR d.driver_user_id = p_driver_id);

    -- Area Breakdown
    FOR v_rec IN
        SELECT 
            o.delivery_area_snapshot AS area,
            COUNT(*) AS total_orders,
            COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) AS delivered_count,
            COUNT(CASE WHEN d.status = 'failed' THEN 1 END) AS failed_count,
            COALESCE(SUM(o.final_payable_amount), 0.00) AS total_revenue,
            CASE WHEN COUNT(*) > 0 THEN (SUM(o.final_payable_amount) / COUNT(*)) ELSE 0.00 END AS average_order_value
        FROM orders o
        LEFT JOIN deliveries d ON d.order_id = o.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND o.order_status <> 'cancelled'
        GROUP BY o.delivery_area_snapshot
        ORDER BY total_orders DESC
    LOOP
        v_area_breakdown := v_area_breakdown || to_jsonb(v_rec);
    END LOOP;

    -- Driver Performance
    FOR v_rec IN
        SELECT 
            up.id AS driver_id,
            up.full_name AS driver_name,
            up.mobile AS driver_mobile,
            COUNT(d.id) AS total_assigned,
            COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) AS completed_deliveries,
            COUNT(CASE WHEN d.status = 'failed' THEN 1 END) AS failed_deliveries,
            COALESCE(SUM(d.cod_amount_collected), 0.00) AS cod_collected,
            COALESCE(SUM(d.cash_collected_amount), 0.00) AS cash_collected,
            COALESCE(SUM(d.upi_collected_amount), 0.00) AS upi_collected
        FROM user_profiles up
        JOIN deliveries d ON d.driver_user_id = up.id
        JOIN orders o ON d.order_id = o.id
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
        GROUP BY up.id, up.full_name, up.mobile
        ORDER BY total_assigned DESC
    LOOP
        v_driver_performance := v_driver_performance || to_jsonb(v_rec);
    END LOOP;

    -- Cash Settlements
    FOR v_rec IN
        SELECT 
            dcs.id,
            dcs.delivery_date,
            up.full_name AS driver_name,
            dcs.expected_cash_amount,
            dcs.collected_cash_amount,
            dcs.collected_upi_delivery_amount,
            dcs.handed_over_cash_amount,
            dcs.difference_amount,
            dcs.status,
            dcs.handed_over_at,
            dcs.notes
        FROM driver_cash_settlements dcs
        LEFT JOIN user_profiles up ON dcs.driver_user_id = up.id
        WHERE dcs.delivery_date BETWEEN p_start_date AND p_end_date
          AND (p_driver_id IS NULL OR dcs.driver_user_id = p_driver_id)
        ORDER BY dcs.delivery_date DESC
    LOOP
        v_settlements := v_settlements || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'metrics', v_metrics,
        'area_breakdown', v_area_breakdown,
        'driver_performance', v_driver_performance,
        'settlements', v_settlements
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_delivery_reporting_analytics(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_delivery_reporting_analytics(DATE, DATE, UUID) TO authenticated, service_role;


-- =============================================================================
-- 9. RPC: get_detailed_orders_report
-- =============================================================================
CREATE OR REPLACE FUNCTION get_detailed_orders_report(
    p_start_date DATE,
    p_end_date DATE,
    p_status VARCHAR DEFAULT NULL,
    p_area VARCHAR DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_total_count INT := 0;
    v_orders JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    SELECT COUNT(*) INTO v_total_count
    FROM orders o
    WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
      AND (p_status IS NULL OR o.order_status::text = p_status)
      AND (p_area IS NULL OR o.delivery_area_snapshot = p_area)
      AND (
          p_search IS NULL 
          OR o.order_number ILIKE '%' || p_search || '%'
          OR o.customer_name_snapshot ILIKE '%' || p_search || '%'
          OR o.customer_mobile_snapshot ILIKE '%' || p_search || '%'
      );

    FOR v_rec IN
        SELECT 
            o.id,
            o.order_number,
            o.delivery_date,
            o.delivery_slot_start,
            o.delivery_slot_end,
            o.order_status,
            o.payment_status,
            o.payment_method,
            o.customer_name_snapshot,
            o.customer_mobile_snapshot,
            o.delivery_flat_house_snapshot,
            o.delivery_society_street_snapshot,
            o.delivery_landmark_snapshot,
            o.delivery_area_snapshot,
            o.subtotal_amount,
            o.first_order_discount AS first500_discount_amount,
            o.cod_discount AS cod_discount_amount,
            o.final_payable_amount,
            o.packing_status,
            o.created_at,
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'product_name_en', oi.product_name_en_snapshot,
                    'product_name_gu', oi.product_name_gu_snapshot,
                    'variant_name_en', oi.variant_name_en_snapshot,
                    'quantity', oi.quantity,
                    'base_quantity', oi.equivalent_base_qty,
                    'unit_code', oi.unit_code_snapshot,
                    'selling_price', oi.selling_price_snapshot,
                    'final_amount', oi.line_total
                ))
                FROM order_items oi
                WHERE oi.order_id = o.id
            ) AS items
        FROM orders o
        WHERE o.delivery_date BETWEEN p_start_date AND p_end_date
          AND (p_status IS NULL OR o.order_status::text = p_status)
          AND (p_area IS NULL OR o.delivery_area_snapshot = p_area)
          AND (
              p_search IS NULL 
              OR o.order_number ILIKE '%' || p_search || '%'
              OR o.customer_name_snapshot ILIKE '%' || p_search || '%'
              OR o.customer_mobile_snapshot ILIKE '%' || p_search || '%'
          )
        ORDER BY o.created_at DESC
        LIMIT p_limit OFFSET p_offset
    LOOP
        v_orders := v_orders || to_jsonb(v_rec);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_count', v_total_count,
        'orders', v_orders
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_detailed_orders_report(DATE, DATE, VARCHAR, VARCHAR, VARCHAR, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_detailed_orders_report(DATE, DATE, VARCHAR, VARCHAR, VARCHAR, INT, INT) TO authenticated, service_role;


-- =============================================================================
-- 10. RPC: get_daily_owner_summary
-- =============================================================================
CREATE OR REPLACE FUNCTION get_daily_owner_summary(
    p_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_orders INT := 0;
    v_delivered INT := 0;
    v_failed INT := 0;
    v_sales NUMERIC := 0.00;
    v_first500 NUMERIC := 0.00;
    v_cod_disc NUMERIC := 0.00;
    v_proc_cost NUMERIC := 0.00;
    v_wastage NUMERIC := 0.00;
    v_cod_col NUMERIC := 0.00;
    v_contribution NUMERIC := 0.00;
    v_kg_qty NUMERIC := 0.00;
    v_bunch_qty NUMERIC := 0.00;
    v_piece_qty NUMERIC := 0.00;
    v_top_product VARCHAR := '';
    v_packing_problems INT := 0;
    v_cod_discrepancies INT := 0;
BEGIN
    IF p_date IS NOT NULL THEN
        v_target_date := p_date;
    ELSE
        v_target_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    END IF;

    SELECT 
        COUNT(*),
        COUNT(CASE WHEN order_status = 'delivered' THEN 1 END),
        COUNT(CASE WHEN order_status = 'failed_delivery' THEN 1 END),
        COALESCE(SUM(final_payable_amount), 0.00),
        COALESCE(SUM(first_order_discount), 0.00),
        COALESCE(SUM(cod_discount), 0.00),
        COUNT(CASE WHEN packing_status = 'problem' THEN 1 END)
    INTO 
        v_orders,
        v_delivered,
        v_failed,
        v_sales,
        v_first500,
        v_cod_disc,
        v_packing_problems
    FROM orders
    WHERE delivery_date = v_target_date
      AND order_status <> 'cancelled';

    -- Quantity Breakdown
    SELECT 
        COALESCE(SUM(CASE WHEN oi.unit_code_snapshot = 'kg' THEN oi.equivalent_base_qty ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN oi.unit_code_snapshot = 'bunch' THEN oi.equivalent_base_qty ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN oi.unit_code_snapshot = 'piece' THEN oi.equivalent_base_qty ELSE 0 END), 0.00)
    INTO 
        v_kg_qty,
        v_bunch_qty,
        v_piece_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_date = v_target_date AND o.order_status <> 'cancelled';

    -- Procurement & Wastage Cost
    SELECT COALESCE(SUM(total_procurement_cost), 0.00)
    INTO v_proc_cost
    FROM procurement_batches
    WHERE batch_date = v_target_date;

    IF v_proc_cost = 0.00 THEN
        SELECT COALESCE(SUM(oi.line_cost_total), 0.00)
        INTO v_proc_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.delivery_date = v_target_date AND o.order_status <> 'cancelled';
    END IF;

    SELECT COALESCE(SUM(pi.wastage_qty * COALESCE(pi.effective_cost_per_usable_unit, 0)), 0.00)
    INTO v_wastage
    FROM procurement_items pi
    JOIN procurement_batches pb ON pi.batch_id = pb.id
    WHERE pb.batch_date = v_target_date;

    v_contribution := v_sales - v_proc_cost - v_wastage;

    -- COD Collected
    SELECT COALESCE(SUM(cod_amount_collected), 0.00)
    INTO v_cod_col
    FROM deliveries d
    JOIN orders o ON d.order_id = o.id
    WHERE o.delivery_date = v_target_date AND o.order_status <> 'cancelled';

    -- COD Discrepancies Count
    SELECT COUNT(*)
    INTO v_cod_discrepancies
    FROM driver_cash_settlements
    WHERE delivery_date = v_target_date AND difference_amount <> 0.00;

    -- Top Product
    SELECT (oi.product_name_en_snapshot || ' (' || oi.product_name_gu_snapshot || ') — ' || SUM(oi.equivalent_base_qty)::text || ' ' || oi.unit_code_snapshot)
    INTO v_top_product
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_date = v_target_date AND o.order_status <> 'cancelled'
    GROUP BY oi.product_name_en_snapshot, oi.product_name_gu_snapshot, oi.unit_code_snapshot
    ORDER BY SUM(oi.line_total) DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'date', v_target_date,
        'orders_count', v_orders,
        'delivered_count', v_delivered,
        'failed_count', v_failed,
        'total_sales', v_sales,
        'first500_discount', v_first500,
        'cod_discount', v_cod_disc,
        'procurement_cost', v_proc_cost,
        'wastage_cost', v_wastage,
        'gross_contribution', v_contribution,
        'cod_collected', v_cod_col,
        'kg_quantity', v_kg_qty,
        'bunch_quantity', v_bunch_qty,
        'piece_quantity', v_piece_qty,
        'top_product', COALESCE(v_top_product, 'None'),
        'packing_problems', v_packing_problems,
        'cod_discrepancies', v_cod_discrepancies
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_daily_owner_summary(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_owner_summary(DATE) TO authenticated, service_role;

COMMIT;
