import { api } from './client'
import type { WishlistItem, WishlistItemPayload } from '../types'

export const getWishlist = () => api.get<WishlistItem[]>('/wishlist')
export const addWishlistItem = (item: WishlistItemPayload) => api.post<WishlistItem>('/wishlist', item)
export const removeWishlistItem = (productId: string) => api.delete<void>(`/wishlist/${encodeURIComponent(productId)}`)
