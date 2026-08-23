import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { todayIST } from '@/lib/istDate';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

interface OrderItemInput {
  variant_id: string;
  quantity: number;
  custom_price?: number;
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Staff authentication required' },
        { status: 401 }
      );
    }

    const { data: roleRows } = await serverSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r) => r.role);
    const isAuthorized = roles.includes('owner') || roles.includes('manager');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required to create orders' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      customer_name,
      customer_mobile,
      customer_alternate_mobile,
      flat_house_no,
      society_street_name,
      landmark,
      area_locality,
      pincode = '389350',
      delivery_date,
      delivery_slot_start = '06:00:00',
      delivery_slot_end = '10:00:00',
      payment_method = 'cod', // 'cod' | 'online' | 'upi'
      channel = 'phone_whatsapp', // 'phone_whatsapp' | 'manual_admin' | 'web'
      special_instructions = '',
      discount_amount = 0,
      delivery_charge = 0,
      items = [],
    } = body;

    // 1. Validations
    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json({ success: false, error: 'Customer name is required' }, { status: 400 });
    }

    const cleanMobile = (customer_mobile || '').replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
    }
    const formattedMobile = `+91${cleanMobile.slice(-10)}`;

    if (!society_street_name || !society_street_name.trim()) {
      return NextResponse.json({ success: false, error: 'Society/Street address is required' }, { status: 400 });
    }

    if (!area_locality || !area_locality.trim()) {
      return NextResponse.json({ success: false, error: 'Area/Locality in Halol is required' }, { status: 400 });
    }

    const cleanPincode = String(pincode || '').trim();
    if (!/^[0-9]{6}$/.test(cleanPincode)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid 6-digit pincode' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Please add at least one item to the order' }, { status: 400 });
    }

    const targetDeliveryDate = delivery_date || todayIST();

    const supabase = getServiceSupabase();

    // 2. Find or Create Customer
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, full_name, mobile, verified_sequence')
      .or(`mobile.eq.${formattedMobile},mobile.eq.${cleanMobile.slice(-10)}`)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update name or alternate mobile if provided
      await supabase
        .from('customers')
        .update({
          full_name: customer_name.trim(),
          alternate_mobile: customer_alternate_mobile?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    } else {
      const { data: newCustomer, error: newCustErr } = await supabase
        .from('customers')
        .insert({
          full_name: customer_name.trim(),
          mobile: formattedMobile,
          alternate_mobile: customer_alternate_mobile?.trim() || null,
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (newCustErr || !newCustomer) {
        return NextResponse.json(
          { success: false, error: `Failed to create customer: ${newCustErr ? getErrorMessage(newCustErr) : 'Unknown error'}` },
          { status: 500 }
        );
      }
      customerId = newCustomer.id;
    }

    // 3. Create / Upsert Customer Address
    const { data: newAddress, error: addrErr } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: customerId,
        address_type: 'home',
        flat_house_no: flat_house_no?.trim() || '',
        society_street_name: society_street_name.trim(),
        landmark: landmark?.trim() || '',
        area_locality: area_locality.trim(),
        city: 'Halol',
        district: 'Panchmahal',
        state: 'Gujarat',
        pincode: cleanPincode,
        is_default: true,
      })
      .select('*')
      .single();

    if (addrErr || !newAddress) {
      return NextResponse.json(
        { success: false, error: `Failed to save delivery address: ${addrErr ? getErrorMessage(addrErr) : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 4. Fetch Products & Variants to calculate totals & snapshots
    const variantIds = items.map((i: OrderItemInput) => i.variant_id);
    const { data: variantsData, error: varErr } = await supabase
      .from('product_variants')
      .select(`
        id,
        variant_name_en,
        variant_name_gu,
        multiplier_to_base_unit,
        selling_price,
        current_estimated_cost,
        unit_id,
        product_id,
        products (
          id,
          name_en,
          name_gu,
          image_url
        ),
        product_units (
          id,
          code
        )
      `)
      .in('id', variantIds);

    if (varErr || !variantsData || variantsData.length === 0) {
      return NextResponse.json(
        { success: false, error: `Failed to load product details: ${varErr ? getErrorMessage(varErr) : 'Variants not found'}` },
        { status: 400 }
      );
    }

    const variantMap = new Map<string, any>();
    variantsData.forEach((v) => variantMap.set(v.id, v));

    let subtotal = 0;
    let totalCost = 0;

    const orderItemsToInsert: any[] = [];

    for (const item of items as OrderItemInput[]) {
      const v = variantMap.get(item.variant_id);
      if (!v) continue;

      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const sellingPrice = typeof item.custom_price === 'number' && item.custom_price >= 0
        ? item.custom_price
        : Number(v.selling_price || 0);

      const costPrice = Number(v.current_estimated_cost || 0);
      const lineTotal = Math.round(sellingPrice * qty * 100) / 100;
      const lineCost = Math.round(costPrice * qty * 100) / 100;
      const equivalentBaseQty = Math.round(qty * Number(v.multiplier_to_base_unit || 1) * 1000) / 1000;

      subtotal += lineTotal;
      totalCost += lineCost;

      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      const unit = Array.isArray(v.product_units) ? v.product_units[0] : v.product_units;

      orderItemsToInsert.push({
        product_id: v.product_id,
        product_variant_id: v.id,
        unit_id: v.unit_id,
        quantity: qty,
        equivalent_base_qty: equivalentBaseQty,
        product_name_en_snapshot: product?.name_en || 'Vegetable',
        product_name_gu_snapshot: product?.name_gu || 'શાકભાજી',
        variant_name_en_snapshot: v.variant_name_en,
        variant_name_gu_snapshot: v.variant_name_gu,
        unit_code_snapshot: unit?.code || 'kg',
        selling_price_snapshot: sellingPrice,
        cost_price_snapshot: costPrice,
        line_total: lineTotal,
        line_cost_total: lineCost,
      });
    }

    if (orderItemsToInsert.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid items found to add to order' }, { status: 400 });
    }

    const discount = Math.max(0, Number(discount_amount) || 0);
    const deliveryFee = Math.max(0, Number(delivery_charge) || 0);
    const finalPayable = Math.max(0, subtotal - discount + deliveryFee);

    // 5. Generate Order Number
    let orderNumber: string;
    const { data: orderNumData } = await supabase.rpc('generate_order_number');
    if (orderNumData && typeof orderNumData === 'string') {
      orderNumber = orderNumData;
    } else {
      const datePart = targetDeliveryDate.replace(/-/g, '').slice(2);
      const randPart = Math.floor(1000 + Math.random() * 9000);
      orderNumber = `TT-${datePart}-${randPart}`;
    }

    // Determine payment and order status
    const isCod = payment_method === 'cod';
    const paymentMethodValue = isCod ? 'cod' : (payment_method === 'upi' ? 'upi' : 'online');
    const paymentStatusValue = isCod ? 'pending' : 'paid';
    const channelValue = ['phone_whatsapp', 'manual_admin', 'web'].includes(channel) ? channel : 'phone_whatsapp';

    const customerSnapshot = {
      id: customerId,
      full_name: customer_name.trim(),
      mobile: formattedMobile,
      alternate_mobile: customer_alternate_mobile?.trim() || null,
      address: newAddress,
    };

    // 6. Insert Order Master Record
    const { data: insertedOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        delivery_address_id: newAddress.id,
        channel: channelValue,
        order_status: 'confirmed',
        payment_method: paymentMethodValue,
        payment_status: paymentStatusValue,
        minimum_order_amount_snapshot: 0.00,
        subtotal_amount: subtotal,
        first_order_discount: 0.00,
        promo_discount: discount,
        cod_discount: 0.00,
        delivery_charge: deliveryFee,
        final_payable_amount: finalPayable,
        total_cost_amount: totalCost,
        placed_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        delivery_date: targetDeliveryDate,
        delivery_slot_start: delivery_slot_start,
        delivery_slot_end: delivery_slot_end,
        customer_name_snapshot: customer_name.trim(),
        customer_mobile_snapshot: formattedMobile,
        customer_alternate_mobile_snapshot: customer_alternate_mobile?.trim() || null,
        delivery_flat_house_snapshot: newAddress.flat_house_no || '',
        delivery_society_street_snapshot: newAddress.society_street_name,
        delivery_landmark_snapshot: newAddress.landmark || '',
        delivery_area_snapshot: newAddress.area_locality,
        delivery_city_snapshot: 'Halol',
        delivery_district_snapshot: 'Panchmahal',
        delivery_pincode_snapshot: newAddress.pincode,
        customer_snapshot_json: customerSnapshot,
        special_instructions: special_instructions?.trim() || 'Manual Phone/Admin Order',
        created_by_staff_id: user.id,
      })
      .select('id, order_number, final_payable_amount, delivery_date')
      .single();

    if (orderErr || !insertedOrder) {
      console.error('Error inserting master order:', orderErr);
      return NextResponse.json(
        { success: false, error: `Failed to create order: ${orderErr ? getErrorMessage(orderErr) : 'Database error'}` },
        { status: 500 }
      );
    }

    // 7. Insert Order Items
    const itemsWithOrderId = orderItemsToInsert.map((item) => ({
      ...item,
      order_id: insertedOrder.id,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(itemsWithOrderId);

    if (itemsErr) {
      console.error('Error inserting order items:', itemsErr);
      return NextResponse.json(
        { success: false, error: `Order master created but failed to attach items: ${getErrorMessage(itemsErr)}` },
        { status: 500 }
      );
    }

    // Trigger n8n order webhook in background
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/automation/n8n-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: insertedOrder.id }),
    }).catch(() => {
      // Non-fatal background trigger
    });

    return NextResponse.json({
      success: true,
      data: {
        order_id: insertedOrder.id,
        order_number: insertedOrder.order_number,
        final_payable_amount: insertedOrder.final_payable_amount,
        delivery_date: insertedOrder.delivery_date,
        total_items: orderItemsToInsert.length,
        customer_name: customer_name.trim(),
        customer_mobile: formattedMobile,
      },
    });
  } catch (err: unknown) {
    console.error('Unexpected error creating admin order:', err);
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
