import { NavLink, Link } from 'react-router-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, ShoppingBag, User, Heart, Search, ArrowRight } from 'lucide-react'
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchToggleRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { itemCount } = useCart()
  const { isAuthenticated, customer } = useAuth()
  const { itemCount: wishlistCount } = useWishlist()

  useEffect(() => {
    const input = searchInputRef.current
    if (input && input === document.activeElement) input.blur()
    setSearchOpen(false)
  }, [location.pathname])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchTerm.trim()
    if (!query) {
      searchInputRef.current?.focus()
      return
    }
    setMenuOpen(false)
    searchInputRef.current?.blur()
    setSearchOpen(false)
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  const toggleSearch = () => {
    if (searchOpen) {
      searchInputRef.current?.blur()
      setSearchOpen(false)
      searchToggleRef.current?.focus()
      return
    }
    setMenuOpen(false)
    setSearchOpen(true)
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }

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
            <button
              type="button"
              className={`header-search-toggle ${searchOpen ? 'is-active' : ''}`}
              ref={searchToggleRef}
              aria-label={searchOpen ? 'Close search' : 'Search products'}
              aria-expanded={searchOpen}
              onClick={toggleSearch}
              onMouseDown={(event) => event.preventDefault()}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
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

        <div className={`header-search-panel ${searchOpen ? 'is-open' : ''}`} aria-hidden={!searchOpen}>
          <form className="header-search-form" onSubmit={submitSearch}>
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false)
                  searchToggleRef.current?.focus()
                }
              }}
              placeholder="Search products or product code"
              aria-label="Search products or product code"
              tabIndex={searchOpen ? 0 : -1}
            />
            <button type="submit" aria-label="Show search results" tabIndex={searchOpen ? 0 : -1}>
              <ArrowRight size={18} />
            </button>
          </form>
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
