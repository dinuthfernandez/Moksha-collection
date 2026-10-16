import { api } from './client'
import type { ReturnRiderOrder, RiderOrder } from '../types'

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

export function getReturnPickup(token: string) {
  return api.get<ReturnRiderOrder>(`/delivery/return/${encodeURIComponent(token)}`)
}

export function completeReturnPickup(token: string, itemIds?: string[]) {
  return api.put<ReturnRiderOrder>(`/delivery/return/${encodeURIComponent(token)}`, { item_ids: itemIds })
}