import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { getCategoryTree, getProducts } from '../api/categories'
import { useCart } from '../context/CartContext'
import type { Category, Product } from '../types'
import EmptyState from '../components/ui/EmptyState'
import CategoryHeroCarousel from '../components/ui/CategoryHeroCarousel'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import PriceTag from '../components/ui/PriceTag'
import { useCategoryLimit } from '../utils/useCategoryLimit'
import './CategoryLanding.css'
import './Azhak.css'
import './ClothingModern.css'

const STEP = 8
const RAIL_SIZE = 8
const PAGE = 24

const HERO = {
  eyebrow: 'Signature Edit',
  title: 'Wear Your',
  highlight: 'Confidence.',
  subtitle:
    'Moksha Collections curates considered silhouettes — refined tailoring, fluid drapes, and colour stories made for the way you actually live.',
  sets: [
    {
      large: '/assets/category/DSC_5516.jpg.jpeg',
      smallTop: '/assets/category/DSC_5685.jpg.jpeg',
      smallBottom: '/assets/category/DSC_5742.jpg.jpeg',
    },
    {
      large: '/assets/category/DSC_5679.jpg.jpeg',
      smallTop: '/assets/category/DSC_5704.jpg.jpeg',
      smallBottom: '/assets/category/DSC_5650.jpg.jpeg',
    },
  ],
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const soldOut = product.stock_quantity <= 0
  return (
    <article className={`azhak-product-card${soldOut ? ' is-out-of-stock' : ''}`}>
      <Link to={`/product/${product.slug}`} className="azhak-product-link">
        <PlaceholderImage src={product.image_url} alt={product.name} label="Product image" ratio="4 / 5" className="azhak-product-image" />
        <div className="azhak-product-info">
          <h3>{product.name}</h3>
          <PriceTag price={product.price} originalPrice={product.original_price} />
        </div>
      </Link>
      <button type="button" className="azhak-add-button" disabled={soldOut} onClick={() => onAdd(product)}>
        <ShoppingBag size={15} /> {soldOut ? 'Out of stock' : 'Add to bag'}
      </button>
    </article>
  )
}

function Skeletons({ count }: { count: number }) {
  return (
    <div className="azhak-product-grid" aria-busy="true">
      {Array.from({ length: count }, (_, i) => <div className="azhak-product-skeleton" key={i} />)}
    </div>
  )
}

type PageType = 'clothing' | 'accessories' | 'saree'
type RailFilters = { maxPrice?: number; clearance?: boolean; discounted?: boolean }

const LOGO_HERO: Record<'accessories' | 'saree', { eyebrow: string; title: string; subtitle: string }> = {
  saree: {
    eyebrow: 'Timeless Drapes',
    title: 'Drape Yourself in Elegance',
    subtitle: 'Sarees and saree sets for weddings, festivals and every celebration in between.',
  },
  accessories: {
    eyebrow: 'The Finishing Touch',
    title: 'Details That Make the Look',
    subtitle: 'Jewellery, bangles and accessories chosen to complete every outfit.',
  },
}

function LogoHero({ type }: { type: 'accessories' | 'saree' }) {
  const c = LOGO_HERO[type]
  const design = type === 'saree' ? 2 : 1
  return (
    <section className={`modern-hero design-${design} hero-${type}`} aria-label={`${type} hero`}>
      <div className="modern-hero-bg" aria-hidden="true">
        {design === 1 ? (
          <>
            <span className="modern-orb orb-a" />
            <span className="modern-orb orb-b" />
            <span className="modern-orb orb-c" />
            <span className="modern-ring ring-a" />
            <span className="modern-ring ring-b" />
            <span className="modern-grid" />
          </>
        ) : (
          <>
            <span className="d2-conic" />
            <span className="d2-beam beam-a" />
            <span className="d2-beam beam-b" />
            <span className="d2-beam beam-c" />
            <span className="d2-gem gem-a" />
            <span className="d2-gem gem-b" />
            <span className="d2-gem gem-c" />
            <span className="d2-gem gem-d" />
            <span className="d2-vignette" />
          </>
        )}
      </div>
      <div className="modern-hero-inner container">
        <span className="modern-hero-eyebrow">{c.eyebrow}</span>
        <div className={`modern-hero-badge ${type}`}>
          {type === 'saree' ? (
            <img src="/assets/logo/saree.png" alt="Pallu & Pleats" />
          ) : (
            <img src="/assets/logo/azhak-logo.png" alt="Azhak by Moksha Collections" />
          )}
        </div>
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
        <a href="#modern-categories-title" className="btn btn-primary">Shop now</a>
      </div>
    </section>
  )
}

