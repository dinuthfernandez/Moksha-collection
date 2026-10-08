import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import BrandLoader from './components/ui/BrandLoader'
import { useAuth } from './context/AuthContext'
import { getCategories, getProducts } from './api/categories'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AdminAuthProvider } from './context/AdminAuthContext'
import Layout from './components/layout/Layout'
import AdminLayout from './components/layout/AdminLayout'
import ScrollToTop from './components/ui/ScrollToTop'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute'
import BackButton from './components/ui/BackButton'
import Home from './pages/Home'
const Categories = lazy(() => import('./pages/Categories'))
const CategoryLanding = lazy(() => import('./pages/CategoryLanding'))
const Azhak = lazy(() => import('./pages/Azhak'))
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const SizeCharts = lazy(() => import('./pages/SizeCharts'))
const AboutUs = lazy(() => import('./pages/AboutUs'))
const ContactUs = lazy(() => import('./pages/ContactUs'))
const Policies = lazy(() => import('./pages/Policies'))
const Cart = lazy(() => import('./pages/Cart'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Account = lazy(() => import('./pages/Account'))
const Addresses = lazy(() => import('./pages/Addresses'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
const Payment = lazy(() => import('./pages/Payment'))
const Orders = lazy(() => import('./pages/Orders'))
const DeliveryRider = lazy(() => import('./pages/DeliveryRider'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminReturns = lazy(() => import('./pages/admin/AdminReturns'))
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))

function AppShell() {
  const { isLoading: authLoading } = useAuth()
  const [dataReady, setDataReady] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const min = window.setTimeout(() => setMinElapsed(true), 1200)
    const max = window.setTimeout(() => setDataReady(true), 8000)
    Promise.allSettled([
      getCategories('clothing'),
      getCategories('accessories'),
      getProducts('clothing', 1, 24),
      getProducts('accessories', 1, 24),
    ]).then(() => setDataReady(true))
    return () => {
      window.clearTimeout(min)
      window.clearTimeout(max)
    }
  }, [])

  const ready = dataReady && minElapsed && !authLoading
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setSplashDone(true), 450)
    return () => window.clearTimeout(id)
  }, [ready])

  return (
    <>
      {!splashDone && (
        <div className={`splash-wrap${ready ? ' splash-wrap--out' : ''}`}>
          <BrandLoader label="Preparing your collection" />
        </div>
      )}
      <ScrollToTop />
      <Suspense fallback={<BrandLoader label="Loading" />}>
      <Routes>
        <Route path="delivery/:token" element={<DeliveryRider />} />
        <Route path="mokshacollectionadminpanel/login" element={<><BackButton fallbackTo="/" /><AdminLogin /></>} />
        <Route path="mokshacollectionadminpanel" element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="returns" element={<AdminReturns />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>
        </Route>

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="categories" element={<Categories />} />
          <Route
            path="clothing"
            element={
              <CategoryLanding
                type="clothing"
              />
            }
          />
          <Route path="clothing/:slug" element={<CategoryDetail />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="accessories" element={<Azhak />} />
          <Route path="accessories/:slug" element={<CategoryDetail />} />
          <Route path="size-charts" element={<SizeCharts />} />
          <Route path="about-us" element={<AboutUs />} />
          <Route path="contact-us" element={<ContactUs />} />
          <Route path="policies" element={<Policies />} />
          <Route path="cart" element={<Cart />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<Account />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="orders" element={<Orders />} />
            <Route path="checkout" element={<OrderConfirmation />} />
            <Route path="checkout/payment" element={<Payment />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
    <AdminAuthProvider>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
      <AppShell />
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </AdminAuthProvider>
    </ThemeProvider>
  )
}
