import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { getPublicSettings } from '../api/settings'
import { buildWhatsAppLink } from '../utils/whatsapp'
import type { OrderCreateResult, PublicSettings } from '../types'
import './Payment.css'

const SWIFT_CODE = 'BBKUBHBMHTN'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button type="button" className="payment-copy-btn" onClick={copy} aria-label={`Copy ${label}`}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

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
          <span>Items subtotal</span>
          <strong>{order.subtotal_amount.toFixed(3)} BHD</strong>
        </div>
        {order.discount_amount > 0 && (
          <div className="payment-row payment-discount-row">
            <span>{order.coupon_name ? `${order.coupon_name} discount` : 'Coupon discount'}</span>
            <strong>−{order.discount_amount.toFixed(3)} BHD</strong>
          </div>
        )}
        <div className="payment-row">
          <span>Delivery{order.delivery_charge === 0 ? ' · Free delivery applied' : ''}</span>
          <strong>{order.delivery_charge.toFixed(3)} BHD</strong>
        </div>
        <div className="payment-row payment-grand-total">
          <span>Total Amount</span>
          <strong>{order.total_amount.toFixed(3)} BHD</strong>
        </div>
        <div className="payment-row">
          <span>IBAN Number</span>
          <span className="payment-copy-value">
            <strong>{settings?.iban_number || 'Not set — please contact us'}</strong>
            {settings?.iban_number && <CopyButton value={settings.iban_number} label="IBAN" />}
          </span>
        </div>
        <div className="payment-row">
          <span>SWIFT/BIC Code</span>
          <span className="payment-copy-value">
            <strong>{SWIFT_CODE}</strong>
            <CopyButton value={SWIFT_CODE} label="SWIFT/BIC code" />
          </span>
        </div>

        <div className="payment-qr">
          <img src="/assets/payment/qr.png" alt="Payment QR code" width={132} height={132} />
          <span>Scan to pay</span>
        </div>

        <p className="payment-instructions">
          Please transfer the total amount to the IBAN above or scan the QR code, then send us your payment receipt on
          WhatsApp with your order ID and amount already filled in below.
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