function Rail({
  id, type, title, subtitle, filters, emptyTitle, emptyMessage, onAdd,
}: {
  id: string
  type: PageType
  title: string
  subtitle: string
  filters: RailFilters
  emptyTitle: string
  emptyMessage: string
  onAdd: (p: Product) => void
}) {
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getProducts(type, page, RAIL_SIZE, undefined, undefined, filters)
      .then((data) => {
        if (!mounted) return
        setTotal(data.total)
        setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items.filter((n) => !prev.some((p) => p.id === n.id))]))
      })
      .catch(() => mounted && page === 1 && setItems([]))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.maxPrice, filters.clearance, filters.discounted])

  const showLess = () => {
    setItems((prev) => prev.slice(0, RAIL_SIZE))
    setPage(1)
  }

  return (
    <section className="azhak-products-section modern-section container" aria-labelledby={id}>
      <div className="azhak-section-heading">
        <h2 id={id}>{title}</h2>
        <span>{loading ? 'Loading…' : total > 0 ? `${total} pieces` : subtitle}</span>
      </div>
      {items.length === 0 && loading ? <Skeletons count={4} /> : items.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <>
          <div className="azhak-product-grid">
            {items.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
          </div>
          {(items.length < total || items.length > RAIL_SIZE) && (
            <div className="modern-load-row">
              {items.length < total && (
                <button type="button" className="btn btn-primary" disabled={loading} onClick={() => setPage((n) => n + 1)}>
                  {loading ? 'Loading…' : 'View more'}
                </button>
              )}
              {items.length > RAIL_SIZE && (
                <button type="button" className="btn btn-outline" onClick={showLess}>View less</button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CategoryRow({ category, onAdd }: { category: Category; onAdd: (p: Product) => void }) {
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [started, setStarted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const wrapRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const fetching = useRef(false)
  const nextPage = useRef(1)

  // Rows load only when they approach the viewport so 19 categories don't fire 19 requests at once.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStarted(true)
        observer.disconnect()
      }
    }, { rootMargin: '500px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const itemsRef = useRef<Product[]>([])

  const loadMore = useCallback(async (size: number) => {
    if (fetching.current) return 0
    fetching.current = true
    let added = 0
    try {
      const data = await getProducts('accessories', nextPage.current, size, undefined, category.slug)
      const fresh = data.items.filter((n) => !itemsRef.current.some((p) => p.id === n.id))
      added = fresh.length
      itemsRef.current = [...itemsRef.current, ...fresh]
      setItems(itemsRef.current)
      setTotal(data.total)
      nextPage.current += 1
    } catch {
      // keep what is already shown
    } finally {
      fetching.current = false
      setLoaded(true)
    }
    return added
  }, [category.slug])

  useEffect(() => {
    if (started) void loadMore(PAGE)
  }, [started, loadMore])

  const slide = async (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const step = track.clientWidth + 16
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
    if (direction === 1) {
      if (atEnd) {
        const added = items.length < total ? await loadMore(PAGE) : 0
        if (!added) return void track.scrollTo({ left: 0, behavior: 'smooth' })
      }
      track.scrollBy({ left: step, behavior: 'smooth' })
    } else if (track.scrollLeft <= 4) {
      // Looping back from the first slide: load the rest of the category, then jump to the last slide.
      if (itemsRef.current.length < total) {
        const everything: Product[] = []
        for (let page = 1; everything.length < total; page += 1) {
          const data = await getProducts('accessories', page, 200, undefined, category.slug).catch(() => null)
          if (!data || data.items.length === 0) break
          everything.push(...data.items.filter((n) => !everything.some((p) => p.id === n.id)))
        }
        if (everything.length >= itemsRef.current.length) {
          itemsRef.current = everything
          setItems(everything)
          nextPage.current = Math.floor(everything.length / PAGE) + 1
        }
      }
      window.setTimeout(() => track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' }), 80)
    } else {
      track.scrollBy({ left: -step, behavior: 'smooth' })
    }
  }

  // Preload the next batch as the customer nears the end of what is loaded.
  const onScroll = () => {
    const track = trackRef.current
    if (!track || items.length >= total) return
    if (track.scrollLeft + track.clientWidth * 2 >= track.scrollWidth) void loadMore(PAGE)
  }

  // Auto-advance every 3 seconds while the row is on screen; pauses on hover, touch or keyboard focus.
  const slideRef = useRef(slide)
  slideRef.current = slide
  const [inView, setInView] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hasItems = items.length > 0
  useEffect(() => {
    if (!hasItems || !inView || paused) return
    const timer = window.setInterval(() => void slideRef.current(1), 3000)
    return () => window.clearInterval(timer)
  }, [hasItems, inView, paused])

  if (loaded && total === 0) return <section ref={wrapRef} aria-hidden="true" />

  return (
    <section
      ref={wrapRef}
      className="azhak-products-section modern-section container cat-row"
      aria-label={category.name}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => window.setTimeout(() => setPaused(false), 4000)}
    >
      <div className="azhak-section-heading">
        <h2>{category.name}</h2>
        {total > 0 && <Link to={`/accessories/${category.slug}`} className="cat-row-all">View all {total} →</Link>}
      </div>
      {items.length === 0 ? (
        started ? <Skeletons count={6} /> : <div className="cat-row-spacer" />
      ) : (
        <>
          <div className="cat-row-track" ref={trackRef} onScroll={onScroll}>
            {items.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
          </div>
          <div className="cat-row-nav">
            <button type="button" aria-label={`Previous ${category.name}`} onClick={() => void slide(-1)}><ChevronLeft size={20} /></button>
            <button type="button" aria-label={`Next ${category.name}`} onClick={() => void slide(1)}><ChevronRight size={20} /></button>
          </div>
        </>
      )}
    </section>
  )
}

export default function ClothingModern({ type = 'clothing' }: { type?: PageType }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [catalog, setCatalog] = useState<Product[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [toast, setToast] = useState('')
  const { addItem } = useCart()
  const categoryLimit = useCategoryLimit()

  useEffect(() => {
    let mounted = true
    const request = type === 'clothing'
      ? Promise.all([getCategoryTree('clothing'), getCategoryTree('saree')])
        .then(([clothing, saree]) => [
          ...clothing,
          ...saree.filter((c) => c.slug !== 'saree-others'),
        ].sort((a, b) => a.display_order - b.display_order))
      : getCategoryTree(type)
    request
      .then((data) => mounted && setCategories(data))
      .catch(() => mounted && setCategories([]))
      .finally(() => mounted && setCategoriesLoading(false))
    return () => { mounted = false }
  }, [type])

  // Load more appends the next page; the first page is always kept.
  useEffect(() => {
    if (type === 'accessories') return
    let mounted = true
    setCatalogLoading(true)
    getProducts(type, catalogPage, STEP)
      .then((data) => {
        if (!mounted) return
        setCatalogTotal(data.total)
        setCatalog((prev) => (catalogPage === 1 ? data.items : [...prev, ...data.items.filter((n) => !prev.some((p) => p.id === n.id))]))
      })
      .catch(() => mounted && catalogPage === 1 && setCatalog([]))
      .finally(() => mounted && setCatalogLoading(false))
    return () => { mounted = false }
  }, [catalogPage, type])

  const handleAddToBag = async (product: Product) => {
    const reserved = await addItem({
      id: product.id,
      name: product.name,
      image_url: product.image_url ?? undefined,
      price: product.price,
      quantity: 1,
    })
    setToast(reserved ? `${product.name} added to your bag` : 'Could not reserve this item. Please try again.')
    window.setTimeout(() => setToast(''), 2400)
  }

  const showLess = () => {
    setCatalog((prev) => prev.slice(0, STEP))
    setCatalogPage(1)
    document.querySelector('.modern-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Links from the home page jump straight to Under 5 BHD / Clearance / Discounts.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 700)
    return () => window.clearTimeout(timer)
  }, [type])

  const visibleCategories = showAllCategories ? categories : categories.slice(0, categoryLimit)
  const hasMore = catalog.length < catalogTotal

  return (
    <div className="category-landing clothing-modern">
      {type === 'clothing' ? (
        <CategoryHeroCarousel
          eyebrow={HERO.eyebrow}
          title={HERO.title}
          highlight={HERO.highlight}
          subtitle={HERO.subtitle}
          sets={HERO.sets}
        />
      ) : (
        <LogoHero type={type} />
      )}

      <div className="azhak-page clothing-shop-sections">
        {(categoriesLoading || categories.length > 0) && (
          <section className="azhak-category-section container" aria-labelledby="modern-categories-title">
            <div className="azhak-section-heading">
              <h2 id="modern-categories-title">All Categories</h2>
              <span>{categories.length} categories</span>
            </div>
            <div className="azhak-category-grid" aria-busy={categoriesLoading}>
              {visibleCategories.map((category) => (
                <Link key={category.id} to={`/${type === 'clothing' ? 'clothing' : type}/${category.slug}`} className="azhak-category-card">
                  <PlaceholderImage src={category.image_url} alt={category.name} label="Category image" ratio="4 / 5" className="azhak-category-image" />
                  <div className="azhak-category-overlay">
                    <h2>{category.name}</h2>
                    <span>Shop Now</span>
                  </div>
                </Link>
              ))}
            </div>
            {categories.length > categoryLimit && (
              <div className="azhak-view-more">
                <button type="button" className="btn btn-outline" onClick={() => setShowAllCategories((v) => !v)}>
                  {showAllCategories ? 'View less' : 'View more'}
                </button>
              </div>
            )}
          </section>
        )}

        {type === 'accessories' && categories.map((category) => (
          <CategoryRow key={category.id} category={category} onAdd={handleAddToBag} />
        ))}

        {type !== 'accessories' && <section className="azhak-products-section modern-section modern-catalog container" aria-labelledby="modern-catalog-title">
          <div className="azhak-section-heading">
            <h2 id="modern-catalog-title">Catalog</h2>
            <span>{catalogTotal > 0 ? `Showing ${catalog.length} of ${catalogTotal}` : ''}</span>
          </div>
          {catalog.length === 0 && catalogLoading ? <Skeletons count={STEP} /> : catalog.length === 0 ? (
            <EmptyState title="Catalog coming soon" message="New pieces are being added. Please check back shortly." />
          ) : (
            <>
              <div className="azhak-product-grid">
                {catalog.map((p) => <ProductCard key={p.id} product={p} onAdd={handleAddToBag} />)}
              </div>
              <div className="modern-load-row">
                {hasMore && (
                  <button type="button" className="btn btn-primary" disabled={catalogLoading} onClick={() => setCatalogPage((n) => n + 1)}>
                    {catalogLoading ? 'Loading…' : 'Load more'}
                  </button>
                )}
                {catalog.length > STEP && (
                  <button type="button" className="btn btn-outline" onClick={showLess}>Show less</button>
                )}
              </div>
            </>
          )}
        </section>}

        <Rail
          id="modern-under5-title"
          type={type}
          title="Under 5 BHD"
          subtitle="Pocket-friendly picks"
          filters={{ maxPrice: 5 }}
          emptyTitle="No pieces under 5 BHD right now"
          emptyMessage="Check back soon for pocket-friendly finds."
          onAdd={handleAddToBag}
        />
        <Rail
          id="modern-clearance-title"
          type={type}
          title="Clearance Sale"
          subtitle="Last chance pieces"
          filters={{ clearance: true }}
          emptyTitle="No clearance items right now"
          emptyMessage="Clearance pieces will appear here when a sale begins."
          onAdd={handleAddToBag}
        />
        <Rail
          id="modern-discounts-title"
          type={type}
          title="Discounts"
          subtitle="Limited-time offers"
          filters={{ discounted: true }}
          emptyTitle="No active discounts right now"
          emptyMessage="Discounted pieces will appear here while an offer is running."
          onAdd={handleAddToBag}
        />
      </div>

      {toast && <div className="azhak-toast" role="status"><ShoppingBag size={16} />{toast}</div>}
    </div>
  )
}
