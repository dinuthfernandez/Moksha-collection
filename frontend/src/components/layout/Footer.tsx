import { Link } from 'react-router-dom'
import './Footer.css'

const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://www.facebook.com/share/1BGpC8tNvM/', icon: '/assets/icons/svg/icons8-facebook-50.svg' },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/_moksha_collections_?igsh=enN3ZHBnZ2xlNXl3',
    icon: '/assets/icons/svg/icons8-instagram-50.svg',
  },
  { label: 'WhatsApp', href: 'https://wa.me/97335521619', icon: '/assets/icons/svg/icons8-whatsapp-50.svg' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@moksha.collections', icon: '/assets/icons/svg/icons8-tiktok.svg' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="footer-main container">
        <div className="footer-col footer-brand">
          <Link to="/">
            <img src="/assets/logo/logo.png" alt="Moksha Collections" className="footer-logo" />
          </Link>
        </div>

        <div className="footer-col">
          <h3>Shop</h3>
          <ul>
            <li><Link to="/clothing">Clothing</Link></li>
            <li><Link to="/accessories">Accessories</Link></li>
            <li><Link to="/size-charts">Size Charts</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Quick Links</h3>
          <ul>
            <li><Link to="/about-us">About Us</Link></li>
            <li><Link to="/contact-us">Contact Us</Link></li>
            <li><Link to="/policies">Policies</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Follow Us</h3>
          <div className="social-icons">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="social-icon">
                <img src={s.icon} alt={s.label} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <hr className="footer-divider" />

      <div className="footer-trust container">
        <div className="trust-block">
          <span>Payment methods</span>
          <div className="trust-icon-box">
            <svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="1" width="32" height="22" rx="3" stroke="#FAF7F2" strokeWidth="1.5" />
              <path d="M1 8H33" stroke="#FAF7F2" strokeWidth="1.5" />
              <rect x="5" y="14" width="8" height="3" rx="1" fill="#FAF7F2" />
            </svg>
            <span className="trust-icon-label">Bank Transfer</span>
          </div>
        </div>
        <div className="trust-block">
          <span>Delivery partner</span>
          <div className="trust-icon-box trust-icon-box-white">
            <img src="/assets/icons/png/aramex.png" alt="Aramex" className="aramex-icon" />
          </div>
        </div>
      </div>

      <hr className="footer-divider" />

      <div className="footer-bottom">
        <p>&copy; {year} Moksha Collections. All rights reserved.</p>
      </div>
    </footer>
  )
}
