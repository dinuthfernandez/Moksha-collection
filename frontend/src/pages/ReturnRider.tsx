import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, MapPin, Phone, XCircle } from 'lucide-react'
import { ApiError } from '../api/client'
import { completeReturnPickup, getReturnPickup } from '../api/rider'
import type { ReturnRiderOrder } from '../types'
import { withVariant } from '../utils/variant'
import './DeliveryRider.css'

export default function ReturnRider() {
  const { token = '' } = useParams()
  const [order, setOrder] = useState<ReturnRiderOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getReturnPickup(token)
      .then((data) => mounted && setOrder(data))
      .catch((err) => {
        if (mounted) {
          setError(err instanceof ApiError && err.status === 404
            ? 'This return link is invalid or no longer active.'
            : 'Could not load this return. Check your connection and retry.')
        }
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [token])

  const complete = async (key: string, itemIds?: string[]) => {
    if (!window.confirm(itemIds ? 'Confirm you collected this item?' : 'Confirm you collected all pending items?')) return
    setBusyKey(key)
    setError('')
    try {
      setOrder(await completeReturnPickup(token, itemIds))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this return. Please retry.')
    } finally {
      setBusyKey(null)
    }
  }

  const phoneLink = order?.phone.replace(/[^+\d]/g, '')
  const fullAddress = [order?.address, order?.city].filter(Boolean).join(', ')

  return (
    <main className="rider-page">
      <header className="rider-header">
        <img src="/assets/logo/logo.png" alt="Moksha Collections" />
        <span>Return Pickup</span>
      </header>

      {loading ? (
        <p className="rider-state">Loading return details…</p>
      ) : !order ? (
        <section className="rider-state rider-error-state" role="alert">
          <XCircle size={30} aria-hidden="true" />
          <h1>Return link unavailable</h1>
          <p>{error || 'This return link is invalid or no longer active.'}</p>
        </section>
      ) : (
        <div className="rider-content">
          <section className="rider-order-heading">
            <span className={`rider-status ${order.pending_count ? 'rider-status-shipped' : 'rider-status-delivered'}`}>
              {order.pending_count ? 'pickup pending' : 'return complete'}
            </span>
            <h1>Order #{order.id.slice(0, 8)}</h1>
            <p>Collect the items below from the customer</p>
          </section>

          {error && <p className="rider-error" role="alert">{error}</p>}

          <div className="rider-workspace">
            <div className="rider-overview">
              <section className="rider-details" aria-label="Customer details">
                <div className="rider-detail-row">
                  <span>Customer</span>
                  <strong>{order.customer_name}</strong>
                </div>
                <div className="rider-detail-row rider-address-row">
                  <span><MapPin size={16} aria-hidden="true" /> Pickup address</span>
                  <strong>{fullAddress || 'No address recorded'}</strong>
                </div>
                <a className="rider-call-button" href={`tel:${phoneLink}`}>
                  <Phone size={18} aria-hidden="true" />
                  Call {order.phone}
                </a>
              </section>

              <section className="rider-details" aria-label="Items to collect">
                {order.items.map((item) => (
                  <div className="rider-detail-row" key={item.id}>
                    <span>{item.return_status === 'completed' ? 'Collected' : 'To collect'}</span>
                    <strong>{withVariant(item.product_name ?? 'Item', item)}{item.product_code ? ` [${item.product_code}]` : ''} × {item.quantity}</strong>
                    {item.return_status === 'requested' && order.items.filter((i) => i.return_status === 'requested').length > 1 && (
                      <button type="button" className="rider-reschedule-button" disabled={busyKey !== null} onClick={() => void complete(item.id, [item.id])}>
                        {busyKey === item.id ? 'Saving…' : 'Mark this item returned'}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            </div>

            {order.pending_count > 0 ? (
              <section className="rider-actions" aria-label="Complete return">
                <button type="button" className="rider-delivered-button" disabled={busyKey !== null} onClick={() => void complete('all')}>
                  <CheckCircle2 size={19} aria-hidden="true" />
                  {busyKey === 'all' ? 'Updating…' : 'Mark Return Complete'}
                </button>
                <p className="rider-note">Completing the return puts the items back in stock.</p>
              </section>
            ) : (
              <section className="rider-finished rider-finished-delivered" role="status">
                <strong>Return complete. Items are back in stock.</strong>
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
