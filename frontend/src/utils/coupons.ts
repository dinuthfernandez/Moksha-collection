import type { Coupon, CouponOffer } from '../types'

export function calculateCouponOffer(subtotal: number, coupons: Coupon[]): CouponOffer {
  const now = Date.now()
  const validCoupons = coupons.filter((coupon) => {
    const start = Date.parse(coupon.valid_from)
    const end = Date.parse(coupon.valid_to)
    return coupon.is_active && Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end
  })

  const eligible = validCoupons
    .filter((coupon) => Number(coupon.minimum_cart_amount) <= subtotal)
    .sort((a, b) => Number(b.percentage) - Number(a.percentage) || Number(a.minimum_cart_amount) - Number(b.minimum_cart_amount))
  const applied = eligible[0] ?? null
  const currentPercentage = applied ? Number(applied.percentage) : 0
  const next = validCoupons
    .filter((coupon) => Number(coupon.minimum_cart_amount) > subtotal && Number(coupon.percentage) > currentPercentage)
    .sort((a, b) => Number(a.minimum_cart_amount) - Number(b.minimum_cart_amount) || Number(b.percentage) - Number(a.percentage))[0] ?? null
  const discountAmount = applied ? Number((subtotal * Number(applied.percentage) / 100).toFixed(3)) : 0

  return {
    applied,
    discount_amount: discountAmount,
    next,
    amount_to_next: next ? Number((Number(next.minimum_cart_amount) - subtotal).toFixed(3)) : 0,
  }
}
