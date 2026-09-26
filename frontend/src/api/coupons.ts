import { api } from './client'
import type { Coupon } from '../types'

export function getActiveCoupons() {
  return api.get<Coupon[]>('/coupons')
}
