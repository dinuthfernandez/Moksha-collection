import { useEffect, useState } from 'react'
import { getMyOrders, requestOrderReturn } from '../api/orders'
import { ApiError } from '../api/client'
import type { OrderDetail } from '../types'
import './Orders.css'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => getMyOrders().then(setOrders).finally(() => setIsLoading(false))

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
                  <div>
                    <span>{item.product_name ?? 'Item'} × {item.quantity}</span>
                    <strong>{(item.price * item.quantity).toFixed(3)} BHD</strong>
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
