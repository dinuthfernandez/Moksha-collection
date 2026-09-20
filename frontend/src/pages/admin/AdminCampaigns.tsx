import { useEffect, useState } from 'react'
import { getCampaigns, sendCampaign } from '../../api/admin'
import type { Campaign } from '../../types'
import './AdminCampaigns.css'

export default function AdminCampaigns() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const load = () => getCampaigns().then(setCampaigns)

  useEffect(() => {
    load()
  }, [])

  const onSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setMessage(null)
    try {
      const result = await sendCampaign(subject, body)
      setMessage(`Sent to ${result.recipient_count} customer(s).`)
      setSubject('')
      setBody('')
      await load()
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
            <span>Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New arrivals just landed" />
          </label>
          <label>
            <span>Body</span>
            <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message to all customers…" />
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={onSend} disabled={sending}>
          {sending ? 'Sending…' : 'Send to All Customers'}
        </button>
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
