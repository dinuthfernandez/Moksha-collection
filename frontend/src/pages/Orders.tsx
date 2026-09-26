import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { getMyOrders, requestOrderReturn } from '../api/orders'
import { getMyReviewedOrderItems, submitProductReview } from '../api/reviews'
import { ApiError } from '../api/client'
import type { OrderDetail, OrderItemDetail } from '../types'
import './Orders.css'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

interface ReviewComposerProps {
  item: OrderItemDetail
  onSubmitted: (orderItemId: string) => void
}

function ReviewComposer({ item, onSubmitted }: ReviewComposerProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating || busy) return
    setBusy(true)
    setError('')
    try {
      await submitProductReview({ order_item_id: item.id, rating, comment: comment.trim() || undefined })
      onSubmitted(item.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-item-review">
      <span className="order-review-label">Rate this item</span>
      <div className="order-review-stars" role="group" aria-label={`Rate ${item.product_name ?? 'item'}`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            className={`review-star-button ${value <= rating ? 'is-selected' : ''}`}
            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
            aria-pressed={rating === value}
            onClick={() => setRating(value)}
          >
            <Star size={20} fill={value <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <label className="order-review-comment-label">
        <span>Comment (optional)</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1200} rows={2} placeholder="Share a few thoughts" />
      </label>
      {error && <p className="order-review-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-outline order-review-submit" disabled={!rating || busy} onClick={submit}>
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const [orderData, reviewedIds] = await Promise.all([
        getMyOrders(),
        getMyReviewedOrderItems().catch(() => []),
      ])
      setOrders(orderData)
      setReviewedItemIds(new Set(reviewedIds))
    } catch {
      setError('Could not load your orders. Please refresh and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onReturn = async (orderId: string) => {
    setBusyId(orderId)
    setError(null)
    try {
      await requestOrderReturn(orderId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request a return.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="container orders-page">
      <div className="section-heading">
        <span className="eyebrow">Order History</span>
        <h1 className="section-title">My Orders</h1>
      </div>

      {error && <p className="auth-form-error">{error}</p>}
      {isLoading && <p>Loading your orders…</p>}
      {!isLoading && orders.length === 0 && <p className="orders-empty">You haven't placed any orders yet.</p>}

      <div className="orders-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <header>
              <span className="order-card-id">Order #{order.id.slice(0, 8)}</span>
              <span className={`order-status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
            </header>

            <ul className="order-card-items">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.product_image_url && <img src={item.product_image_url} alt={item.product_name ?? ''} />}
                  <div className="order-item-content">
                    <div className="order-item-summary">
                      <span>{item.product_name ?? 'Item'} × {item.quantity}</span>
                      <strong>{(item.price * item.quantity).toFixed(3)} BHD</strong>
                    </div>
                    {order.status === 'delivered' && item.product_id && (
                      reviewedItemIds.has(item.id) ? (
                        <p className="order-review-complete">Thank you, your review has been received.</p>
                      ) : (
                        <ReviewComposer
                          item={item}
                          onSubmitted={(orderItemId) => setReviewedItemIds((current) => new Set(current).add(orderItemId))}
                        />
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="order-card-total">
              <span>Total</span>
              <strong>{order.total_amount.toFixed(3)} BHD</strong>
            </div>

            {order.status === 'cancelled' && order.cancel_reason && (
              <p className="order-card-cancel-reason">Cancelled: {order.cancel_reason}</p>
            )}

            {order.return_status === 'requested' && <p className="order-card-return-note">Return requested — awaiting pickup.</p>}
            {order.return_status === 'completed' && <p className="order-card-return-note">Return completed.</p>}

            {order.status === 'delivered' && order.return_status === 'none' && (
              <button type="button" className="btn btn-outline" disabled={busyId === order.id} onClick={() => onReturn(order.id)}>
                {busyId === order.id ? 'Requesting…' : 'Return Order'}
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
