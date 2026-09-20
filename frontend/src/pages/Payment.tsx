import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { getPublicSettings } from '../api/settings'
import { buildWhatsAppLink } from '../utils/whatsapp'
import type { OrderCreateResult, PublicSettings } from '../types'
import './Payment.css'

export default function Payment() {
  const location = useLocation() as { state?: { order?: OrderCreateResult } }
  const navigate = useNavigate()
  const [settings, setSettings] = useState<PublicSettings | null>(null)

  const order = location.state?.order ?? (() => {
    const raw = sessionStorage.getItem('moksha-last-order')
    return raw ? (JSON.parse(raw) as OrderCreateResult) : null
  })()

  useEffect(() => {
    getPublicSettings().then(setSettings)
  }, [])

  useEffect(() => {
    if (!order) navigate('/', { replace: true })
  }, [order, navigate])

  if (!order) return null

  const receiptMessage = `Payment receipt for Order #${order.id}\nAmount: ${order.total_amount.toFixed(3)} BHD`
  const whatsappLink = buildWhatsAppLink(receiptMessage, settings?.whatsapp_number || undefined)

  return (
    <div className="container payment-page">
      <div className="section-heading">
        <span className="eyebrow">Step 2 of 2</span>
        <h1 className="section-title">Complete Payment</h1>
      </div>

      <div className="payment-card">
        <div className="payment-row">
          <span>Order ID</span>
          <strong>#{order.id}</strong>
        </div>
        <div className="payment-row">
          <span>Total Amount</span>
          <strong>{order.total_amount.toFixed(3)} BHD</strong>
        </div>
        <div className="payment-row">
          <span>IBAN Number</span>
          <strong>{settings?.iban_number || 'Not set — please contact us'}</strong>
        </div>

        <p className="payment-instructions">
          Please transfer the total amount to the IBAN above, then send us your payment receipt on WhatsApp with your
          order ID and amount already filled in below.
        </p>

        <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn btn-whatsapp payment-whatsapp-btn">
          Send Receipt via WhatsApp
        </a>

        <Link to="/orders" className="btn btn-outline">
          View My Orders
        </Link>
      </div>
    </div>
  )
}
