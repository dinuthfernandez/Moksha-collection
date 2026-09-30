import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react'
import { getCategoryTree, getProducts } from '../api/categories'
import { useCart } from '../context/CartContext'
import type { Category, Product } from '../types'
import EmptyState from '../components/ui/EmptyState'
import CategoryHeroCarousel from '../components/ui/CategoryHeroCarousel'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import Reveal from '../components/ui/Reveal'
import './CategoryLanding.css'
import './Azhak.css'

const CATEGORY_BATCH_SIZE = 6
const PAGE_SIZE = 8

interface CatalogEntry {
  id: string
  name: string
  slug: string
  price: number
  image_url: string | null
  product?: Product
}

const FALLBACK_CATEGORIES = [
  { id: 'bottom-collection', name: 'Bottom Collection', slug: 'bottom-collection', image_url: null },
  { id: 'co-ord-sets', name: 'Co Ord Sets', slug: 'co-ord-sets', image_url: null },
  { id: 'dupatta-collection', name: 'Dupatta Collection', slug: 'dupatta-collection', image_url: null },
  { id: 'feeding-kurti', name: 'Feeding Kurti', slug: 'feeding-kurti', image_url: null },
  { id: 'girls-wear', name: 'Girls Wear', slug: 'girls-wear', image_url: null },
  { id: 'home-wear', name: 'Home Wear', slug: 'home-wear', image_url: null },
  { id: 'kaftan-collection', name: 'Kaftan Collection', slug: 'kaftan-collection', image_url: null },
  { id: 'kurti', name: 'Kurti', slug: 'kurti', image_url: null },
  { id: 'plus-size-outfits', name: 'Plus Size Outfits', slug: 'plus-size-outfits', image_url: null },
  { id: 'premium-collections', name: 'Premium Collections', slug: 'premium-collections', image_url: null },
  { id: 'salwar-material', name: 'Salwar Material', slug: 'salwar-material', image_url: null },
  { id: 'skirt', name: 'Skirt', slug: 'skirt', image_url: null },
  { id: 'top-bottom-set', name: 'Top Bottom Set', slug: 'top-bottom-set', image_url: null },
  { id: 'western-outfits', name: 'Western Outfits', slug: 'western-outfits', image_url: null },
  { id: 'saree', name: 'Saree', slug: 'saree', image_url: null },
  { id: 'top', name: 'Top', slug: 'top', image_url: null },
  { id: 'top-dupatta', name: 'Top & Dupatta', slug: 'top-dupatta', image_url: null },
  { id: '2-piece-set', name: '2 Piece Set', slug: '2-piece-set', image_url: null },
  { id: '3-piece-set', name: '3 Piece Set', slug: '3-piece-set', image_url: null },
  { id: 'churitar-material', name: 'Churitar Material', slug: 'churitar-material', image_url: null },
  { id: 'long-frock', name: 'Long Frock', slug: 'long-frock', image_url: null },
  { id: 'frock', name: 'Frock', slug: 'frock', image_url: null },
]

const DEMO_PRODUCTS: CatalogEntry[] = [
  { id: 'clothing-sample-01', name: 'Sample Kurti', slug: '', price: 18, image_url: null },
  { id: 'clothing-sample-02', name: 'Sample Co-Ord Set', slug: '', price: 24, image_url: null },
  { id: 'clothing-sample-03', name: 'Sample Saree', slug: '', price: 32, image_url: null },
  { id: 'clothing-sample-04', name: 'Sample Kaftan', slug: '', price: 22, image_url: null },
  { id: 'clothing-sample-05', name: 'Sample Long Frock', slug: '', price: 26, image_url: null },
  { id: 'clothing-sample-06', name: 'Sample Top & Bottom Set', slug: '', price: 20, image_url: null },
  { id: 'clothing-sample-07', name: 'Sample Dupatta Set', slug: '', price: 16, image_url: null },
  { id: 'clothing-sample-08', name: 'Sample Skirt', slug: '', price: 17, image_url: null },
  { id: 'clothing-sample-09', name: 'Sample Salwar Set', slug: '', price: 21, image_url: null },
  { id: 'clothing-sample-10', name: 'Sample Western Outfit', slug: '', price: 28, image_url: null },
  { id: 'clothing-sample-11', name: 'Sample Girls Wear Set', slug: '', price: 14, image_url: null },
  { id: 'clothing-sample-12', name: 'Sample Home Wear', slug: '', price: 12, image_url: null },
  { id: 'clothing-sample-13', name: 'Sample Premium Dress', slug: '', price: 36, image_url: null },
  { id: 'clothing-sample-14', name: 'Sample Feeding Kurti', slug: '', price: 19, image_url: null },
  { id: 'clothing-sample-15', name: 'Sample Two Piece Set', slug: '', price: 23, image_url: null },
  { id: 'clothing-sample-16', name: 'Sample Frock', slug: '', price: 15, image_url: null },
]

