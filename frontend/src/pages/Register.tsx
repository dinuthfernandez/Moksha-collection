import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import { COUNTRIES } from '../data/countries'
import './AuthForm.css'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone_country_code: '+973',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const { confirm_password, ...payload } = form
      void confirm_password
      await register(payload)
      navigate('/account')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="section-heading">
          <span className="eyebrow">Join Us</span>
          <h1 className="section-title">Create Your Account</h1>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}

          <div className="auth-form-row">
            <label>
              <span>First name</span>
              <input required value={form.first_name} onChange={update('first_name')} placeholder="First name" />
            </label>
            <label>
              <span>Last name</span>
              <input required value={form.last_name} onChange={update('last_name')} placeholder="Last name" />
            </label>
          </div>

          <label>
            <span>Email</span>
            <input type="email" required value={form.email} onChange={update('email')} placeholder="you@email.com" />
          </label>

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
              <input required value={form.phone} onChange={update('phone')} placeholder="Phone number" />
            </div>
          </label>

          <div className="auth-form-row">
            <label>
              <span>Password</span>
              <input type="password" required value={form.password} onChange={update('password')} placeholder="At least 8 characters" />
            </label>
            <label>
              <span>Confirm password</span>
              <input type="password" required value={form.confirm_password} onChange={update('confirm_password')} placeholder="Re-enter password" />
            </label>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
