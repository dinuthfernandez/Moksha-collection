// Shared domain types for the Moksha Collections storefront.
// Mirrors the Supabase `moksha_collection` schema tables.

export type CategoryType = 'clothing' | 'accessories'

export interface Category {
  id: string
  name: string
  slug: string
  type: CategoryType
  parent_id: string | null
  image_url: string | null
  display_order: number
  is_active: boolean
}

export interface Product {
  id: string
  product_code?: string | null
  zoho_item_id?: string | null
  category_slug?: string | null
  name: string
  slug: string
  description?: string | null
  price: number
  compare_at_price?: number | null
  is_active: boolean
  is_new_arrival: boolean
  is_on_sale: boolean
  is_under_5bhd: boolean
  stock_quantity: number
  image_url?: string | null
  zoho_sku?: string | null
  brand?: string | null
  length?: number | null
  width?: number | null
  height?: number | null
  weight?: number | null
  dimension_unit?: string | null
  weight_unit?: string | null
  last_synced_at?: string | null
  created_at?: string | null
}

export interface ProductReview {
  id: string
  product_id: string
  reviewer_name: string
  rating: number
  comment?: string | null
  created_at: string
}

export interface ProductReviewList {
  items: ProductReview[]
  total: number
  average_rating: number
}

export interface ProductReviewPayload {
  order_item_id: string
  rating: number
  comment?: string
}

export interface PaginatedProducts {
  items: Product[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SizeChart {
  id: string
  name: string
  slug: string
  icon_url: string
  chart_image_urls: string[]
  display_order: number
}

export interface Announcement {
  id: string
  message: string
  display_order: number
  is_active: boolean
}

export interface ContactPayload {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}

export interface CartItem {
  id: string
  name: string
  image_url?: string
  price: number
  quantity: number
  size?: string
  color?: string
}

// ---------------------------------------------------------------------------
// Auth / customer account
// ---------------------------------------------------------------------------
export interface Customer {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_country_code: string
  phone: string
  country_code?: string | null
  country_name?: string | null
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  customer: Customer
}

export interface RegisterPayload {
  email: string
  password: string
  first_name: string
  last_name: string
  phone_country_code: string
  phone: string
  country_code: string
  country_name: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface CustomerUpdatePayload {
  first_name: string
  last_name: string
  phone_country_code: string
  phone: string
}

export interface WishlistItem {
  id: string
  customer_id: string
  product_id: string
  product_name: string
  product_slug?: string | null
  image_url?: string | null
  price?: number | null
  currency: string
  created_at: string
}

export type WishlistItemPayload = Omit<WishlistItem, 'id' | 'customer_id' | 'created_at'>

// International-ready delivery address.
export interface Address {
  id: string
  customer_id: string
  created_at: string
  label: string
  full_name: string
  phone_country_code: string
  phone: string
  country_code: string
  country_name: string
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state_region?: string | null
  postal_code?: string | null
  block_number?: string | null
  road_number?: string | null
  building_name?: string | null
  apartment_number?: string | null
  district?: string | null
  tax_id?: string | null
  delivery_notes?: string | null
  is_default: boolean
}

export type AddressPayload = Omit<Address, 'id' | 'customer_id' | 'created_at'>

// ---------------------------------------------------------------------------
// Orders / checkout / returns
// ---------------------------------------------------------------------------
export type DeliveryType = 'bahrain' | 'gcc' | 'international'

export interface DeliveryRate {
  delivery_type: DeliveryType
  rate_bhd: number
  description?: string | null
  delivery_days_from: number
  delivery_days_to: number
  free_delivery_over_bhd?: number | null
}

export interface PublicSettings {
  iban_number?: string | null
  whatsapp_number?: string | null
  return_window_days: number
  delivery_rates: DeliveryRate[]
}

export interface Coupon {
  id: string
  name: string
  percentage: number
  is_active: boolean
  valid_from: string
  valid_to: string
  minimum_cart_amount: number
  created_at?: string | null
  updated_at?: string | null
}

export type CouponPayload = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>

export interface CouponOffer {
  applied: Coupon | null
  discount_amount: number
  next: Coupon | null
  amount_to_next: number
}

export interface OrderItemPayload {
  product_id: string
  quantity: number
}

export interface OrderCreatePayload {
  customer_name: string
  phone: string
  email?: string
  address?: string
  city?: string
  notes?: string
  delivery_type: DeliveryType
  items: OrderItemPayload[]
}

export interface OrderCreateResult {
  id: string
  total_amount: number
  subtotal_amount: number
  delivery_charge: number
  discount_amount: number
  coupon_id?: string | null
  coupon_name?: string | null
  coupon_percentage?: number | null
  delivery_type: DeliveryType | null
  status: string
  zoho_invoice_id?: string | null
  zoho_invoice_number?: string | null
  created_at?: string | null
}

export type OrderStatus = 'pending' | 'accepted' | 'delivered' | 'cancelled'
export type ReturnStatus = 'none' | 'requested' | 'completed'

export interface OrderItemDetail {
  id: string
  product_id?: string | null
  product_name?: string | null
  product_image_url?: string | null
  quantity: number
  price: number
}

export interface OrderDetail {
  id: string
  customer_name: string
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  notes?: string | null
  subtotal_amount: number
  delivery_charge: number
  discount_amount?: number
  coupon_id?: string | null
  coupon_name?: string | null
  coupon_percentage?: number | null
  delivery_type?: DeliveryType | null
  total_amount: number
  status: OrderStatus
  return_status: ReturnStatus
  return_requested_at?: string | null
  return_completed_at?: string | null
  cancel_reason?: string | null
  zoho_invoice_id?: string | null
  zoho_invoice_number?: string | null
  created_at?: string | null
  items: OrderItemDetail[]
}

// Order detail enriched with the underlying account's contact info, used on the admin Return Orders page.
export interface ReturnOrder extends OrderDetail {
  customer_first_name?: string | null
  customer_last_name?: string | null
  customer_account_email?: string | null
  customer_account_phone_country_code?: string | null
  customer_account_phone?: string | null
}

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------
export interface DashboardStats {
  total_customers: number
  total_orders: number
  total_returns: number
  profit_estimate: number
}

export interface AdminSettings {
  iban_number?: string | null
  whatsapp_number?: string | null
  return_window_days: number
  updated_at?: string | null
}

export interface AdminCustomer {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_country_code: string
  phone: string
  country_name?: string | null
  is_active: boolean
  is_banned: boolean
  created_at: string
}

export interface AdminCustomerDetail extends AdminCustomer {
  addresses: Address[]
  orders: OrderDetail[]
}

export interface Campaign {
  id: string
  subject: string
  body: string
  recipient_count: number
  created_at: string
}

