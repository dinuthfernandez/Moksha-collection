import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Truck } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { getPublicSettings } from '../api/settings'
import { getAddresses } from '../api/addresses'
import { createOrder } from '../api/orders'
import { getActiveCoupons } from '../api/coupons'
import { calculateCouponOffer } from '../utils/coupons'
import { ApiError } from '../api/client'
import { getAddressTier } from '../data/addressTiers'
import type { Address, Coupon, DeliveryRate, DeliveryType } from '../types'
import './OrderConfirmation.css'

const DELIVERY_LABELS: Record<DeliveryType, string> = {
  bahrain: 'Bahrain (Local)',
  gcc: 'GCC',
  international: 'International',
}

function formatAddressLine(address: Address): string {
  const parts = [
    address.block_number && `Block ${address.block_number}`,
    address.road_number && `Road ${address.road_number}`,
    address.building_name,
    address.apartment_number && `Apt ${address.apartment_number}`,
    address.address_line1,
    address.address_line2,
    address.district,
  ].filter(Boolean)
  return parts.join(', ')
}

function formatDeliveryDate(daysFromNow: number) {
  if (!Number.isInteger(daysFromNow) || daysFromNow < 0 || daysFromNow > 90) return null
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + daysFromNow)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export default function OrderConfirmation() {
  const { items, subtotal, clear } = useCart()
  const { customer } = useAuth()
  const navigate = useNavigate()

  const [rates, setRates] = useState<DeliveryRate[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPublicSettings().then((settings) => setRates(settings.delivery_rates))
    getActiveCoupons().then(setCoupons).catch(() => setCoupons([]))
    getAddresses()
      .then((data) => {
        setAddresses(data)
        const preselected = data.find((a) => a.is_default) ?? data[0]
        if (preselected) setSelectedAddressId(preselected.id)
      })
      .finally(() => setAddressesLoading(false))
  }, [])

  const selectedAddress = useMemo(() => addresses.find((a) => a.id === selectedAddressId) ?? null, [addresses, selectedAddressId])
  const deliveryType: DeliveryType | null = selectedAddress ? getAddressTier(selectedAddress.country_code) : null
  const selectedRate = useMemo(() => rates.find((r) => r.delivery_type === deliveryType), [rates, deliveryType])
  const freeDeliveryUnlocked = Boolean(
    selectedRate?.free_delivery_over_bhd != null && subtotal >= selectedRate.free_delivery_over_bhd,
  )
  const deliveryCharge = selectedRate ? (freeDeliveryUnlocked ? 0 : selectedRate.rate_bhd) : 0
  const deliveryDateRange = selectedRate
    ? (() => {
        const from = formatDeliveryDate(selectedRate.delivery_days_from)
        const to = formatDeliveryDate(selectedRate.delivery_days_to)
        return from && to && selectedRate.delivery_days_to >= selectedRate.delivery_days_from ? `${from} – ${to}` : null
      })()
    : null
  const couponOffer = useMemo(() => calculateCouponOffer(subtotal, coupons), [subtotal, coupons])
  const total = Math.max(0, subtotal - couponOffer.discount_amount) + deliveryCharge

  const onConfirm = async () => {
    if (!customer) {
      navigate('/login', { state: { from: '/checkout' } })
      return
    }
    if (!selectedAddress || !deliveryType) {
      setError('Please select a delivery address.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const order = await createOrder({
        customer_name: selectedAddress.full_name,
        phone: `${selectedAddress.phone_country_code}${selectedAddress.phone}`,
        email: customer.email,
        address: formatAddressLine(selectedAddress),
        city: selectedAddress.city || selectedAddress.state_region || selectedAddress.country_name,
        notes,
        delivery_type: deliveryType,
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
      })
      sessionStorage.setItem('moksha-last-order', JSON.stringify(order))
      clear()
      navigate('/checkout/payment', { state: { order } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="container order-confirmation-page">
        <p>Your cart is empty.</p>
      </div>
    )
  }

  return (
    <div className="container order-confirmation-page">
      <div className="section-heading">
        <span className="eyebrow">Step 1 of 2</span>
        <h1 className="section-title">Delivery &amp; Order Summary</h1>
      </div>

      <div className="order-confirmation-layout">
        <div className="order-confirmation-items">
          <h2>Items</h2>
          <ul>
            {items.map((item) => (
              <li key={`${item.id}-${item.size}-${item.color}`}>
                <span>{item.name} × {item.quantity}</span>
                <strong>{(item.price * item.quantity).toFixed(3)} BHD</strong>
              </li>
            ))}
          </ul>

          <div className="order-confirmation-address-header">
            <h2>Delivery Address</h2>
            <Link to="/addresses" className="btn btn-outline order-confirmation-add-address">
              Add New Address
            </Link>
          </div>

          {addressesLoading && <p>Loading your addresses…</p>}
          {!addressesLoading && addresses.length === 0 && (
            <p className="order-confirmation-no-address">
              You don't have any saved addresses yet. <Link to="/addresses">Add one</Link> to continue.
            </p>
          )}

          <div className="address-options">
            {addresses.map((a) => (
              <label key={a.id} className={`address-option ${selectedAddressId === a.id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="delivery-address"
                  checked={selectedAddressId === a.id}
                  onChange={() => setSelectedAddressId(a.id)}
                />
                <div>
                  <strong>
                    {a.label} — {a.full_name} {a.is_default && <span className="address-default-tag">Default</span>}
                  </strong>
                  <p>{formatAddressLine(a)}</p>
                  <p>{[a.city, a.state_region, a.country_name].filter(Boolean).join(', ')}</p>
                  <p>{a.phone_country_code} {a.phone}</p>
                </div>
              </label>
            ))}
          </div>

          <h2>Order Notes (optional)</h2>
          <label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="order-confirmation-summary">
          {selectedRate && (
            <div className="delivery-rate-note">
              <strong><Truck size={16} aria-hidden="true" /> {DELIVERY_LABELS[selectedRate.delivery_type]} delivery — {selectedRate.rate_bhd.toFixed(3)} BHD</strong>
              {selectedRate.description && <p>{selectedRate.description}</p>}
              {selectedRate.free_delivery_over_bhd != null && (
                <p className="free-delivery-status" role="status">
                  {freeDeliveryUnlocked
                    ? 'Free delivery unlocked'
                    : `Add ${(selectedRate.free_delivery_over_bhd - subtotal).toFixed(3)} BHD more for free delivery`}
                </p>
              )}
              <div className="checkout-delivery-estimate">
                <CalendarDays size={15} aria-hidden="true" />
                <span>{deliveryDateRange ? `Estimated delivery: ${deliveryDateRange}` : 'Delivery date estimate unavailable'}</span>
              </div>
            </div>
          )}
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <strong>{subtotal.toFixed(3)} BHD</strong>
          </div>
          {couponOffer.applied ? (
            <>
              <div className="checkout-coupon-banner" role="status">
                <span>{couponOffer.applied.name} applied · {couponOffer.applied.percentage}% off</span>
                <strong>You save {couponOffer.discount_amount.toFixed(3)} BHD</strong>
              </div>
              <div className="cart-summary-row checkout-discount-row">
                <span>Coupon discount</span>
                <strong>−{couponOffer.discount_amount.toFixed(3)} BHD</strong>
              </div>
              {couponOffer.next && (
                <p className="checkout-next-coupon">
                  Add {couponOffer.amount_to_next.toFixed(3)} BHD more to unlock {couponOffer.next.percentage}% off.
                </p>
              )}
            </>
          ) : couponOffer.next ? (
            <div className="checkout-coupon-banner checkout-next-tier" role="status">
              <span>{couponOffer.next.percentage}% off available</span>
              <strong>Add {couponOffer.amount_to_next.toFixed(3)} BHD more to unlock {couponOffer.next.name}.</strong>
            </div>
          ) : null}
          <div className="cart-summary-row">
            <span>Delivery {deliveryType ? `(${DELIVERY_LABELS[deliveryType]})` : ''}</span>
            <strong>{deliveryCharge.toFixed(3)} BHD</strong>
          </div>
          <div className="cart-summary-row order-confirmation-total">
            <span>Total</span>
            <strong>{total.toFixed(3)} BHD</strong>
          </div>
          {error && <p className="auth-form-error">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={submitting || !selectedAddress}>
            {submitting ? 'Placing order…' : 'Confirm & Continue to Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
