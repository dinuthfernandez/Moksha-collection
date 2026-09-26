import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, Heart, MapPin, ShoppingBag, Star, Truck } from 'lucide-react'
import { getProductBySlug } from '../api/categories'
import { getAddresses } from '../api/addresses'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useAuth } from '../context/AuthContext'
import { getPublicSettings } from '../api/settings'
import { getAddressTier } from '../data/addressTiers'
import ProductReviews from '../components/ui/ProductReviews'
import ProductQuantitySelector from '../components/ui/ProductQuantitySelector'
import { TERMS_AND_CONDITIONS_SECTIONS } from '../data/policies'
import type { Address, DeliveryRate, Product } from '../types'
import './ProductDetail.css'

function formatDeliveryDate(daysFromNow: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  const safeDays = Number.isFinite(daysFromNow) ? Math.max(0, Math.floor(daysFromNow)) : 1
  date.setDate(date.getDate() + safeDays)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function getDeliveryDateRange(rate: DeliveryRate) {
  const daysFrom = rate.delivery_days_from
  const daysTo = rate.delivery_days_to
  if (
    !Number.isInteger(daysFrom) ||
    !Number.isInteger(daysTo) ||
    daysFrom < 0 ||
    daysTo < daysFrom ||
    daysTo > 90
  ) {
    return null
  }

  return {
    from: formatDeliveryDate(daysFrom),
    to: formatDeliveryDate(daysTo),
  }
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showFixedActions, setShowFixedActions] = useState(false)
  const inlineActionsRef = useRef<HTMLDivElement>(null)
  const [returnWindowDays, setReturnWindowDays] = useState(7)
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([])
  const [reviewSummary, setReviewSummary] = useState<{ average_rating: number; total: number }>({ average_rating: 0, total: 0 })

  const { addItem } = useCart()
  const { isSaved, toggle } = useWishlist()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

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

  useEffect(() => {
    setQuantity(1)
  }, [product?.id])

  useEffect(() => {
    let mounted = true
    getPublicSettings()
      .then((settings) => {
        if (!mounted) return
        setReturnWindowDays(settings.return_window_days)
        setDeliveryRates(settings.delivery_rates)
      })
      .catch(() => {
        // The public API's configured default is seven days.
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setDefaultAddress(null)
      setAddressLoading(false)
      return
    }

    let mounted = true
    setAddressLoading(true)
    getAddresses()
      .then((addresses) => {
        if (mounted) setDefaultAddress(addresses.find((address) => address.is_default) ?? null)
      })
      .catch(() => mounted && setDefaultAddress(null))
      .finally(() => mounted && setAddressLoading(false))
    return () => {
      mounted = false
    }
  }, [isAuthenticated, authLoading])

  useEffect(() => {
    if (!product) return
    const updateDockVisibility = () => {
      const actions = inlineActionsRef.current
      if (!actions) return
      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0
      setShowFixedActions(actions.getBoundingClientRect().bottom <= headerBottom)
    }

    updateDockVisibility()
    window.addEventListener('scroll', updateDockVisibility, { passive: true })
    window.addEventListener('resize', updateDockVisibility)
    return () => {
      window.removeEventListener('scroll', updateDockVisibility)
      window.removeEventListener('resize', updateDockVisibility)
    }
  }, [product?.id])

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
  const maxQuantity = Math.max(0, product.stock_quantity)
  const deliveryRate = defaultAddress
    ? deliveryRates.find((rate) => rate.delivery_type === getAddressTier(defaultAddress.country_code))
    : undefined
  const deliveryDates = deliveryRate ? getDeliveryDateRange(deliveryRate) : null
  const defaultAddressLines = defaultAddress
    ? [
        defaultAddress.full_name,
        defaultAddress.building_name,
        defaultAddress.apartment_number,
        defaultAddress.address_line1,
        defaultAddress.address_line2,
        defaultAddress.block_number ? `Block ${defaultAddress.block_number}` : null,
        defaultAddress.road_number ? `Road ${defaultAddress.road_number}` : null,
        defaultAddress.district,
        defaultAddress.city,
        defaultAddress.state_region,
        defaultAddress.country_name,
        defaultAddress.postal_code,
      ].filter((line): line is string => Boolean(line?.trim()))
    : []

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      image_url: product.image_url ?? undefined,
      price: product.price,
      quantity,
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
          <div className="product-detail-rating" aria-label={`${reviewSummary.average_rating.toFixed(1)} out of 5 stars from ${reviewSummary.total} reviews`}>
            <span aria-hidden="true" className="product-detail-rating-stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <Star key={value} size={16} fill={value <= Math.round(reviewSummary.average_rating) ? 'currentColor' : 'none'} />
              ))}
            </span>
            <strong>{reviewSummary.average_rating.toFixed(1)}</strong>
            <span>{reviewSummary.total} {reviewSummary.total === 1 ? 'review' : 'reviews'}</span>
          </div>
          <p className="product-detail-code">
            Product code <code>{product.product_code ?? product.zoho_sku ?? product.id.slice(0, 12).toUpperCase()}</code>
          </p>
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

          <div
            ref={inlineActionsRef}
            className={`product-detail-inline-actions ${showFixedActions ? 'is-replaced' : ''}`}
            role="group"
            aria-label="Product actions"
            aria-hidden={showFixedActions}
          >
              <ProductQuantitySelector quantity={quantity} max={maxQuantity} onChange={setQuantity} />
              <button className="btn btn-primary product-detail-add-btn" onClick={handleAddToCart} disabled={!inStock} tabIndex={showFixedActions ? -1 : 0}>
                <ShoppingBag size={18} />
                {added ? 'Added to Cart' : 'Add to Cart'}
              </button>
              <button
                className={`btn btn-outline product-detail-wishlist-btn ${saved ? 'is-saved' : ''}`}
                onClick={handleWishlistToggle}
                disabled={!isAuthenticated}
                title={!isAuthenticated ? 'Sign in to save items' : undefined}
                tabIndex={showFixedActions ? -1 : 0}
              >
                <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                {saved ? 'Saved to Wishlist' : 'Add to Wishlist'}
              </button>
          </div>

          <a className="btn btn-outline product-detail-size-chart" href="/size-charts" target="_blank" rel="noopener noreferrer">
            Size charts <ExternalLink size={16} aria-hidden="true" />
          </a>
          <section className="product-delivery-info" aria-label="Delivery information">
            {isAuthenticated && defaultAddress && (
              <div className="product-default-address">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <h2>Delivering to {defaultAddress.label || 'your default address'}</h2>
                  <p>{defaultAddressLines.join(', ')}</p>
                </div>
              </div>
            )}

            <div className="product-delivery-estimate">
              <Truck size={19} aria-hidden="true" />
              <div>
                <h2>Estimated delivery</h2>
                {authLoading || addressLoading ? (
                  <p>Checking your delivery location…</p>
                ) : !isAuthenticated ? (
                  <p><Link to="/login">Sign in and add your location</Link> to see your delivery estimate.</p>
                ) : !defaultAddress ? (
                  <p><Link to="/addresses">Add a default delivery address</Link> to see your delivery estimate.</p>
                ) : deliveryDates ? (
                  <p className="product-delivery-date-range">
                    <CalendarDays size={15} aria-hidden="true" />
                    {deliveryDates.from} – {deliveryDates.to}
                  </p>
                ) : (
                  <p>Delivery estimates are currently unavailable for this location. Please contact us for an estimate.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      <ProductReviews productId={product.id} onSummaryChange={setReviewSummary} />
      <section className="product-return-policy" aria-labelledby="product-return-policy-title">
        <p className="product-return-window">
          Eligible returns can be requested within <strong>{returnWindowDays} days</strong> of receiving your order.
        </p>
        <details className="product-return-policy-disclosure">
          <summary id="product-return-policy-title">Return, Exchange &amp; Refund Policy</summary>
          <div className="product-return-policy-content">
            <p className="product-return-policy-intro">
              At Moksha Collections, every piece is checked by hand before it reaches you. If something isn't right,
              we'll make it right.
            </p>
            <div className="product-terms-content product-return-policy-sections">
              <details className="product-terms-section">
                <summary>When We Accept a Return</summary>
                <p>
                We accept returns where an item arrives faulty, damaged, incorrect, or not as described. In line with
                Bahrain's Consumer Protection Law, you may request a return for any of these reasons within {returnWindowDays} days of
                receiving your order.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>Change Of Mind</summary>
                <p>
                We do not offer refunds for change of mind, sizing, or preference. Instead, we're happy to arrange an
                exchange for another piece, or issue a credit note toward a future order, subject to the condition
                below. For change-of-mind exchanges, return delivery is arranged at the customer's cost.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>How To Reach Us</summary>
                <p>
                Message our concierge on WhatsApp at{' '}
                <a href="https://wa.me/97335521619" target="_blank" rel="noreferrer">+973 3552 1619</a>{' '}
                within 48 hours of delivery, with a short photo or video of the issue. This helps us resolve things
                quickly — usually the same day.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>Your Remedy</summary>
                <p>
                For an eligible return — a faulty, damaged, incorrect, or misdescribed item — you may choose an
                exchange, a replacement of the same item where available, or a credit note. Should you prefer a refund
                of the amount paid, this is honoured in line with Bahrain's Consumer Protection Law and returned to your
                original account, typically within 7 business days.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>Exchanges</summary>
                <p>
                Where you exchange for an item of higher value, the difference is settled before dispatch; where the new
                item is of lower value, the balance is issued as a credit note. Exchanges are subject to availability.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>Credit Notes</summary>
                <p>
                Credit notes are issued for the full value of the returned item and do not expire. They can be applied
                to any future order and used across more than one purchase until the balance is spent.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>Condition</summary>
                <p>Items should be returned unworn, unwashed, and with tags attached and original packaging intact.</p>
              </details>
              <details className="product-terms-section">
                <summary>Return Delivery</summary>
                <p>
                Where the fault is ours — a damaged, incorrect, or misdescribed item — we cover the cost of return
                delivery. For change-of-mind returns and exchanges, return delivery is at the customer's cost.
                </p>
              </details>
              <details className="product-terms-section">
                <summary>A Note On Hygiene</summary>
                <p>For hygiene reasons, pierced earrings cannot be returned or exchanged unless they arrive faulty.</p>
              </details>
            </div>
            <p className="product-return-policy-closing">Questions before you buy? Our concierge is always a message away.</p>
          </div>
        </details>
        <details className="product-return-policy-disclosure product-terms-disclosure">
          <summary id="product-terms-title">Terms &amp; Conditions</summary>
          <div className="product-terms-content">
            {TERMS_AND_CONDITIONS_SECTIONS.map((section) => (
              <details className="product-terms-section" key={section.title}>
                <summary>{section.title}</summary>
                <p>{section.body}</p>
              </details>
            ))}
          </div>
        </details>
      </section>
      <div
        className={`product-detail-action-dock ${showFixedActions ? 'is-available' : ''}`}
        role="group"
        aria-label="Product actions"
        aria-hidden={!showFixedActions}
      >
        <ProductQuantitySelector quantity={quantity} max={maxQuantity} onChange={setQuantity} />
        <button className="btn btn-primary product-detail-add-btn" onClick={handleAddToCart} disabled={!inStock} tabIndex={showFixedActions ? 0 : -1}>
          <ShoppingBag size={18} />
          {added ? 'Added to Cart' : 'Add to Cart'}
        </button>
        <button
          className={`btn btn-outline product-detail-wishlist-btn ${saved ? 'is-saved' : ''}`}
          onClick={handleWishlistToggle}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? 'Sign in to save items' : undefined}
          tabIndex={showFixedActions ? 0 : -1}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved to Wishlist' : 'Add to Wishlist'}
        </button>
      </div>
    </div>
  )
}
