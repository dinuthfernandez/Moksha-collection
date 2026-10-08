import BrandLoader from '../components/ui/BrandLoader'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingBag, Trash2 } from 'lucide-react'
import { useWishlist } from '../context/WishlistContext'
import { useCart } from '../context/CartContext'
import { formatVariant, withVariant } from '../utils/variant'
import './Wishlist.css'

export default function Wishlist() {
  const { items, isLoading, remove } = useWishlist()
  const { addItem } = useCart()
  const [cartMessage, setCartMessage] = useState<string | null>(null)

  const handleAddToCart = async (item: (typeof items)[number]) => {
    const reserved = await addItem({
      id: item.product_id,
      name: item.product_name,
      image_url: item.image_url ?? undefined,
      price: item.price ?? 0,
      size: item.size ?? undefined,
      color: item.color ?? undefined,
      quantity: 1,
    })
    setCartMessage(reserved ? `${withVariant(item.product_name, item)} reserved in your cart for 24 hours.` : 'Could not reserve stock. Please try again.')
  }

  return (
    <div className="container wishlist-page">
      <div className="section-heading">
        <span className="eyebrow">Your Edit</span>
        <h1 className="section-title">Wishlist</h1>
        <p className="section-subtitle">Keep the pieces you love close until you are ready.</p>
      </div>
      {cartMessage && <p role="status">{cartMessage}</p>}

      {isLoading && <BrandLoader fullScreen={false} label="Loading your wishlist" />}
      {!isLoading && items.length === 0 && (
        <div className="wishlist-empty">
          <Heart size={34} strokeWidth={1.2} />
          <h2>Your wishlist is waiting</h2>
          <p>Save pieces while you browse and they will appear here.</p>
          <Link to="/clothing" className="btn btn-primary">Explore Clothing</Link>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="wishlist-grid">
          {items.map((item) => (
            <article className="wishlist-card" key={item.id}>
              <Link to={item.product_slug ? `/product/${item.product_slug}` : '#'} className="wishlist-card-media">
                {item.image_url ? <img src={item.image_url} alt={item.product_name} loading="lazy" decoding="async" /> : <div className="wishlist-card-placeholder" />}
              </Link>
              <div className="wishlist-card-body">
                <Link to={item.product_slug ? `/product/${item.product_slug}` : '#'} className="wishlist-card-title">
                  {item.product_name}
                </Link>
                {formatVariant(item) && <p className="wishlist-card-price">{formatVariant(item)}</p>}
                {item.stock_quantity != null && (
                  <p className="wishlist-card-price">{item.stock_quantity > 0 ? `In Stock (${item.stock_quantity} available)` : 'Out of stock'}</p>
                )}
                <p className="wishlist-card-price">{item.currency} {(item.price ?? 0).toFixed(3)}</p>
                <div className="wishlist-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary wishlist-add-to-cart"
                    disabled={item.stock_quantity != null && item.stock_quantity <= 0}
                    onClick={() => void handleAddToCart(item)}
                  >
                    <ShoppingBag size={15} /> Add to Cart
                  </button>
                  <button type="button" className="wishlist-remove" onClick={() => void remove(item.product_id)}>
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

