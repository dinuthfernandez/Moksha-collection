import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <Outlet />
}
