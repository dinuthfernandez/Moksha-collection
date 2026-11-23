import BrandLoader from '../components/ui/BrandLoader'
import PriceTag from '../components/ui/PriceTag'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import { useEffect, useState } from 'react'
import { useLocation, useParams, Link } from 'react-router-dom'
import { useSeo } from '../utils/seo'
import { getCategoryBySlug, getProducts, getSubSubcategories } from '../api/categories'
import type { Category, Product } from '../types'
import './CategoryDetail.css'

const PAGE_SIZE = 24

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<Category | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [subSubcategories, setSubSubcategories] = useState<{ name: string; slug: string }[]>([])
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState<string | null>(null)
  const [filterError, setFilterError] = useState(false)
  const [filterAttempt, setFilterAttempt] = useState(0)
  const { pathname } = useLocation()
  const root = pathname.split('/')[1]
  const categoryType = root === 'clothing' || root === 'accessories' || root === 'saree' ? root : undefined
  useSeo(
    category ? `${category.name} in Bahrain - Buy Indian ${category.name} Online | Moksha Collections` : undefined,
    category
      ? `Shop ${category.name.toLowerCase()} in Bahrain at Moksha Collections, Manama. Order online with delivery across Bahrain.`
      : undefined,
  )

  useEffect(() => {
    setPage(1)
    setSelectedSubSubcategory(null)
  }, [slug, categoryType])

  useEffect(() => {
    if (!slug || !categoryType) return
    let mounted = true
    setSubSubcategories([])
    setFilterError(false)
    getSubSubcategories(categoryType, slug)
      .then((items) => { if (mounted) setSubSubcategories(items) })
      .catch((error: unknown) => {
        console.error('Could not load sub-subcategories', error)
        if (mounted) setFilterError(true)
      })
    return () => { mounted = false }
  }, [slug, categoryType, filterAttempt])

  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    setLoadError(false)
    Promise.all([
      getCategoryBySlug(slug).catch(() => null),
      getProducts(categoryType, page, PAGE_SIZE, undefined, slug, {
        subSubcategorySlug: selectedSubSubcategory ?? undefined,
      }),
    ])
      .then(([categoryData, productData]) => {
        if (!mounted) return
        setCategory(categoryData)
        setProducts(productData.items)
        setTotalPages(productData.total_pages)
      })
      .catch((error: unknown) => {
        console.error('Could not load category products', error)
        if (!mounted) return
        setLoadError(true)
        setCategory(null)
        setProducts([])
        setTotalPages(1)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [slug, categoryType, page, selectedSubSubcategory, loadAttempt])

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <BrandLoader fullScreen={false} />
  const isAccessoriesDetail = pathname.startsWith('/accessories/')
  const fallbackName = (slug ?? 'collection')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  const backPath = category?.type ? `/${category.type}` : isAccessoriesDetail ? '/accessories' : '/'
  const isSareeDetail = category?.type === 'saree' || pathname.startsWith('/saree/')
  const backLabel = isSareeDetail ? 'Saree' : category?.type === 'accessories' || isAccessoriesDetail ? 'Accessories' : 'Clothing'

  return (
    <div className="container category-detail">
      <div className="section-heading">
        <span className="eyebrow">{backLabel}</span>
        <h1 className="section-title">{category?.name ?? fallbackName}</h1>
      </div>

      {filterError && <p role="alert">Could not load collection filters. <button type="button" onClick={() => setFilterAttempt((value) => value + 1)}>Try again</button></p>}
      {subSubcategories.length > 0 && (
        <div className="sub-subcategory-filters" role="group" aria-label="Filter by collection">
          <button type="button" className={`sub-subcategory-filter${selectedSubSubcategory === null ? ' is-selected' : ''}`} aria-pressed={selectedSubSubcategory === null} onClick={() => { setSelectedSubSubcategory(null); setPage(1) }}>
            <span className="sub-subcategory-all">All</span><span>All</span>
          </button>
          {subSubcategories.map((item) => (
            <button type="button" key={item.slug} className={`sub-subcategory-filter${selectedSubSubcategory === item.slug ? ' is-selected' : ''}`} aria-pressed={selectedSubSubcategory === item.slug} onClick={() => { setSelectedSubSubcategory(item.slug); setPage(1) }}>
              <PlaceholderImage alt={item.name} className="sub-subcategory-image" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {loadError ? (
        <div className="category-empty-state" role="alert">Could not load products. <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</button></div>
      ) : products.length === 0 ? (
        <div className="category-empty-state">
          <p>No products available in this collection yet.</p>
        </div>
      ) : (
        <>
          <div className="product-grid">
            {products.map((product) => (
              <Link key={product.id} to={`/product/${product.slug}`} className="product-card">
                <div className="product-card-image-wrap">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="product-card-image" loading="lazy" decoding="async" /> : <div className="product-card-image placeholder" role="img" aria-label="Moksha Collections"><span className="mc-mark">mc</span></div>}
                </div>
                <div className="product-card-body">
                  <h2>{product.name}</h2>
                  <p className="product-card-price"><PriceTag price={product.price} originalPrice={product.original_price} /></p>
                  <p className={`product-card-stock${product.stock_quantity <= 0 ? ' out-of-stock' : ''}`}>{product.stock_quantity > 0 ? `Stock on Hand: ${product.stock_quantity}` : 'Out of Stock'}</p>
                  {product.description && <p className="product-card-description">{product.description}</p>}
                </div>
              </Link>
            ))}
          </div>

          <div className="pagination-controls">
            <button type="button" className="btn btn-outline pagination-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span className="pagination-status">
              Page {page} of {totalPages}
            </span>
            <button type="button" className="btn btn-outline pagination-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </>
      )}

      <div className="category-detail-back">
        <Link to={backPath} className="btn btn-outline">
          Back to {backLabel}
        </Link>
      </div>
    </div>
  )
}
