import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import { useWishlist } from '../context/WishlistContext'
import './Wishlist.css'

export default function Wishlist() {
  const { items, isLoading, remove } = useWishlist()

  return (
    <div className="container wishlist-page">
      <div className="section-heading">
        <span className="eyebrow">Your Edit</span>
        <h1 className="section-title">Wishlist</h1>
        <p className="section-subtitle">Keep the pieces you love close until you are ready.</p>
      </div>

      {isLoading && <div className="wishlist-empty">Loading your wishlist…</div>}
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
              <div className="wishlist-card-media">
                {item.image_url ? <img src={item.image_url} alt={item.product_name} /> : <div />}
              </div>
              <div className="wishlist-card-content">
                <div>
                  <h2>{item.product_name}</h2>
                  {item.price != null && <p>{item.currency} {item.price.toFixed(3)}</p>}
                </div>
                <button type="button" className="wishlist-remove" onClick={() => void remove(item.product_id)}>
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
