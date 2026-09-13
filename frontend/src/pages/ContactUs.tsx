import { useState, type FormEvent } from 'react'
import { sendContactMessage } from '../api/contact'
import { buildWhatsAppLink } from '../utils/whatsapp'
import './ContactUs.css'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [status, setStatus] = useState<Status>('idle')

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      await sendContactMessage(form)
      setStatus('sent')
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="container contact-page">
      <div className="section-heading">
        <span className="eyebrow">Get In Touch</span>
        <h1 className="section-title">Contact Us</h1>
        <p className="section-subtitle">Our concierge usually replies within the same day.</p>
      </div>

      <div className="contact-grid">
        <div className="contact-details">
          <div className="contact-detail-item">
            <h3>Visit Us</h3>
            <p>Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328, Manama, Kingdom of Bahrain</p>
          </div>
          <div className="contact-detail-item">
            <h3>WhatsApp</h3>
            <a href={buildWhatsAppLink('Hello! I have an inquiry regarding Moksha Collections.')} target="_blank" rel="noreferrer">
              +973 3552 1619
            </a>
          </div>
          <div className="contact-detail-item">
            <h3>Follow Along</h3>
            <div className="contact-socials">
              <a href="https://www.instagram.com/_moksha_collections_?igsh=enN3ZHBnZ2xlNXl3" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.facebook.com/share/1BGpC8tNvM/" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://www.tiktok.com/@moksha.collections" target="_blank" rel="noreferrer">TikTok</a>
            </div>
          </div>
        </div>

        <form className="contact-form" onSubmit={onSubmit}>
          <div className="contact-form-row">
            <label>
              <span>Name</span>
              <input required value={form.name} onChange={update('name')} placeholder="Your name" />
            </label>
            <label>
              <span>Email</span>
              <input required type="email" value={form.email} onChange={update('email')} placeholder="you@email.com" />
            </label>
          </div>
          <div className="contact-form-row">
            <label>
              <span>Phone</span>
              <input value={form.phone} onChange={update('phone')} placeholder="Optional" />
            </label>
            <label>
              <span>Subject</span>
              <input value={form.subject} onChange={update('subject')} placeholder="How can we help?" />
            </label>
          </div>
          <label>
            <span>Message</span>
            <textarea required rows={5} value={form.message} onChange={update('message')} placeholder="Tell us more..." />
          </label>

          <button className="btn btn-primary" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>

          {status === 'sent' && <p className="contact-form-status is-success">Thank you — we'll be in touch shortly.</p>}
          {status === 'error' && <p className="contact-form-status is-error">Something went wrong. Please try WhatsApp instead.</p>}
        </form>
      </div>
    </div>
  )
}
