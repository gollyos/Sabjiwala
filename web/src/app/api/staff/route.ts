import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key);
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const { data: staffList, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        full_name,
        mobile,
        is_active,
        created_at,
        updated_at,
        user_roles!user_roles_user_id_fkey (
          role
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedStaff = (staffList || []).map((staff: any) => ({
      id: staff.id,
      full_name: staff.full_name,
      mobile: staff.mobile,
      is_active: staff.is_active,
      role: staff.user_roles?.[0]?.role || 'staff',
      created_at: staff.created_at,
      updated_at: staff.updated_at,
    }));

    return NextResponse.json({
      success: true,
      staff: formattedStaff,
      total_count: formattedStaff.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error fetching staff accounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const { admin_id, full_name, mobile, role, is_active } = body;

    if (!full_name || !mobile || !role) {
      return NextResponse.json(
        { success: false, error: 'Full name, mobile, and role are required' },
        { status: 400 }
      );
    }

    // Default to first owner if admin_id not provided in dev/testing
    let effectiveAdminId = admin_id;
    if (!effectiveAdminId) {
      const { data: ownerProfile } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'owner')
        .limit(1)
        .single();
      effectiveAdminId = ownerProfile?.user_id;
    }

    const { data, error } = await supabase.rpc('manage_staff_user', {
      p_admin_id: effectiveAdminId,
      p_target_user_id: null,
      p_full_name: full_name,
      p_mobile: mobile,
      p_role: role,
      p_is_active: is_active ?? true,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error creating staff account' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const { admin_id, user_id, full_name, mobile, role, is_active } = body;

    if (!user_id || !full_name || !mobile || !role) {
      return NextResponse.json(
        { success: false, error: 'user_id, full_name, mobile, and role are required' },
        { status: 400 }
      );
    }

    let effectiveAdminId = admin_id;
    if (!effectiveAdminId) {
      const { data: ownerProfile } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'owner')
        .limit(1)
        .single();
      effectiveAdminId = ownerProfile?.user_id;
    }

    const { data, error } = await supabase.rpc('manage_staff_user', {
      p_admin_id: effectiveAdminId,
      p_target_user_id: user_id,
      p_full_name: full_name,
      p_mobile: mobile,
      p_role: role,
      p_is_active: is_active,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error updating staff account' },
      { status: 500 }
    );
  }
}
