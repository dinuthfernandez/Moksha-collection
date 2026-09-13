import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFloatingButton from '../ui/WhatsAppFloatingButton'

// Universal shell used by every route — header/footer are never hardcoded per-page.
export default function Layout() {
  return (
    <>
      <Header />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  )
}
