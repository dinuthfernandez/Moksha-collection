import { useEffect, useState } from 'react'
import { completeReturn, getReturns } from '../../api/admin'
import type { ReturnOrder } from '../../types'
import '../admin/AdminOrders.css'
import './AdminReturns.css'

export default function AdminReturns() {
  const [orders, setOrders] = useState<ReturnOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => getReturns().then(setOrders)

  useEffect(() => {
    load()
  }, [])

  const onComplete = async (orderId: string) => {
    setBusyId(orderId)
    try {
      await completeReturn(orderId)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-returns">
      <div className="section-heading">
        <span className="eyebrow">Reverse Logistics</span>
        <h1 className="section-title">Return Orders</h1>
      </div>

      {orders.length === 0 && <p className="admin-orders-empty">No pending return requests.</p>}

      <div className="admin-order-grid">
        {orders.map((order) => {
          const fullName =
            [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || order.customer_name
          const accountPhone = order.customer_account_phone
            ? `${order.customer_account_phone_country_code ?? ''}${order.customer_account_phone}`
            : null

          return (
            <article className="admin-order-card" key={order.id}>
              <header>
                <span className="admin-order-id">#{order.id.slice(0, 8)}</span>
                <span className="admin-order-badge status-pending">return requested</span>
              </header>

              <div className="admin-return-customer">
                <h3>Customer Details</h3>
                <p><strong>Name:</strong> {fullName}</p>
                {order.customer_account_email && <p><strong>Email:</strong> {order.customer_account_email}</p>}
                <p><strong>Order Contact:</strong> {order.phone}</p>
                {accountPhone && accountPhone !== order.phone && (
                  <p><strong>Account Phone:</strong> {accountPhone}</p>
                )}
                {(order.address || order.city) && (
                  <p><strong>Delivery Address:</strong> {[order.address, order.city].filter(Boolean).join(', ')}</p>
                )}
              </div>

              <h3>Order Items</h3>
              <ul className="admin-order-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.product_name ?? 'Item'} × {item.quantity} — {(item.price * item.quantity).toFixed(3)} BHD
                  </li>
                ))}
              </ul>
              <div className="admin-order-total">
                Order Value <strong>{order.total_amount.toFixed(3)} BHD</strong>
              </div>
              <div className="admin-order-actions">
                <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => onComplete(order.id)}>
                  {busyId === order.id ? 'Completing…' : 'Return Complete'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
