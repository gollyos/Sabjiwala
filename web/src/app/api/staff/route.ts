import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Verify caller has owner or manager role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner') && !roles.includes('manager')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient privileges to view staff' }, { status: 403 });
    }

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

    const formattedStaff = (staffList || []).map((staff: {
      id: string;
      full_name: string;
      mobile: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      user_roles?: Array<{ role: string }>;
    }) => ({
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching staff accounts';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Strict Owner role verification
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Owner can create staff accounts' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { full_name, mobile, role, is_active } = body;

    if (!full_name || !mobile || !role) {
      return NextResponse.json(
        { success: false, error: 'Full name, mobile, and role are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('manage_staff_user', {
      p_admin_id: user.id,
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error creating staff account';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Strict Owner role verification
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map(r => r.role);
    if (!roles.includes('owner')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Owner can modify staff accounts' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { user_id, full_name, mobile, role, is_active } = body;

    if (!user_id || !full_name || !mobile || !role) {
      return NextResponse.json(
        { success: false, error: 'user_id, full_name, mobile, and role are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('manage_staff_user', {
      p_admin_id: user.id,
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error updating staff account';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
