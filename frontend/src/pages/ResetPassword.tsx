import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import PasswordInput from '../components/ui/PasswordInput'
import './AuthForm.css'

export default function ResetPassword() {
  const location = useLocation() as { state?: { email?: string } }
  const navigate = useNavigate()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(email, code, newPassword)
      navigate('/login')
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
          <span className="eyebrow">Account Recovery</span>
          <h1 className="section-title">Enter Reset Code</h1>
          <p className="section-subtitle">Check your email for the 6-digit code, then choose a new password.</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}
          <label>
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </label>
          <label>
            <span>6-Digit Code</span>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </label>
          <label>
            <span>New Password</span>
            <PasswordInput required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <label>
            <span>Confirm New Password</span>
            <PasswordInput required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/forgot-password">Request a new code</Link>
        </p>
      </div>
    </div>
  )
}
