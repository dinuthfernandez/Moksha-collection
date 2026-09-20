import { Outlet, Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import AdminBottomNav from './AdminBottomNav'
import './AdminLayout.css'

export default function AdminLayout() {
  const { logout } = useAdminAuth()

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link to="/admin/dashboard" className="admin-topbar-brand">
          Moksha Admin
        </Link>
        <button type="button" className="admin-logout" onClick={logout}>
          <LogOut size={16} /> Log out
        </button>
      </header>
      <main className="admin-content">
        <Outlet />
      </main>
      <AdminBottomNav />
    </div>
  )
}
