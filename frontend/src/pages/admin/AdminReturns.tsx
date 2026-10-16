import { useEffect, useState } from 'react'
import { completeItemReturn, completeReturn, createReturnRiderLink, getReturns } from '../../api/admin'
import type { ReturnOrder } from '../../types'
import { withVariant } from '../../utils/variant'
import '../admin/AdminOrders.css'
import './AdminReturns.css'

export default function AdminReturns() {
  const [orders, setOrders] = useState<ReturnOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [view, setView] = useState<'requested' | 'completed'>('requested')
  const isHistory = view === 'completed'

  const load = () => getReturns(view).then(setOrders)

  useEffect(() => {
    setOrders([])
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const run = async (busyKey: string, action: () => Promise<unknown>, failure: string) => {
    setBusyId(busyKey)
    setMessage(null)
    try {
      await action()
      await load()
    } catch {
      setMessage(failure)
    } finally {
      setBusyId(null)
    }
  }

  const onComplete = (orderId: string) =>
    run(orderId, () => completeReturn(orderId), 'Could not complete this return. Refresh and try again.')

  const onCompleteItem = (orderId: string, itemId: string) =>
    run(itemId, () => completeItemReturn(orderId, itemId), 'Could not complete this item return. Refresh and try again.')

  const onShareLink = async (orderId: string) => {
    setBusyId(`link-${orderId}`)
    setMessage(null)
    try {
      const { token } = await createReturnRiderLink(orderId)
      const url = `${window.location.origin}/delivery/return/${token}`
      if (navigator.share) {
        await navigator.share({ title: `Return pickup for order #${orderId.slice(0, 8)}`, url })
        setMessage('Return rider link shared.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setMessage('Return rider link copied to clipboard.')
      } else {
        window.prompt('Copy this private return rider link:', url)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setMessage('Could not create or share the return rider link. Try again.')
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

      <div className="admin-order-actions" style={{ marginBottom: '1rem' }}>
        <button className={`btn ${!isHistory ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('requested')}>
          Pending
        </button>
        <button className={`btn ${isHistory ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('completed')}>
          Completed
        </button>
      </div>

      {orders.length === 0 && (
        <p className="admin-orders-empty">{isHistory ? 'No completed returns yet.' : 'No pending return requests.'}</p>
      )}

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
                <span className={`admin-order-badge ${isHistory ? 'status-delivered' : 'status-pending'}`}>
                  {isHistory ? 'return completed' : 'return requested'}
                </span>
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
              <ul className="admin-order-items admin-return-items">
                {order.items.map((item) => {
                  const state = item.return_status ?? 'none'
                  return (
                    <li key={item.id} className={`admin-return-item is-${state}`}>
                      <span>
                        {withVariant(item.product_name ?? 'Item', item)}{item.product_code ? ` [${item.product_code}]` : ''} × {item.quantity} — {(item.price * item.quantity).toFixed(3)} BHD
                      </span>
                      {state === 'requested' && (
                        <>
                          <span className="admin-return-tag tag-requested">Return requested</span>
                          <button
                            className="btn btn-outline admin-return-item-btn"
                            disabled={busyId === item.id}
                            onClick={() => onCompleteItem(order.id, item.id)}
                          >
                            {busyId === item.id ? 'Completing…' : 'Mark returned'}
                          </button>
                        </>
                      )}
                      {state === 'completed' && <span className="admin-return-tag tag-completed">Returned &amp; restocked</span>}
                      {state === 'none' && <span className="admin-return-tag tag-kept">Kept by customer</span>}
                    </li>
                  )
                })}
              </ul>
              <div className="admin-order-total">
                Order Value <strong>{order.total_amount.toFixed(3)} BHD</strong>
              </div>
              {!isHistory && <div className="admin-order-actions">
                <button className="btn btn-outline" disabled={busyId === `link-${order.id}`} onClick={() => onShareLink(order.id)}>
                  {busyId === `link-${order.id}` ? 'Creating link…' : 'Share Return Rider Link'}
                </button>
                <button className="btn btn-primary" disabled={busyId === order.id} onClick={() => onComplete(order.id)}>
                  {busyId === order.id ? 'Completing…' : 'Return Complete (all pending)'}
                </button>
              </div>}
              {message && <p className="admin-orders-message" role="status">{message}</p>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
