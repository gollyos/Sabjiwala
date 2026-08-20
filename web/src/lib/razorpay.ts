import crypto from 'node:crypto';

export interface RazorpayOrderPayload {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPaymentEntity {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  method: string;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export class RazorpayService {
  private static getKeyId(): string {
    const key = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!key && process.env.NODE_ENV === 'production') {
      throw new Error('Razorpay key ID is not configured.');
    }
    return key || 'rzp_test_sabjiwala_mock';
  }

  private static getKeySecret(): string {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('Razorpay key secret is not configured.');
    }
    return secret || 'sabjiwala_mock_secret_test_key_123';
  }

  private static getWebhookSecret(): string {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('Razorpay webhook secret is not configured.');
    }
    return secret || 'sabjiwala_mock_webhook_secret_456';
  }

  /**
   * Creates a server-side authoritative Razorpay Order
   */
  static async createOrder(payload: RazorpayOrderPayload): Promise<RazorpayOrderResponse> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();

    // If using live or real test credentials
    if (!keyId.includes('mock') && !keySecret.includes('mock')) {
      const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Razorpay Order creation failed: ${errJson.error?.description || res.statusText}`);
      }

      return res.json();
    }

    // Mock fallback for test harnesses
    const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    return {
      id: mockOrderId,
      entity: 'order',
      amount: payload.amount,
      amount_paid: 0,
      amount_due: payload.amount,
      currency: payload.currency || 'INR',
      receipt: payload.receipt,
      status: 'created',
      attempts: 0,
      notes: payload.notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Fetches payment details from Razorpay API
   */
  static async getPayment(paymentId: string): Promise<RazorpayPaymentEntity | null> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();

    if (!keyId.includes('mock') && !keySecret.includes('mock')) {
      const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!res.ok) {
        return null;
      }

      return res.json();
    }

    // Mock representation
    return {
      id: paymentId,
      entity: 'payment',
      amount: 0,
      currency: 'INR',
      status: 'captured',
      order_id: '',
      method: 'upi',
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Verifies client-side Razorpay Checkout Signature
   * Signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  static verifyPaymentSignature(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    customSecret?: string;
  }): boolean {
    const secret = params.customSecret || this.getKeySecret();
    const data = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    try {
      const a = Buffer.from(expectedSignature, 'utf8');
      const b = Buffer.from(params.razorpay_signature, 'utf8');
      if (a.length !== b.length) {
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Verifies incoming Webhook signature against RAW request body string
   * Signature = HMAC_SHA256(rawBody, webhookSecret)
   */
  static verifyWebhookSignature(params: {
    rawBody: string;
    signature: string;
    customSecret?: string;
  }): boolean {
    const secret = params.customSecret || this.getWebhookSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(params.rawBody).digest('hex');

    try {
      const a = Buffer.from(expectedSignature, 'utf8');
      const b = Buffer.from(params.signature, 'utf8');
      if (a.length !== b.length) {
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
