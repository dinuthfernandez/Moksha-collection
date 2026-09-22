import { NavLink, Link } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X, ShoppingBag, User, Heart } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useWishlist } from '../../context/WishlistContext'
import AnnouncementBar from './AnnouncementBar'
import ThemeToggle from '../ui/ThemeToggle'
import './Header.css'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Clothing', to: '/clothing' },
  { label: 'Accessories', to: '/accessories' },
  { label: 'Categories', to: '/categories' },
  { label: 'Size Charts', to: '/size-charts' },
  { label: 'About Us', to: '/about-us' },
  { label: 'Contact Us', to: '/contact-us' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { itemCount } = useCart()
  const { isAuthenticated, customer } = useAuth()
  const { itemCount: wishlistCount } = useWishlist()

  return (
    <>
      <header className="site-header">
        <AnnouncementBar />
        <div className="site-header-bar container">
          <button
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="site-logo" onClick={() => setMenuOpen(false)}>
            <img src="/assets/logo/logo.png" alt="Moksha Collections" />
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => 'site-nav-link' + (isActive ? ' is-active' : '')}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header-actions">
            <ThemeToggle className="header-theme-toggle" />
            <Link to={isAuthenticated ? '/wishlist' : '/login'} className="wishlist-link" aria-label="Wishlist">
              <Heart size={20} />
              {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
            </Link>
            <Link to={isAuthenticated ? '/account' : '/login'} className="account-link" aria-label="Account">
              <User size={20} />
              {isAuthenticated && <span className="account-link-name">{customer?.first_name}</span>}
            </Link>
            <Link to="/cart" className="cart-link" aria-label="Cart">
              <ShoppingBag size={20} />
              {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            </Link>
          </div>
        </div>

        <div className={`mobile-nav ${menuOpen ? 'is-open' : ''}`}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' is-active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </header>
    </>
  )
}
