import { api } from './client'
import type { RiderOrder } from '../types'

export type RiderOrderAction = 'delivered' | 'attempt_failed' | 'cancelled'

export function getRiderOrder(token: string) {
  return api.get<RiderOrder>(`/delivery/${encodeURIComponent(token)}`)
}

export function updateRiderOrder(
  token: string,
  payload: { action: RiderOrderAction; expected_delivery_date?: string; note?: string },
) {
  return api.put<RiderOrder>(`/delivery/${encodeURIComponent(token)}`, payload)
}