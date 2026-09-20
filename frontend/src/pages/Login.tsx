import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import PasswordInput from '../components/ui/PasswordInput'
import './AuthForm.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(form)
      navigate(location.state?.from || '/account')
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
          <span className="eyebrow">Welcome Back</span>
          <h1 className="section-title">Sign In</h1>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@email.com"
            />
          </label>
          <label>
            <span>Password</span>
            <PasswordInput
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="auth-switch">
          New to Moksha Collections? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
