-- =============================================================================
-- TEST SUITE: OWNER REPORTING DASHBOARD & VISUAL ANALYTICS
-- =============================================================================

DO $$
DECLARE
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_yest DATE := (v_today - INTERVAL '1 day')::date;
    v_30_days_ago DATE := (v_today - INTERVAL '30 days')::date;
    v_comp_start DATE := (v_today - INTERVAL '60 days')::date;
    v_comp_end DATE := (v_today - INTERVAL '31 days')::date;
    
    v_dashboard_res JSONB;
    v_product_res JSONB;
    v_customer_res JSONB;
    v_supplier_res JSONB;
    v_proc_res JSONB;
    v_sales_res JSONB;
    v_delivery_res JSONB;
    v_orders_res JSONB;
    v_daily_res JSONB;
BEGIN
    RAISE NOTICE '>>> STARTING OWNER REPORTING TEST SUITE <<<';

    -- 1. Test get_owner_dashboard_analytics
    v_dashboard_res := get_owner_dashboard_analytics(v_30_days_ago, v_today, v_comp_start, v_comp_end);
    IF (v_dashboard_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 1 Failed: get_owner_dashboard_analytics did not return success';
    END IF;
    IF v_dashboard_res->'kpis' IS NULL OR v_dashboard_res->'sales_trend' IS NULL THEN
        RAISE EXCEPTION 'Test 1 Failed: missing kpis or sales_trend in dashboard response';
    END IF;
    RAISE NOTICE 'Test 1 Passed: get_owner_dashboard_analytics returned valid metrics and trends.';

    -- 2. Test get_product_reporting_analytics
    v_product_res := get_product_reporting_analytics(v_30_days_ago, v_today, NULL, NULL);
    IF (v_product_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 2 Failed: get_product_reporting_analytics did not return success';
    END IF;
    IF v_product_res->'products' IS NULL THEN
        RAISE EXCEPTION 'Test 2 Failed: missing products list in product report';
    END IF;
    RAISE NOTICE 'Test 2 Passed: get_product_reporting_analytics returned valid product list.';

    -- 3. Test get_customer_reporting_analytics
    v_customer_res := get_customer_reporting_analytics(v_30_days_ago, v_today, 50, 0);
    IF (v_customer_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 3 Failed: get_customer_reporting_analytics did not return success';
    END IF;
    IF v_customer_res->'first500' IS NULL OR v_customer_res->'customers' IS NULL THEN
        RAISE EXCEPTION 'Test 3 Failed: missing first500 or customers in customer report';
    END IF;
    RAISE NOTICE 'Test 3 Passed: get_customer_reporting_analytics returned valid cohorts & FIRST500 stats.';

    -- 4. Test get_supplier_reporting_analytics
    v_supplier_res := get_supplier_reporting_analytics(v_30_days_ago, v_today);
    IF (v_supplier_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 4 Failed: get_supplier_reporting_analytics did not return success';
    END IF;
    IF v_supplier_res->'suppliers' IS NULL THEN
        RAISE EXCEPTION 'Test 4 Failed: missing suppliers in supplier report';
    END IF;
    RAISE NOTICE 'Test 4 Passed: get_supplier_reporting_analytics returned valid supplier data.';

    -- 5. Test get_procurement_reporting_analytics
    v_proc_res := get_procurement_reporting_analytics(v_30_days_ago, v_today, NULL);
    IF (v_proc_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 5 Failed: get_procurement_reporting_analytics did not return success';
    END IF;
    IF v_proc_res->'summary' IS NULL OR v_proc_res->'items' IS NULL THEN
        RAISE EXCEPTION 'Test 5 Failed: missing summary or items in procurement report';
    END IF;
    RAISE NOTICE 'Test 5 Passed: get_procurement_reporting_analytics returned valid summary & items.';

    -- 6. Test get_sales_financial_analytics
    v_sales_res := get_sales_financial_analytics(v_30_days_ago, v_today);
    IF (v_sales_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 6 Failed: get_sales_financial_analytics did not return success';
    END IF;
    IF v_sales_res->'waterfall' IS NULL OR v_sales_res->'daily_breakdown' IS NULL THEN
        RAISE EXCEPTION 'Test 6 Failed: missing waterfall or daily_breakdown in sales report';
    END IF;
    RAISE NOTICE 'Test 6 Passed: get_sales_financial_analytics returned valid waterfall & ledger.';

    -- 7. Test get_delivery_reporting_analytics
    v_delivery_res := get_delivery_reporting_analytics(v_30_days_ago, v_today, NULL);
    IF (v_delivery_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 7 Failed: get_delivery_reporting_analytics did not return success';
    END IF;
    IF v_delivery_res->'metrics' IS NULL OR v_delivery_res->'area_breakdown' IS NULL THEN
        RAISE EXCEPTION 'Test 7 Failed: missing metrics or area_breakdown in delivery report';
    END IF;
    RAISE NOTICE 'Test 7 Passed: get_delivery_reporting_analytics returned valid area & driver stats.';

    -- 8. Test get_detailed_orders_report
    v_orders_res := get_detailed_orders_report(v_30_days_ago, v_today, NULL, NULL, NULL, 50, 0);
    IF (v_orders_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 8 Failed: get_detailed_orders_report did not return success';
    END IF;
    IF v_orders_res->'orders' IS NULL THEN
        RAISE EXCEPTION 'Test 8 Failed: missing orders in detailed orders report';
    END IF;
    RAISE NOTICE 'Test 8 Passed: get_detailed_orders_report returned valid orders list.';

    -- 9. Test get_daily_owner_summary
    v_daily_res := get_daily_owner_summary(v_today);
    IF (v_daily_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 9 Failed: get_daily_owner_summary did not return success';
    END IF;
    RAISE NOTICE 'Test 9 Passed: get_daily_owner_summary returned valid executive summary.';

    RAISE NOTICE '>>> ALL 9 OWNER REPORTING TESTS PASSED PERFECTLY <<<';
END;
$$;
