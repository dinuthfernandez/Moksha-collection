import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePercent, Truck } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { getActiveCoupons } from '../api/coupons'
import { getPublicSettings } from '../api/settings'
import { calculateCouponOffer } from '../utils/coupons'
import type { Coupon, DeliveryRate } from '../types'
import EmptyState from '../components/ui/EmptyState'
import './Cart.css'

const DELIVERY_LABELS: Record<DeliveryRate['delivery_type'], string> = {
  bahrain: 'Bahrain',
  gcc: 'GCC',
  international: 'International',
}

export default function Cart() {
  const { items, removeItem, updateQuantity, subtotal } = useCart()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([])

  useEffect(() => {
    getActiveCoupons().then(setCoupons).catch(() => setCoupons([]))
    getPublicSettings().then((settings) => setDeliveryRates(settings.delivery_rates)).catch(() => setDeliveryRates([]))
  }, [])

  const couponOffer = calculateCouponOffer(subtotal, coupons)
  const freeDeliveryRates = deliveryRates.filter((rate) => rate.free_delivery_over_bhd != null)
  const discountedSubtotal = Math.max(0, subtotal - couponOffer.discount_amount)

  return (
    <div className="container cart-page">
      <div className="section-heading">
        <span className="eyebrow">Your Bag</span>
        <h1 className="section-title">Shopping Cart</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Your Cart Is Empty" message="Browse Clothing or Accessories to find something you'll love." />
      ) : (
        <div className="cart-layout">
          <ul className="cart-items">
            {items.map((item) => (
              <li key={`${item.id}-${item.size}-${item.color}`} className="cart-item">
                {item.image_url && <img src={item.image_url} alt={item.name} />}
                <div className="cart-item-info">
                  <h3>{item.name}</h3>
                  {item.size && <span>Size: {item.size}</span>}
                  {item.color && <span>Color: {item.color}</span>}
                  <div className="cart-item-qty">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-item-price">{(item.price * item.quantity).toFixed(2)} BHD</div>
                <button className="cart-item-remove" onClick={() => removeItem(item.id)} aria-label="Remove">
                  &times;
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            {freeDeliveryRates.length > 0 && (
              <div className="cart-free-delivery" role="status">
                <div className="cart-free-delivery-heading">
                  <Truck size={18} aria-hidden="true" />
                  <strong>Free delivery progress</strong>
                </div>
                <ul>
                  {freeDeliveryRates.map((rate) => {
                    const threshold = rate.free_delivery_over_bhd!
                    const remaining = Math.max(0, threshold - subtotal)
                    return (
                      <li key={rate.delivery_type}>
                        <span>{DELIVERY_LABELS[rate.delivery_type]}</span>
                        <strong>
                          {remaining === 0
                            ? 'Unlocked'
                            : `Add ${remaining.toFixed(3)} BHD · over ${threshold.toFixed(3)} BHD`}
                        </strong>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {couponOffer.applied ? (
              <div className="coupon-offer-card coupon-offer-applied" role="status">
                <BadgePercent size={19} aria-hidden="true" />
                <div>
                  <strong>{couponOffer.applied.name} · {couponOffer.applied.percentage}% off</strong>
                  <p>You saved {couponOffer.discount_amount.toFixed(3)} BHD on your items.</p>
                  {couponOffer.next && (
                    <p>Add {couponOffer.amount_to_next.toFixed(3)} BHD more to unlock {couponOffer.next.percentage}% off.</p>
                  )}
                </div>
              </div>
            ) : couponOffer.next ? (
              <div className="coupon-offer-card" role="status">
                <BadgePercent size={19} aria-hidden="true" />
                <div>
                  <strong>{couponOffer.next.percentage}% off available</strong>
                  <p>Add {couponOffer.amount_to_next.toFixed(3)} BHD more to unlock {couponOffer.next.name}.</p>
                </div>
              </div>
            ) : null}
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <strong>{subtotal.toFixed(2)} BHD</strong>
            </div>
            {couponOffer.applied && (
              <>
                <div className="cart-summary-row cart-discount-row">
                  <span>{couponOffer.applied.name} ({couponOffer.applied.percentage}%)</span>
                  <strong>−{couponOffer.discount_amount.toFixed(3)} BHD</strong>
                </div>
                <div className="cart-summary-row cart-discounted-subtotal">
                  <span>After discount</span>
                  <strong>{discountedSubtotal.toFixed(3)} BHD</strong>
                </div>
              </>
            )}
            <Link to="/checkout" className="btn btn-primary">
              Proceed to Purchase
            </Link>
            <Link to="/clothing" className="btn btn-outline">
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
