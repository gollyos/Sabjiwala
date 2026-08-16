export interface Unit {
  id: string;
  code: string;
  name_en: string;
  name_gu: string;
}

export type ProductUnit = Unit;

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_gu: string;
  display_order: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  unit_id: string;
  sku: string;
  variant_name_en: string;
  variant_name_gu: string;
  multiplier_to_base_unit: number;
  selling_price: number;
  current_estimated_cost?: number; // Owner / manager only
  min_order_qty: number;
  max_order_qty: number;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  unit_code?: string;
  unit_name_en?: string;
  unit_name_gu?: string;
}

export interface Product {
  id: string;
  category_id: string;
  base_unit_id: string;
  slug: string;
  name_en: string;
  name_gu: string;
  description_en?: string;
  description_gu?: string;
  image_url?: string | null;
  is_seasonal: boolean;
  is_in_stock: boolean;
  is_active: boolean;
  display_order: number;
  category_name_en?: string;
  category_name_gu?: string;
  base_unit_code?: string;
  variants?: ProductVariant[];
}

export interface SellingPriceHistory {
  id: string;
  product_variant_id: string;
  selling_price: number;
  old_price?: number;
  change_reason?: string;
  changed_by?: string;
  effective_at: string;
}

export interface Customer {
  id: string;
  auth_user_id: string;
  full_name: string;
  mobile: string;
  alternate_mobile?: string | null;
  email?: string | null;
  is_verified: boolean;
  verified_at?: string | null;
  verified_sequence?: number | null;
  is_active: boolean;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_type: 'home' | 'work' | 'temporary';
  flat_house_no: string;
  society_street_name: string;
  landmark?: string | null;
  area_locality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface QuoteItem {
  variant_id: string;
  product_id: string;
  product_name_en: string;
  product_name_gu: string;
  variant_name_en: string;
  variant_name_gu: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_available: boolean;
  unavailability_reason?: string | null;
}

export interface PromotionQuote {
  code: string;
  eligible: boolean;
  percentage: number;
  discount_amount: number;
  reason: string;
}

export interface PaymentQuote {
  method: 'cod' | 'online';
  discount_percentage: number;
  discount_amount: number;
  label?: string;
  online_enabled?: boolean;
}

export interface DeliveryQuote {
  charge: number;
  is_free: boolean;
}

export interface CheckoutQuote {
  items: QuoteItem[];
  has_unavailable_items: boolean;
  subtotal: number;
  minimum_order_amount: number;
  minimum_order_met: boolean;
  remaining_amount_to_minimum: number;
  promotion: PromotionQuote;
  payment: PaymentQuote;
  delivery: DeliveryQuote;
  final_payable: number;
  quote_timestamp: string;
}

export interface CustomerProfileState {
  authenticated: boolean;
  is_onboarded: boolean;
  mobile?: string;
  customer?: Customer;
  default_address?: CustomerAddress;
  addresses?: CustomerAddress[];
}
