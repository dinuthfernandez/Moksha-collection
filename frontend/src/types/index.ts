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
  address_line1: string
  address_line2?: string | null
  city: string
  state_region?: string | null
  postal_code?: string | null
  delivery_notes?: string | null
  is_default: boolean
}

export type AddressPayload = Omit<Address, 'id' | 'customer_id' | 'created_at'>

