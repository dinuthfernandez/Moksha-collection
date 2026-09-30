import { api } from './client'

export interface CartReservation {
  product_id: string
  quantity: number
  expires_at: string | null
  stock_quantity: number
}

export function setCartReservation(cartId: string, productId: string, quantity: number) {
  return api.put<CartReservation>(`/cart/reservations/${productId}`, { cart_id: cartId, quantity })
}