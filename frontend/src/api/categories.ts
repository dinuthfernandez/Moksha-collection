import { api } from './client'
import type { Category } from '../types'

export function getCategoryTree(type: 'clothing' | 'accessories') {
  return api.get<Category[]>(`/categories?type=${type}`)
}

export function getCategoryBySlug(slug: string) {
  return api.get<Category>(`/categories/${slug}`)
}
