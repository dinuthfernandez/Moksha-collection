import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateMyProfile } from '../api/auth'
import { ApiError } from '../api/client'
import { COUNTRIES } from '../data/countries'
import './Account.css'

export default function Account() {
  const { customer, setCustomer, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    phone_country_code: customer?.phone_country_code ?? '+973',
    phone: customer?.phone ?? '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  if (!customer) return null

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    try {
      const updated = await updateMyProfile(form)
      setCustomer(updated)
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      void err
    }
  }

  const onLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="container account-page">
      <div className="section-heading">
        <span className="eyebrow">My Account</span>
        <h1 className="section-title">
          Hello, {customer.first_name}
        </h1>
      </div>

      <div className="account-grid">
        <form className="account-card" onSubmit={onSubmit}>
          <h3>Contact Information</h3>
          <label>
            <span>Email</span>
            <input value={customer.email} disabled />
          </label>
          <div className="account-form-row">
            <label>
              <span>First name</span>
              <input required value={form.first_name} onChange={update('first_name')} />
            </label>
            <label>
              <span>Last name</span>
              <input required value={form.last_name} onChange={update('last_name')} />
            </label>
          </div>
          <label>
            <span>Phone number</span>
            <div className="phone-field">
              <select value={form.phone_country_code} onChange={update('phone_country_code')} aria-label="Country code">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.dialCode}>
                    {c.dialCode} {c.code}
                  </option>
                ))}
              </select>
              <input required value={form.phone} onChange={update('phone')} />
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save Changes'}
          </button>
          {status === 'saved' && <p className="account-status is-success">Profile updated.</p>}
          {status === 'error' && <p className="account-status is-error">Could not save changes.</p>}
        </form>

        <div className="account-card account-links">
          <h3>Delivery</h3>
          <p>Manage the addresses we'll ship your orders to, anywhere in the world.</p>
          <Link to="/addresses" className="btn btn-outline">
            Manage Delivery Addresses
          </Link>
          <Link to="/wishlist" className="btn btn-outline">
            View Wishlist
          </Link>

          <hr className="account-divider" />

          <button className="btn btn-outline account-logout" type="button" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
