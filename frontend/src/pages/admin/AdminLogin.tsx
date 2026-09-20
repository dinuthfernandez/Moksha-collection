import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { AdminApiError } from '../../api/adminClient'
import PasswordInput from '../../components/ui/PasswordInput'
import '../AuthForm.css'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="section-heading">
          <span className="eyebrow">Restricted Access</span>
          <h1 className="section-title">Admin Sign In</h1>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}
          <label>
            <span>Admin Password</span>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
