import { api, cachedGet, peekCached } from './client'
import type { Category, PaginatedProducts, Product } from '../types'

export function getCategories(type?: 'clothing' | 'accessories' | 'saree') {
  const query = type ? `?type=${type}` : ''
  return cachedGet<Category[]>(`/categories${query}`, 300_000).then(othersLast)
}

// "Others" is a catch-all, so it always sits at the end of the category cards.
function othersLast(categories: Category[]) {
  const isOthers = (c: Category) => c.name.trim().toLowerCase() === 'others'
  return [...categories.filter((c) => !isOthers(c)), ...categories.filter(isOthers)]
}

export function getCategoryTree(type: 'clothing' | 'accessories' | 'saree') {
  return getCategories(type)
}

export function getCategoryBySlug(slug: string) {
  return cachedGet<Category>(`/categories/${slug}`, 300_000)
}

export function getProducts(
  category?: 'clothing' | 'accessories' | 'saree',
  page = 1,
  pageSize = 24,
  query?: string,
  categorySlug?: string,
) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (category) params.set('category', category)
  if (query) params.set('q', query)
  if (categorySlug) params.set('category_slug', categorySlug)
  return cachedGet<PaginatedProducts>(`/products?${params.toString()}`)
}

export function searchProducts(
  query: string,
  page = 1,
  pageSize = 24,
  minPrice?: number,
  maxPrice?: number,
) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), q: query })
  if (minPrice !== undefined) params.set('min_price', String(minPrice))
  if (maxPrice !== undefined) params.set('max_price', String(maxPrice))
  return api.get<PaginatedProducts>(`/products?${params.toString()}`)
}

export interface SearchSuggestion {
  type: 'category' | 'product'
  label: string
  url: string
  image_url?: string | null
  price?: number | null
  category?: string | null
}

export function getSearchSuggestions(query: string) {
  return api.get<{ suggestions: SearchSuggestion[] }>(`/products/suggest?q=${encodeURIComponent(query)}`)
}

export function getProductBySlug(slug: string) {
  return cachedGet<Product>(`/products/${slug}`)
}

export function peekProductBySlug(slug: string) {
  return peekCached<Product>(`/products/${slug}`)
}

