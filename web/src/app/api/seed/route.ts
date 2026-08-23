import crypto from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key);
}

// Timing-safe comparison. crypto.timingSafeEqual throws on unequal-length
// buffers, so lengths are checked first rather than letting it throw.
function secretsMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  try {
    // Always require a valid internal secret header, regardless of NODE_ENV —
    // a misconfigured NODE_ENV must never be the only thing standing between
    // this route and the internet.
    const expectedSecret = process.env.INTERNAL_SEED_SECRET;
    const authHeader = req.headers.get('x-seed-secret');
    if (!expectedSecret || !authHeader || !secretsMatch(authHeader, expectedSecret)) {
      return NextResponse.json(
        { success: false, error: 'Not available: valid x-seed-secret header required' },
        { status: 403 }
      );
    }

    const supabase = getServiceSupabase();

    const adminId = '11111111-1111-4111-a111-111111111111';
    const packingId = '22222222-2222-4222-a222-222222222222';
    const driverId = '33333333-3333-4333-a333-333333333333';
    const customerUserId = '44444444-4444-4444-a444-444444444444';

    // 1. Seed User Profiles
    await supabase.from('user_profiles').upsert([
      { id: adminId, full_name: 'Gunjan Admin (Owner)', mobile: '+919876543210', is_active: true },
      { id: packingId, full_name: 'Ramesh Godown (Packing Staff)', mobile: '+919876543211', is_active: true },
      { id: driverId, full_name: 'Suresh Driver (Halol Route)', mobile: '+919876543212', is_active: true },
      { id: customerUserId, full_name: 'Priya Patel (Halol Customer)', mobile: '+919876543213', is_active: true },
    ]);

    // 2. Seed User Roles
    await supabase.from('user_roles').upsert([
      { user_id: adminId, role: 'owner' },
      { user_id: packingId, role: 'packing' },
      { user_id: driverId, role: 'delivery' },
    ]);

    // 3. Seed Customer Record
    const { data: custData } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', customerUserId)
      .maybeSingle();

    let customerId = custData?.id;
    if (!customerId) {
      const { data: newCust } = await supabase
        .from('customers')
        .insert({
          auth_user_id: customerUserId,
          full_name: 'Priya Patel',
          mobile: '+919876543213',
          is_verified: true,
          verified_sequence: 1,
        })
        .select('id')
        .single();
      customerId = newCust?.id;
    }

    // 4. Seed Address
    if (customerId) {
      const { data: addrData } = await supabase
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (!addrData) {
        await supabase.from('customer_addresses').insert({
          customer_id: customerId,
          address_type: 'home',
          flat_house_no: 'Flat 402, Radhe Shyam Residency',
          society_street_name: 'Near Baska Toll & GIDC Road',
          landmark: 'Opposite Gayatri Mandir',
          area_locality: 'Baska / Halol Road',
          city: 'Halol',
          district: 'Panchmahal',
          state: 'Gujarat',
          pincode: '389350',
          is_default: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Trial test accounts and trial profiles successfully initialized!',
      trial_accounts: {
        admin: {
          name: 'Gunjan Admin (Owner)',
          role: 'owner',
          mobile: '9876543210',
          url: '/admin/dashboard',
        },
        godown: {
          name: 'Ramesh Godown (Packing Staff)',
          role: 'packing',
          mobile: '9876543211',
          url: '/admin/packing',
        },
        driver: {
          name: 'Suresh Driver (Halol Route)',
          role: 'delivery',
          mobile: '9876543212',
          url: '/driver',
        },
        customer: {
          name: 'Priya Patel (Halol Customer)',
          mobile: '9876543213',
          address: 'Flat 402, Radhe Shyam Residency, Baska, Halol - 389350',
          url: '/',
        },
      },
      domain_structure: {
        architecture: 'Single Unified Domain (tajitokri.store)',
        customer_store: 'tajitokri.store/',
        admin_hq: 'tajitokri.store/admin/dashboard',
        godown_packing: 'tajitokri.store/admin/packing',
        delivery_driver: 'tajitokri.store/driver',
        tracking: 'tajitokri.store/track/[token]',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? getErrorMessage(err) : 'Error in seed route';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
