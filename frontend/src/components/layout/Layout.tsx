import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFloatingButton from '../ui/WhatsAppFloatingButton'
import BackButton from '../ui/BackButton'

// Universal shell used by every route — header/footer are never hardcoded per-page.
export default function Layout() {
  const { pathname } = useLocation()

  return (
    <>
      <Header />
      <main className="page">
        {pathname !== '/' && <BackButton fallbackTo="/" fixedBelowHeader />}
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  )
}
