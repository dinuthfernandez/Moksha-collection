import { api } from './client'
import type { ProductReview, ProductReviewList, ProductReviewPayload } from '../types'

export function getProductReviews(productId: string, offset = 0, limit = 3) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  return api.get<ProductReviewList>(`/reviews/product/${encodeURIComponent(productId)}?${params.toString()}`)
}

export function getMyReviewedOrderItems() {
  return api.get<string[]>('/reviews/mine/order-items')
}

export function submitProductReview(payload: ProductReviewPayload) {
  return api.post<ProductReview>('/reviews', payload)
}