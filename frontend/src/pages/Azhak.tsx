import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react'
import { getCategoryTree, getProducts } from '../api/categories'
import { useCart } from '../context/CartContext'
import type { Category, Product } from '../types'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import './Azhak.css'

const CATEGORY_BATCH_SIZE = 6
const PRODUCT_PAGE_SIZE = 8

interface CatalogEntry {
  id: string
  name: string
  slug: string
  price: number
  image_url: string | null
  product?: Product
}

const FALLBACK_CATEGORIES = [
  { id: 'necklace', name: 'Necklace', slug: 'necklace', image_url: null },
  { id: 'earrings', name: 'Earrings', slug: 'earrings', image_url: null },
  { id: 'bangles', name: 'Bangles', slug: 'bangles', image_url: null },
  { id: 'hip-chains', name: 'Hip Chains', slug: 'hip-chains', image_url: null },
  { id: 'panja', name: 'Panja', slug: 'panja', image_url: null },
  { id: 'hair-accessories', name: 'Hair Accessories', slug: 'hair-accessories', image_url: null },
  { id: 'maang-tikka', name: 'Maang Tikka', slug: 'maang-tikka', image_url: null },
  { id: 'finger-rings', name: 'Finger Rings', slug: 'finger-rings', image_url: null },
  { id: 'anklets', name: 'Anklets', slug: 'anklets', image_url: null },
  { id: 'bag-collection', name: 'Bag Collection', slug: 'bag-collection', image_url: null },
]

const DEMO_PRODUCTS: CatalogEntry[] = [
  { id: 'sample-01', name: 'Sample Necklace', slug: '', price: 8.5, image_url: null },
  { id: 'sample-02', name: 'Sample Earrings', slug: '', price: 5.5, image_url: null },
  { id: 'sample-03', name: 'Sample Bangles', slug: '', price: 7.0, image_url: null },
  { id: 'sample-04', name: 'Sample Hip Chain', slug: '', price: 12.0, image_url: null },
  { id: 'sample-05', name: 'Sample Panja', slug: '', price: 6.5, image_url: null },
  { id: 'sample-06', name: 'Sample Hair Accessory', slug: '', price: 4.5, image_url: null },
  { id: 'sample-07', name: 'Sample Maang Tikka', slug: '', price: 9.0, image_url: null },
  { id: 'sample-08', name: 'Sample Finger Ring', slug: '', price: 5.0, image_url: null },
  { id: 'sample-09', name: 'Sample Anklet', slug: '', price: 6.0, image_url: null },
  { id: 'sample-10', name: 'Sample Mini Bag', slug: '', price: 15.0, image_url: null },
  { id: 'sample-11', name: 'Sample Pendant', slug: '', price: 7.5, image_url: null },
  { id: 'sample-12', name: 'Sample Stud Earrings', slug: '', price: 4.0, image_url: null },
  { id: 'sample-13', name: 'Sample Cuff Bangles', slug: '', price: 8.0, image_url: null },
  { id: 'sample-14', name: 'Sample Hair Clip', slug: '', price: 3.5, image_url: null },
  { id: 'sample-15', name: 'Sample Chain', slug: '', price: 6.5, image_url: null },
  { id: 'sample-16', name: 'Sample Clutch', slug: '', price: 13.0, image_url: null },
]

export default function Azhak() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_BATCH_SIZE)
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
    getCategoryTree('accessories')
      .then((data) => {
        if (!mounted) return
        setCategories(data)
      })
      .catch(() => {
        if (!mounted) return
        setCategories([])
      })
      .finally(() => mounted && setCategoriesLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setProductsLoading(true)
    getProducts('accessories', page, PRODUCT_PAGE_SIZE)
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
          setProducts(DEMO_PRODUCTS.slice((page - 1) * PRODUCT_PAGE_SIZE, page * PRODUCT_PAGE_SIZE))
          setDemoCatalog(true)
          setTotalPages(Math.ceil(DEMO_PRODUCTS.length / PRODUCT_PAGE_SIZE))
          setTotalProducts(DEMO_PRODUCTS.length)
        }
      })
      .catch(() => {
        if (!mounted) return
        setProducts(DEMO_PRODUCTS.slice((page - 1) * PRODUCT_PAGE_SIZE, page * PRODUCT_PAGE_SIZE))
        setDemoCatalog(true)
        setTotalPages(Math.ceil(DEMO_PRODUCTS.length / PRODUCT_PAGE_SIZE))
        setTotalProducts(DEMO_PRODUCTS.length)
      })
      .finally(() => mounted && setProductsLoading(false))
    return () => {
      mounted = false
    }
  }, [page])

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
    document.querySelector('.azhak-products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="azhak-page">
      <main className="azhak-catalog container">
        <div className="azhak-catalog-intro">
          <div className="azhak-intro-brand">
            <span className="azhak-catalog-logo">
              <img src="/assets/logo/azhak-logo.png" alt="Azhak" />
            </span>
            <div>
              <p className="azhak-kicker">Accessories by Moksha Collections</p>
              <h1>Considered finishing pieces.</h1>
              <p className="azhak-brand-copy">An edited collection of accessories for the details that make a look yours.</p>
            </div>
          </div>
        </div>

        <section className="azhak-category-section" aria-labelledby="azhak-categories-title">
          <div className="azhak-section-heading">
            <h2 id="azhak-categories-title">Shop by Category</h2>
            <span>{allCategories.length} categories</span>
          </div>
          <div className="azhak-category-grid" aria-busy={categoriesLoading}>
            {visibleCategories.map((category) => (
              <Link
                key={category.id}
                to={`/accessories/${category.slug}`}
                className="azhak-category-card"
              >
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

        <section className="azhak-products-section" aria-labelledby="azhak-catalog-title">
          <div className="azhak-section-heading">
            <h2 id="azhak-catalog-title">Catalog</h2>
            <span>
              {productsLoading
                ? 'Loading pieces…'
                : demoCatalog
                  ? 'Sample catalog preview'
                  : `${totalProducts} pieces`}
            </span>
          </div>
          {productsLoading ? (
            <div className="azhak-product-grid" aria-label="Loading accessories">
              {Array.from({ length: 8 }, (_, index) => <div className="azhak-product-skeleton" key={index} />)}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="azhak-product-grid">
                {products.map((entry) => (
                  <article key={entry.id} className="azhak-product-card">
                    {entry.product ? (
                      <Link to={`/product/${entry.product.slug}`} className="azhak-product-link">
                        <PlaceholderImage
                          src={entry.image_url}
                          alt={entry.name}
                          label="Product image — 1000 × 1250 px"
                          ratio="4 / 5"
                          className="azhak-product-image"
                        />
                        <div className="azhak-product-info">
                          <h3>{entry.name}</h3>
                          <span>BHD {Number(entry.price || 0).toFixed(2)}</span>
                        </div>
                      </Link>
                    ) : (
                      <div className="azhak-product-link">
                        <span className="azhak-sample-label">Sample product</span>
                        <PlaceholderImage
                          src={entry.image_url}
                          alt={entry.name}
                          label="Product image — 1000 × 1250 px"
                          ratio="4 / 5"
                          className="azhak-product-image"
                        />
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
                <nav className="azhak-pagination" aria-label="Catalog pages">
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
      </main>
      {toast && <div className="azhak-toast" role="status"><ShoppingBag size={16} />{toast}</div>}
    </div>
  )
}
