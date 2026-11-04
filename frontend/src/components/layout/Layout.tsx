import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFloatingButton from '../ui/WhatsAppFloatingButton'
import BackButton from '../ui/BackButton'
import WebsiteVisitTracker from '../analytics/WebsiteVisitTracker'

// Universal shell used by every route — header/footer are never hardcoded per-page.
export default function Layout() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <>
      <WebsiteVisitTracker />
      <Header />
      <main className={`page${isHome ? ' home-page' : ''}`}>
        {!isHome && <BackButton fallbackTo="/" fixedBelowHeader />}
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  )
}
