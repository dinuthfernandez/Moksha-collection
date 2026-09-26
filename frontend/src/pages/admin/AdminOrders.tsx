import { useEffect, useState } from 'react'
import { getAdminOrders, updateOrderStatus } from '../../api/admin'
import type { OrderDetail, OrderStatus } from '../../types'
import './AdminOrders.css'

const SECTIONS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => getAdminOrders().then(setOrders)

  useEffect(() => {
    load()
  }, [])

  const changeStatus = async (order: OrderDetail, status: OrderStatus) => {
    if (status === 'cancelled') {
      const reason = window.prompt('Reason for cancelling this order (shown to the customer):') ?? ''
      if (reason === null) return
      setBusyId(order.id)
      try {
        await updateOrderStatus(order.id, status, reason)
        await load()
      } finally {
        setBusyId(null)
      }
      return
    }
    setBusyId(order.id)
    try {
      await updateOrderStatus(order.id, status)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-orders">
      <div className="section-heading">
        <span className="eyebrow">Fulfilment</span>
        <h1 className="section-title">Orders</h1>
      </div>

      {SECTIONS.map(({ key, label }) => {
        const list = orders.filter((o) => o.status === key)
        return (
          <div className="admin-orders-section" key={key}>
            <h2>
              {label} <span className="admin-orders-count">{list.length}</span>
            </h2>
            {list.length === 0 && <p className="admin-orders-empty">No {label.toLowerCase()} orders.</p>}
            <div className="admin-order-grid">
              {list.map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <header>
                    <span className="admin-order-id">#{order.id.slice(0, 8)}</span>
                    <span className={`admin-order-badge status-${order.status}`}>{order.status}</span>
                  </header>
                  <p className="admin-order-customer">{order.customer_name} · {order.phone}</p>
                  {order.email && <p className="admin-order-meta">{order.email}</p>}
                  {(order.address || order.city) && (
                    <p className="admin-order-meta">{[order.address, order.city].filter(Boolean).join(', ')}</p>
                  )}
                  {order.delivery_type && (
                    <p className="admin-order-meta">Delivery: {order.delivery_type} ({order.delivery_charge.toFixed(3)} BHD)</p>
                  )}
                  {Number(order.discount_amount ?? 0) > 0 && (
                    <p className="admin-order-meta admin-order-discount">
                      Coupon{order.coupon_name ? `: ${order.coupon_name}` : ''} ({order.coupon_percentage ?? 0}%): −{Number(order.discount_amount).toFixed(3)} BHD
                    </p>
                  )}
                  {order.return_status !== 'none' && (
                    <p className="admin-order-return">Return {order.return_status}</p>
                  )}
                  <ul className="admin-order-items">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.product_name ?? 'Item'} × {item.quantity} — {(item.price * item.quantity).toFixed(3)} BHD
                      </li>
                    ))}
                  </ul>
                  <div className="admin-order-total">
                    Total <strong>{order.total_amount.toFixed(3)} BHD</strong>
                  </div>
                  {order.cancel_reason && <p className="admin-order-cancel-reason">Cancel reason: {order.cancel_reason}</p>}
                  <div className="admin-order-actions">
                    {order.status === 'pending' && (
                      <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => changeStatus(order, 'accepted')}>
                        Accept
                      </button>
                    )}
                    {order.status === 'accepted' && (
                      <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => changeStatus(order, 'delivered')}>
                        Mark Delivered
                      </button>
                    )}
                    {(order.status === 'pending' || order.status === 'accepted') && (
                      <button className="btn btn-outline" disabled={busyId === order.id} onClick={() => changeStatus(order, 'cancelled')}>
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
