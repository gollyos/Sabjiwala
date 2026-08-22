const SENSITIVE_PATTERNS = [
  /supabase/i,
  /postgres/i,
  /sql/i,
  /jwt/i,
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /twilio/i,
  /n8n/i,
  /fast2sms/i,
  /razorpay/i,
  /column/i,
  /relation/i,
  /schema/i,
  /rpc/i,
  /auth/i,
  /p_start_date/i,
  /p_end_date/i,
  /failed to fetch/i,
];

export function getErrorMessage(error: unknown, fallback = 'કંઈક ખોટું થયું છે. કૃપા કરીને ફરી પ્રયાસ કરો. (Something went wrong. Please try again.)'): string {
  if (typeof error === 'string') {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(error)) return fallback;
    }
    return error;
  }

  if (error instanceof Error && error.message) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(error.message)) return fallback;
    }
    return error.message;
  }

  return fallback;
}

