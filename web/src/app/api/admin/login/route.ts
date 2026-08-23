import { NextResponse } from 'next/server';
/**
 * Legacy endpoint retained so older clients fail closed.
 * Staff authentication now uses Supabase Phone OTP directly and authorization
 * is resolved from the authenticated user's `user_roles` rows.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Legacy admin login is disabled. Use the secure phone verification flow.',
    },
    { status: 410 }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Legacy session cleared.' });
  response.cookies.delete('tajitokri_admin_session');
  return response;
}
