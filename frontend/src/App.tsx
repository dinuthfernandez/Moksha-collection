import { Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Home from './pages/Home'
import CategoryLanding from './pages/CategoryLanding'
import CategoryDetail from './pages/CategoryDetail'
import SizeCharts from './pages/SizeCharts'
import AboutUs from './pages/AboutUs'
import ContactUs from './pages/ContactUs'
import Policies from './pages/Policies'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import Addresses from './pages/Addresses'
import NotFound from './pages/NotFound'
import Wishlist from './pages/Wishlist'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
      <Routes>
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
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<Account />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="wishlist" element={<Wishlist />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  )
}
