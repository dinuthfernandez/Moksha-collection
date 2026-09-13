import { Link } from 'react-router-dom'
import './NotFound.css'

export default function NotFound() {
  return (
    <div className="container not-found-page">
      <span className="eyebrow">404</span>
      <h1 className="section-title">Page Not Found</h1>
      <p className="section-subtitle">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn btn-primary">
        Back to Home
      </Link>
    </div>
  )
}
