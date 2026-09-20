import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import { ApiError } from '../api/client'
import './AuthForm.css'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword(email)
      navigate('/reset-password', { state: { email } })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? 'No account was found with this email address.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="section-heading">
          <span className="eyebrow">Account Recovery</span>
          <h1 className="section-title">Forgot Password</h1>
          <p className="section-subtitle">Enter the email linked to your account and we'll send you a reset code.</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Reset Code'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/login">Back to Sign In</Link>
        </p>
      </div>
    </div>
  )
}
