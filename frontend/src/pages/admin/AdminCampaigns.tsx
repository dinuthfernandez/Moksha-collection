import { useEffect, useState } from 'react'
import { getCampaigns, sendCampaign, sendCampaignTest } from '../../api/admin'
import type { CampaignSender } from '../../api/admin'
import type { Campaign } from '../../types'
import './AdminCampaigns.css'

const TEST_EMAIL = 'fdodinuth@gmail.com'

export default function AdminCampaigns() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sender, setSender] = useState<CampaignSender>('sales')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [testTo, setTestTo] = useState(TEST_EMAIL)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const load = () => getCampaigns().then(setCampaigns)

  useEffect(() => {
    load()
  }, [])

  const draft = () => ({
    subject: subject.trim(),
    body: body.trim(),
    sender,
    cta_label: ctaLabel.trim() || undefined,
    cta_url: ctaUrl.trim() || undefined,
  })

  const errorText = (err: unknown) =>
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Something went wrong.'

  const onTest = async () => {
    if (!subject.trim() || !body.trim()) return
    setTesting(true)
    setMessage(null)
    try {
      const result = await sendCampaignTest(draft(), testTo.trim())
      setMessage(result.message)
    } catch (err) {
      setMessage(errorText(err))
    } finally {
      setTesting(false)
    }
  }

  const onSend = async () => {
    if (!subject.trim() || !body.trim()) return
    if (!window.confirm(`Send this campaign to ALL customers from ${sender}@mokshacollections.com?`)) return
    setSending(true)
    setMessage(null)
    try {
      const result = await sendCampaign(draft())
      setMessage(`Sent to ${result.recipient_count} customer(s).`)
      setSubject('')
      setBody('')
      setCtaLabel('')
      setCtaUrl('')
      await load()
    } catch (err) {
      setMessage(errorText(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-campaigns">
      <div className="section-heading">
        <span className="eyebrow">Marketing</span>
        <h1 className="section-title">Campaigns</h1>
      </div>

      <div className="admin-panel">
        <h2>Send Email Campaign</h2>
        {message && <div className="admin-flash">{message}</div>}
        <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            <span>Send from</span>
            <select value={sender} onChange={(e) => setSender(e.target.value as CampaignSender)}>
              <option value="sales">sales@mokshacollections.com</option>
              <option value="info">info@mokshacollections.com</option>
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New arrivals just landed" />
          </label>
          <label>
            <span>Message (blank line = new paragraph; each customer is greeted by first name)</span>
            <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message to all customers…" />
          </label>
          <label>
            <span>Button text (optional)</span>
            <input type="text" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Shop Now" />
          </label>
          <label>
            <span>Button link (optional, https://…)</span>
            <input type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://mokshacollections.com/products" />
          </label>
          <label>
            <span>Send a test to</span>
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onTest} disabled={testing || sending}>
            {testing ? 'Sending test…' : 'Send Test Email'}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSend} disabled={sending || testing}>
            {sending ? 'Sending…' : 'Send to All Customers'}
          </button>
        </div>
      </div>

      <div className="admin-panel">
        <h2>Campaign History</h2>
        {campaigns.length === 0 && <p className="admin-orders-empty">No campaigns sent yet.</p>}
        <ul className="admin-campaign-history">
          {campaigns.map((c) => (
            <li key={c.id}>
              <strong>{c.subject}</strong>
              <span>{new Date(c.created_at).toLocaleString()} · {c.recipient_count} recipients</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
