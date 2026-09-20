import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { getPublicSettings } from '../api/settings'
import { getAddresses } from '../api/addresses'
import { createOrder } from '../api/orders'
import { ApiError } from '../api/client'
import { getAddressTier } from '../data/addressTiers'
import type { Address, DeliveryRate, DeliveryType } from '../types'
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

export default function OrderConfirmation() {
  const { items, subtotal, clear } = useCart()
  const { customer } = useAuth()
  const navigate = useNavigate()

  const [rates, setRates] = useState<DeliveryRate[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPublicSettings().then((settings) => setRates(settings.delivery_rates))
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
  const deliveryCharge = selectedRate?.rate_bhd ?? 0
  const total = subtotal + deliveryCharge

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
              <strong>{DELIVERY_LABELS[selectedRate.delivery_type]} delivery — {selectedRate.rate_bhd.toFixed(3)} BHD</strong>
              {selectedRate.description && <p>{selectedRate.description}</p>}
            </div>
          )}
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <strong>{subtotal.toFixed(3)} BHD</strong>
          </div>
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
