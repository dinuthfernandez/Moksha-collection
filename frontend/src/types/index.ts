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
