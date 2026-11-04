import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PackageSearch, Undo2, Megaphone, Users, ChartNoAxesCombined, RefreshCw, Percent, GalleryHorizontal } from 'lucide-react'
import './AdminBottomNav.css'

const ADMIN_BASE = '/mokshacollectionadminpanel'

const LINKS = [
  { label: 'Dashboard', to: `${ADMIN_BASE}/dashboard`, icon: LayoutDashboard },
  { label: 'Orders', to: `${ADMIN_BASE}/orders`, icon: PackageSearch },
  { label: 'Returns', to: `${ADMIN_BASE}/returns`, icon: Undo2 },
  { label: 'Campaigns', to: `${ADMIN_BASE}/campaigns`, icon: Megaphone },
  { label: 'Customers', to: `${ADMIN_BASE}/customers`, icon: Users },
  { label: 'Zoho Sync', to: `${ADMIN_BASE}/zoho-sync`, icon: RefreshCw },
  { label: 'Discounts', to: `${ADMIN_BASE}/discounts`, icon: Percent },
  { label: 'Banner', to: `${ADMIN_BASE}/banners`, icon: GalleryHorizontal },
  { label: 'Analytics', to: `${ADMIN_BASE}/analytics`, icon: ChartNoAxesCombined },
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
