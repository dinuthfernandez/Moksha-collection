import { Routes, Route } from 'react-router-dom'
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
import Home from './pages/Home'
import CategoryLanding from './pages/CategoryLanding'
import CategoryDetail from './pages/CategoryDetail'
import ProductDetail from './pages/ProductDetail'
import SizeCharts from './pages/SizeCharts'
import AboutUs from './pages/AboutUs'
import ContactUs from './pages/ContactUs'
import Policies from './pages/Policies'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Account from './pages/Account'
import Addresses from './pages/Addresses'
import NotFound from './pages/NotFound'
import Wishlist from './pages/Wishlist'
import OrderConfirmation from './pages/OrderConfirmation'
import Payment from './pages/Payment'
import Orders from './pages/Orders'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminReturns from './pages/admin/AdminReturns'
import AdminCampaigns from './pages/admin/AdminCampaigns'
import AdminCustomers from './pages/admin/AdminCustomers'

export default function App() {
  return (
    <ThemeProvider>
    <AdminAuthProvider>
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
      <ScrollToTop />
      <Routes>
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="returns" element={<AdminReturns />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="customers" element={<AdminCustomers />} />
          </Route>
        </Route>

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="clothing"
            element={
              <CategoryLanding
                type="clothing"
                title="Clothing"
                description="Contemporary dresses and separates, chosen for their cut and finish."
              />
            }
          />
          <Route path="clothing/:slug" element={<CategoryDetail />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route
            path="accessories"
            element={
              <CategoryLanding
                type="accessories"
                title="Accessories"
                description="Considered finishing pieces, from statement jewellery to everyday essentials."
              />
            }
          />
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
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </AdminAuthProvider>
    </ThemeProvider>
  )
}