const CONTENT = {
  heroEyebrow: 'Signature Edit',
  heroTitle: 'Wear Your',
  heroHighlight: 'Confidence.',
  heroSubtitle:
    "Moksha Collections curates considered silhouettes — refined tailoring, fluid drapes, and colour stories made for the way you actually live.",
  heroSets: [
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

export default function CategoryLanding({ type }: { type: 'clothing' }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_BATCH_SIZE)
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(true)
  const [products, setProducts] = useState<CatalogEntry[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [demoCatalog, setDemoCatalog] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [toast, setToast] = useState('')
  const { addItem } = useCart()

  useEffect(() => {
    let mounted = true
    getCategoryTree(type)
      .then((data) => mounted && setCategories(data))
      .catch(() => mounted && setCategories([]))
      .finally(() => mounted && setCategoriesLoading(false))
    return () => {
      mounted = false
    }
  }, [type])

  useEffect(() => {
    let mounted = true
    getProducts(type, 1, 8)
      .then((data) => mounted && setNewArrivals(data.items))
      .catch(() => mounted && setNewArrivals([]))
      .finally(() => mounted && setNewArrivalsLoading(false))
    return () => {
      mounted = false
    }
  }, [type])

  useEffect(() => {
    let mounted = true
    setProductsLoading(true)
    getProducts(type, page, PAGE_SIZE)
      .then((data) => {
        if (!mounted) return
        if (data.items.length > 0) {
          setProducts(data.items.map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            image_url: product.image_url ?? null,
            product,
          })))
          setDemoCatalog(false)
          setTotalPages(data.total_pages)
          setTotalProducts(data.total)
        } else {
          setProducts(DEMO_PRODUCTS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
          setDemoCatalog(true)
          setTotalPages(Math.ceil(DEMO_PRODUCTS.length / PAGE_SIZE))
          setTotalProducts(DEMO_PRODUCTS.length)
        }
      })
      .catch(() => {
        if (!mounted) return
        setProducts(DEMO_PRODUCTS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        setDemoCatalog(true)
        setTotalPages(Math.ceil(DEMO_PRODUCTS.length / PAGE_SIZE))
        setTotalProducts(DEMO_PRODUCTS.length)
      })
      .finally(() => mounted && setProductsLoading(false))
    return () => {
      mounted = false
    }
  }, [page, type])

  const allCategories = categories.length > 0 ? categories : FALLBACK_CATEGORIES
  const visibleCategories = allCategories.slice(0, visibleCategoryCount)

  const handleAddToBag = async (product: Product) => {
    const reserved = await addItem({
      id: product.id,
      name: product.name,
      image_url: product.image_url ?? undefined,
      price: product.price,
      quantity: 1,
    })
    if (!reserved) {
      setToast('Could not reserve this item. Please try again.')
      window.setTimeout(() => setToast(''), 2600)
      return
    }
    setToast(`${product.name} added to your bag`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const goToCatalogPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
    document.querySelector('.clothing-catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="category-landing">
      <CategoryHeroCarousel
        eyebrow={CONTENT.heroEyebrow}
        title={CONTENT.heroTitle}
        highlight={CONTENT.heroHighlight}
        subtitle={CONTENT.heroSubtitle}
        sets={CONTENT.heroSets}
      />

      <div className="azhak-page clothing-shop-sections">
        <section className="azhak-category-section container" aria-labelledby="clothing-categories-title">
          <div className="azhak-section-heading">
            <h2 id="clothing-categories-title">Shop by Category</h2>
            <span>{allCategories.length} categories</span>
          </div>
          <div className="azhak-category-grid" aria-busy={categoriesLoading}>
            {visibleCategories.map((category) => (
              <Link key={category.id} to={`/clothing/${category.slug}`} className="azhak-category-card">
                <PlaceholderImage
                  src={category.image_url}
                  alt={category.name}
                  label="Category image"
                  ratio="4 / 5"
                  className="azhak-category-image"
                />
                <div className="azhak-category-overlay">
                  <h2>{category.name}</h2>
                  <span>Explore <ArrowRight size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
          {allCategories.length > CATEGORY_BATCH_SIZE && (
            <button
              type="button"
              className="azhak-see-more"
              onClick={() => setVisibleCategoryCount((count) => (
                count >= allCategories.length ? CATEGORY_BATCH_SIZE : count + CATEGORY_BATCH_SIZE
              ))}
            >
              {visibleCategoryCount >= allCategories.length ? 'Show fewer' : 'See more categories'}
              <ArrowRight size={15} />
            </button>
          )}
        </section>

        <Reveal as="section" className="container category-landing-section">
          <div className="section-heading">
            <span className="eyebrow">Curated Collection</span>
            <h2 className="section-title">New Arrivals</h2>
          </div>
          {!newArrivalsLoading && newArrivals.length === 0 && (
            <EmptyState
              title="New Arrivals Launching Soon"
              message="We're curating this collection with care. Follow our WhatsApp and Instagram for the first look."
            />
          )}
          {newArrivals.length > 0 && (
            <div className="product-grid">
              {newArrivals.map((product) => (
                <Link key={product.id} to={`/product/${product.slug}`} className="product-card">
                  <div className="product-card-image-wrap">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="product-card-image" />
                    ) : (
                      <div className="product-card-image placeholder">No Image</div>
                    )}
                  </div>
                  <div className="product-card-body">
                    <h2>{product.name}</h2>
                    <p className="product-card-price">BHD {Number(product.price || 0).toFixed(2)}</p>
                    <p className="product-card-stock">Stock on Hand: {product.stock_quantity}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Reveal>

        <section className="azhak-products-section clothing-catalog-section container" aria-labelledby="clothing-catalog-title">
          <div className="azhak-section-heading">
            <h2 id="clothing-catalog-title">Catalog</h2>
            <span>
              {productsLoading ? 'Loading pieces…' : demoCatalog ? 'Sample catalog preview' : `${totalProducts} pieces`}
            </span>
          </div>
          {productsLoading ? (
            <div className="azhak-product-grid" aria-label="Loading clothing">
              {Array.from({ length: PAGE_SIZE }, (_, index) => <div className="azhak-product-skeleton" key={index} />)}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="azhak-product-grid">
                {products.map((entry) => (
                  <article key={entry.id} className="azhak-product-card">
                    {entry.product ? (
                      <Link to={`/product/${entry.product.slug}`} className="azhak-product-link">
                        <PlaceholderImage src={entry.image_url} alt={entry.name} label="Product image — 1000 × 1250 px" ratio="4 / 5" className="azhak-product-image" />
                        <div className="azhak-product-info">
                          <h3>{entry.name}</h3>
                          <span>BHD {Number(entry.price || 0).toFixed(2)}</span>
                        </div>
                      </Link>
                    ) : (
                      <div className="azhak-product-link">
                        <span className="azhak-sample-label">Sample product</span>
                        <PlaceholderImage src={entry.image_url} alt={entry.name} label="Product image — 1000 × 1250 px" ratio="4 / 5" className="azhak-product-image" />
                        <div className="azhak-product-info">
                          <h3>{entry.name}</h3>
                          <span>BHD {entry.price.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    {entry.product ? (
                      <button type="button" className="azhak-add-button" onClick={() => handleAddToBag(entry.product!)}>
                        <ShoppingBag size={15} /> Add to bag
                      </button>
                    ) : (
                      <span className="azhak-sample-note">Preview only</span>
                    )}
                  </article>
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="azhak-pagination" aria-label="Clothing catalog pages">
                  <button type="button" onClick={() => goToCatalogPage(page - 1)} disabled={page <= 1}>
                    <ArrowLeft size={15} /> Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" onClick={() => goToCatalogPage(page + 1)} disabled={page >= totalPages}>
                    Next <ArrowRight size={15} />
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="azhak-catalog-empty">Products will appear here as they become available.</div>
          )}
        </section>
      </div>
      {toast && <div className="azhak-toast" role="status"><ShoppingBag size={16} />{toast}</div>}
    </div>
  )
}
