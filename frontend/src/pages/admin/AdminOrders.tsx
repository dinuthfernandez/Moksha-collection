import { useEffect, useState } from 'react'
import { CalendarDays, Share2 } from 'lucide-react'
import { createRiderDeliveryLink, getAdminOrders, updateOrderStatus } from '../../api/admin'
import type { OrderDetail, OrderStatus } from '../../types'
import './AdminOrders.css'

type OrderSection = OrderStatus | 'customer-cancelled'

const SECTIONS: { key: OrderSection; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'customer-cancelled', label: 'Customer Cancelled Orders' },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [shareBusyId, setShareBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => getAdminOrders().then(setOrders)

  useEffect(() => {
    load()
  }, [])

  const changeStatus = async (order: OrderDetail, status: OrderStatus) => {
    if (status === 'cancelled') {
      const reason = window.prompt('Reason for cancelling this order (shown to the customer):')
      if (reason === null) return
      setBusyId(order.id)
      try {
        await updateOrderStatus(order.id, status, reason)
        await load()
      } catch {
        setMessage('Could not update this order. Refresh and try again.')
      } finally {
        setBusyId(null)
      }
      return
    }
    setBusyId(order.id)
    try {
      await updateOrderStatus(order.id, status)
      await load()
    } catch {
      setMessage('Could not update this order. Refresh and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const shareRiderLink = async (order: OrderDetail) => {
    setShareBusyId(order.id)
    setMessage(null)
    try {
      const { token } = await createRiderDeliveryLink(order.id)
      const url = `${window.location.origin}/delivery/${token}`
      if (navigator.share) {
        await navigator.share({ title: `Delivery for order #${order.id.slice(0, 8)}`, url })
        setMessage('Rider link shared.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setMessage('Rider link copied to clipboard.')
      } else {
        window.prompt('Copy this private rider link:', url)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setMessage('Could not create or share the rider link. Try again.')
    } finally {
      setShareBusyId(null)
    }
  }

  return (
    <div className="admin-orders">
      <div className="section-heading">
        <span className="eyebrow">Fulfilment</span>
        <h1 className="section-title">Orders</h1>
      </div>

      {message && <p className="admin-orders-message" role="status">{message}</p>}

      {SECTIONS.map(({ key, label }) => {
        const list = orders.filter((order) =>
          key === 'customer-cancelled'
            ? order.status === 'cancelled' && order.cancelled_by === 'customer'
            : key === 'cancelled'
              ? order.status === 'cancelled' && order.cancelled_by !== 'customer'
              : order.status === key,
        )
        return (
          <div className="admin-orders-section" key={key}>
            <h2>
              {label} <span className="admin-orders-count">{list.length}</span>
            </h2>
            {list.length === 0 && (
              <p className="admin-orders-empty">
                {key === 'customer-cancelled' ? 'No customer-cancelled orders.' : `No ${label.toLowerCase()} orders.`}
              </p>
            )}
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
                  {order.cancel_reason && (
                    <div className="admin-order-cancel-reason">
                      <strong>
                        {order.cancelled_by === 'rider'
                          ? 'Rider cancellation note'
                          : order.cancelled_by === 'customer'
                            ? 'Customer cancellation note'
                            : 'Cancellation reason'}
                      </strong>
                      <p>{order.cancel_reason}</p>
                    </div>
                  )}
                  {order.delivery_attempt_note && (
                    <section className="admin-order-delivery-update" aria-label="Delivery attempt update">
                      <strong>Delivery attempt</strong>
                      <p>{order.delivery_attempt_note}</p>
                      {order.expected_delivery_date && (
                        <div className="admin-order-extended-date">
                          <CalendarDays size={15} aria-hidden="true" />
                          <span>Extended delivery date</span>
                          <strong>{new Date(`${order.expected_delivery_date}T12:00:00`).toLocaleDateString()}</strong>
                        </div>
                      )}
                      {order.delivery_attempt_at && (
                        <time dateTime={order.delivery_attempt_at}>
                          Attempt recorded {new Date(order.delivery_attempt_at).toLocaleString()}
                        </time>
                      )}
                    </section>
                  )}
                  <div className="admin-order-actions">
                    {order.status === 'pending' && (
                      <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => changeStatus(order, 'accepted')}>
                        Accept
                      </button>
                    )}
                    {order.status === 'accepted' && (
                      <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => changeStatus(order, 'shipped')}>
                        Mark Shipped
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <>
                        <button className="btn btn-primary admin-share-rider-link" disabled={shareBusyId === order.id} onClick={() => shareRiderLink(order)}>
                          <Share2 size={16} aria-hidden="true" />
                          {shareBusyId === order.id ? 'Preparing…' : 'Share Rider Link'}
                        </button>
                        <button className="btn btn-outline" disabled={busyId === order.id} onClick={() => changeStatus(order, 'delivered')}>
                          Mark Delivered
                        </button>
                      </>
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
