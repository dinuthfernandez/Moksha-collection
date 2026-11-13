import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFloatingButton from '../ui/WhatsAppFloatingButton'
import BackButton from '../ui/BackButton'
import WebsiteVisitTracker from '../analytics/WebsiteVisitTracker'
import { isImpersonation, setAuthToken } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

// Universal shell used by every route — header/footer are never hardcoded per-page.
export default function Layout() {
  const { pathname } = useLocation()
  const { customer } = useAuth()
  const isHome = pathname === '/'

  return (
    <>
      {isImpersonation && (
        <div style={{ background: '#8f1444', color: '#fff', padding: '10px', textAlign: 'center', position: 'relative', zIndex: 10000 }}>
          Super admin customer session{customer ? `: ${customer.first_name} ${customer.last_name}` : ''} — actions affect this customer.
          {' '}<button type="button" onClick={() => { setAuthToken(null); window.close(); window.location.replace('/login') }}>End session</button>
        </div>
      )}
      <WebsiteVisitTracker />
      <Header />
      <main className={`page${isHome ? ' home-page' : ''}`}>
        {!isHome && <BackButton fallbackTo="/" fixedBelowHeader />}
        <Outlet />
      </main>
      <Footer showHouseLogos />
      <WhatsAppFloatingButton />
    </>
  )
}
