import { api, cachedGet, peekCached } from './client'
import type { Category, PaginatedProducts, Product } from '../types'

export function getCategories(type?: 'clothing' | 'accessories') {
  const query = type ? `?type=${type}` : ''
  return cachedGet<Category[]>(`/categories${query}`, 300_000)
}

export function getCategoryTree(type: 'clothing' | 'accessories') {
  return getCategories(type)
}

export function getCategoryBySlug(slug: string) {
  return cachedGet<Category>(`/categories/${slug}`, 300_000)
}

export function getProducts(
  category?: 'clothing' | 'accessories',
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

export function getProductBySlug(slug: string) {
  return cachedGet<Product>(`/products/${slug}`)
}

export function peekProductBySlug(slug: string) {
  return peekCached<Product>(`/products/${slug}`)
}

