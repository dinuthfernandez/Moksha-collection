import { api } from './client'
import type { Category } from '../types'

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

