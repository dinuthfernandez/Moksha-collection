import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PackageSearch, Undo2, Megaphone, Users } from 'lucide-react'
import './AdminBottomNav.css'

const LINKS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Orders', to: '/admin/orders', icon: PackageSearch },
  { label: 'Returns', to: '/admin/returns', icon: Undo2 },
  { label: 'Campaigns', to: '/admin/campaigns', icon: Megaphone },
  { label: 'Customers', to: '/admin/customers', icon: Users },
]

export default function AdminBottomNav() {
  return (
    <nav className="admin-dock" aria-label="Admin navigation">
      {LINKS.map(({ label, to, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => 'admin-dock-link' + (isActive ? ' is-active' : '')}>
          <Icon size={18} strokeWidth={1.6} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
