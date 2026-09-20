import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { getProductBySlug } from '../api/categories'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useAuth } from '../context/AuthContext'
import type { Product } from '../types'
import './ProductDetail.css'

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [added, setAdded] = useState(false)

  const { addItem } = useCart()
  const { isSaved, toggle } = useWishlist()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    setNotFound(false)
    getProductBySlug(slug)
      .then((data) => mounted && setProduct(data))
      .catch(() => mounted && setNotFound(true))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [slug])

  if (loading) return <div className="container product-detail-page" />

  if (notFound || !product) {
    return (
      <div className="container product-detail-page">
        <p className="product-detail-not-found">This product could not be found.</p>
        <Link to="/clothing" className="btn btn-outline">
          Back to Shop
        </Link>
      </div>
    )
  }

  const dimensions = [product.length, product.width, product.height].every((v) => v !== null && v !== undefined && v !== 0)
    ? `${product.length} x ${product.width} x ${product.height} ${product.dimension_unit ?? ''}`.trim()
    : null

  const weight = product.weight ? `${product.weight} ${product.weight_unit ?? ''}`.trim() : null
  const saved = isSaved(product.id)
  const inStock = product.stock_quantity > 0

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      image_url: product.image_url ?? undefined,
      price: product.price,
      quantity: 1,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleWishlistToggle = () => {
    if (!isAuthenticated) return
    toggle({
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      image_url: product.image_url,
      price: product.price,
      currency: 'BHD',
    })
  }

  return (
    <div className="container product-detail-page">
      <div className="product-detail-layout">
        <div className="product-detail-image-wrap">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="product-detail-image" />
          ) : (
            <div className="product-detail-image placeholder">No Image</div>
          )}
        </div>

        <div className="product-detail-info">
          {product.category_slug && <span className="eyebrow">{product.category_slug === 'accessories' ? 'Accessories' : 'Clothing'}</span>}
          <h1 className="product-detail-title">{product.name}</h1>
          <p className="product-detail-price">BHD {Number(product.price || 0).toFixed(2)}</p>
          <p className={`product-detail-stock ${inStock ? 'in-stock' : 'out-of-stock'}`}>
            {inStock ? `In Stock (${product.stock_quantity} available)` : 'Out of Stock'}
          </p>

          {product.description && (
            <div className="product-detail-section">
              <h2>Description</h2>
              <p>{product.description}</p>
            </div>
          )}

          {(product.brand || dimensions || weight) && (
            <div className="product-detail-section">
              <h2>Product Details</h2>
              <dl className="product-detail-specs">
                {product.brand && (
                  <>
                    <dt>Brand</dt>
                    <dd>{product.brand}</dd>
                  </>
                )}
                {dimensions && (
                  <>
                    <dt>Dimensions (L x W x H)</dt>
                    <dd>{dimensions}</dd>
                  </>
                )}
                {weight && (
                  <>
                    <dt>Weight</dt>
                    <dd>{weight}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          <div className="product-detail-actions">
            <button className="btn btn-primary product-detail-add-btn" onClick={handleAddToCart} disabled={!inStock}>
              <ShoppingBag size={18} />
              {added ? 'Added to Cart' : 'Add to Cart'}
            </button>
            <button
              className={`btn btn-outline product-detail-wishlist-btn ${saved ? 'is-saved' : ''}`}
              onClick={handleWishlistToggle}
              disabled={!isAuthenticated}
              title={!isAuthenticated ? 'Sign in to save items' : undefined}
            >
              <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Saved to Wishlist' : 'Add to Wishlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
