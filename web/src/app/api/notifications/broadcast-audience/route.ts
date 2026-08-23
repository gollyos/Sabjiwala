import crypto from 'node:crypto';
import { getErrorMessage } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_WORKER_SECRET || process.env.INTERNAL_API_SECRET;
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const receivedSecret = secretHeader || bearerSecret || '';
    let isAuthorized = Boolean(expectedSecret && secretsMatch(receivedSecret, expectedSecret));

    if (!isAuthorized) {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      if (user) {
        const { data: roles } = await sessionClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        isAuthorized = roles?.some(({ role }) => role === 'owner' || role === 'manager') || false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized broadcast audience request.' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const segment = body.segment || 'all';

    const query = supabase
      .from('customers')
      .select('id, full_name, mobile, is_active, created_at')
      .eq('is_active', true);

    const { data: customers, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
    }

    const formatted = (customers || []).map((c) => ({
      id: c.id,
      name: c.full_name,
      mobile: c.mobile,
    }));

    return NextResponse.json({
      success: true,
      segment,
      count: formatted.length,
      customers: formatted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
