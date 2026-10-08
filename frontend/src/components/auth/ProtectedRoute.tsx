import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandLoader from '../ui/BrandLoader'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <BrandLoader fullScreen={false} />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <Outlet />
}
