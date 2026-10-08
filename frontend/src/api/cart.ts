import { api, clearApiCache } from './client'

export interface CartReservation {
  product_id: string
  quantity: number
  expires_at: string | null
  stock_quantity: number
}

export async function setCartReservation(cartId: string, productId: string, quantity: number) {
  const reservation = await api.put<CartReservation>(`/cart/reservations/${productId}`, { cart_id: cartId, quantity })
  clearApiCache()
  return reservation
}