import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import BrandLoader from '../ui/BrandLoader'

export default function ProtectedAdminRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth()
  if (isLoading) return <BrandLoader />
  if (!isAuthenticated) return <Navigate to="/mokshacollectionadminpanel/login" replace />
  return <Outlet />
}
