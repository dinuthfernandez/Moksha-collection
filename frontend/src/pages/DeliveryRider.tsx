import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, CheckCircle2, MapPin, Phone, XCircle } from 'lucide-react'
import { ApiError } from '../api/client'
import { getRiderOrder, updateRiderOrder } from '../api/rider'
import type { RiderOrder } from '../types'
import './DeliveryRider.css'

function tomorrowDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export default function DeliveryRider() {
  const { token = '' } = useParams()
  const [order, setOrder] = useState<RiderOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newDate, setNewDate] = useState('')
  const [attemptNote, setAttemptNote] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)

  useEffect(() => {
    let mounted = true
    getRiderOrder(token)
      .then((data) => mounted && setOrder(data))
      .catch((err) => {
        if (mounted) {
          setError(err instanceof ApiError && err.status === 404
            ? 'This delivery link is invalid or no longer active.'
            : 'Could not load this delivery. Check your connection and retry.')
        }
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [token])

  const applyUpdate = async (action: 'delivered' | 'attempt_failed' | 'cancelled', values: { expected_delivery_date?: string; note?: string } = {}) => {
    setBusy(true)
    setError('')
    try {
      const updated = await updateRiderOrder(token, { action, ...values })
      setOrder(updated)
      if (action === 'attempt_failed') {
        setNewDate('')
        setAttemptNote('')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this delivery. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  const onExtend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newDate) return
    void applyUpdate('attempt_failed', {
      expected_delivery_date: newDate,
      note: attemptNote.trim() || undefined,
    })
  }

  const onCancel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const note = cancelNote.trim()
    if (!note) return
    void applyUpdate('cancelled', { note })
  }

  const phoneLink = order?.phone.replace(/[^+\d]/g, '')
  const fullAddress = [order?.address, order?.city].filter(Boolean).join(', ')

  return (
    <main className="rider-page">
      <header className="rider-header">
        <img src="/assets/logo/logo.png" alt="Moksha Collections" />
        <span>Delivery</span>
      </header>

      {loading ? (
        <p className="rider-state">Loading delivery details…</p>
      ) : !order ? (
        <section className="rider-state rider-error-state" role="alert">
          <XCircle size={30} aria-hidden="true" />
          <h1>Delivery link unavailable</h1>
          <p>{error || 'This delivery link is invalid or no longer active.'}</p>
        </section>
      ) : (
        <div className="rider-content">
          <section className="rider-order-heading">
            <span className={`rider-status rider-status-${order.status}`}>{order.status}</span>
            <h1>Order #{order.id.slice(0, 8)}</h1>
            <p>Delivery details for the assigned order</p>
          </section>

          {error && <p className="rider-error" role="alert">{error}</p>}

          <div className="rider-workspace">
            <div className="rider-overview">
              <section className="rider-details" aria-label="Customer delivery details">
                <div className="rider-detail-row">
                  <span>Customer</span>
                  <strong>{order.customer_name}</strong>
                </div>
                <div className="rider-detail-row rider-address-row">
                  <span><MapPin size={16} aria-hidden="true" /> Delivery address</span>
                  <strong>{fullAddress || 'No delivery address recorded'}</strong>
                </div>
                <a className="rider-call-button" href={`tel:${phoneLink}`}>
                  <Phone size={18} aria-hidden="true" />
                  Call {order.phone}
                </a>
              </section>

              {order.delivery_attempt_note && (
                <section className="rider-attempt-note" role="status">
                  <strong>{order.delivery_attempt_note}</strong>
                  {order.expected_delivery_date && <span>New delivery date: {displayDate(order.expected_delivery_date)}</span>}
                </section>
              )}
            </div>

            {order.status === 'shipped' ? (
              <section className="rider-actions" aria-label="Update delivery status">
                <button type="button" className="rider-delivered-button" disabled={busy} onClick={() => void applyUpdate('delivered')}>
                  <CheckCircle2 size={19} aria-hidden="true" />
                  {busy ? 'Updating…' : 'Mark Order Delivered'}
                </button>

              <form className="rider-reschedule-form" onSubmit={onExtend}>
                <h2><CalendarClock size={18} aria-hidden="true" /> Delivery attempt failed</h2>
                <p>Record the failed attempt and set the next delivery date. The order remains shipped.</p>
                <label>
                  <span>Extended delivery date</span>
                  <input type="date" min={tomorrowDate()} required value={newDate} onChange={(event) => setNewDate(event.target.value)} />
                </label>
                <label>
                  <span>Attempt note (optional)</span>
                  <textarea rows={2} maxLength={500} value={attemptNote} onChange={(event) => setAttemptNote(event.target.value)} placeholder="For example, customer unavailable" />
                </label>
                <button type="submit" className="rider-reschedule-button" disabled={busy || !newDate}>
                  {busy ? 'Saving…' : 'Record Failed Attempt & Extend Date'}
                </button>
              </form>

                {!showCancelForm ? (
                  <button type="button" className="rider-cancel-button" disabled={busy} onClick={() => setShowCancelForm(true)}>
                    <XCircle size={18} aria-hidden="true" /> Cancel Delivery
                  </button>
                ) : (
                  <form
                    className="rider-cancel-form"
                    onSubmit={onCancel}
                    onReset={() => { setCancelNote(''); setShowCancelForm(false) }}
                  >
                    <label>
                      <span>Cancellation note for admin <b aria-hidden="true">*</b></span>
                      <textarea
                        rows={3}
                        minLength={2}
                        maxLength={500}
                        required
                        value={cancelNote}
                        onChange={(event) => setCancelNote(event.target.value)}
                        placeholder="Explain why this delivery is being cancelled"
                      />
                    </label>
                    <div className="rider-cancel-form-actions">
                      <button type="reset" className="rider-cancel-back-button" disabled={busy}>Keep Delivery</button>
                      <button type="submit" className="rider-cancel-confirm-button" disabled={busy || cancelNote.trim().length < 2}>
                        {busy ? 'Cancelling…' : 'Confirm Cancellation'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : (
              <section className={`rider-finished rider-finished-${order.status}`} role="status">
                <strong>{order.status === 'delivered' ? 'Order marked as delivered.' : 'Delivery cancelled.'}</strong>
                {order.cancel_reason && <span>{order.cancel_reason}</span>}
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  )
}