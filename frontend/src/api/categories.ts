import { api } from './client'
import type { Category, PaginatedProducts } from '../types'

export function getCategories(type?: 'clothing' | 'accessories') {
  const query = type ? `?type=${type}` : ''
  return api.get<Category[]>(`/categories${query}`)
}

export function getCategoryTree(type: 'clothing' | 'accessories') {
  return getCategories(type)
}

export function getCategoryBySlug(slug: string) {
  return api.get<Category>(`/categories/${slug}`)
}

export function getProducts(category?: 'clothing' | 'accessories', page = 1, pageSize = 24) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (category) params.set('category', category)
  return api.get<PaginatedProducts>(`/products?${params.toString()}`)
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
  return api.get<import('../types').Product>(`/products/${slug}`)
}

