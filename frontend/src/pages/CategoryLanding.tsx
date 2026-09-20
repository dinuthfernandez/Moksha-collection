import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryTree, getProducts } from '../api/categories'
import type { Category, CategoryType, Product } from '../types'
import CategoryCard from '../components/ui/CategoryCard'
import EmptyState from '../components/ui/EmptyState'
import CategoryHeroCarousel from '../components/ui/CategoryHeroCarousel'
import EditorialSpotlight from '../components/ui/EditorialSpotlight'
import Reveal from '../components/ui/Reveal'
import './CategoryLanding.css'

const PAGE_SIZE = 24

interface CategoryLandingProps {
  type: CategoryType
  title: string
  description: string
}

const CONTENT: Record<
  CategoryType,
  {
    heroEyebrow: string
    heroTitle: string
    heroHighlight: string
    heroSubtitle: string
    heroSets: { large: string; smallTop: string; smallBottom: string }[]
    editorialTitle: string
    editorialHighlight: string
    editorialCaption: string
    categoryGridTitle: string
  }
> = {
  clothing: {
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
    editorialTitle: 'Definitive',
    editorialHighlight: 'Pieces',
    editorialCaption: 'Style captured, not staged — a glimpse of the Moksha woman.',
    categoryGridTitle: 'Clothing Categories',
  },
  accessories: {
    heroEyebrow: 'Finishing Touches',
    heroTitle: 'Details That',
    heroHighlight: 'Define You.',
    heroSubtitle:
      'From statement jewellery to considered everyday essentials — the pieces that complete every look.',
    heroSets: [
      {
        large: '/assets/category/DSC_5679.jpg.jpeg',
        smallTop: '/assets/category/DSC_5516.jpg.jpeg',
        smallBottom: '/assets/category/DSC_5650.jpg.jpeg',
      },
      {
        large: '/assets/category/DSC_5704.jpg.jpeg',
        smallTop: '/assets/category/DSC_5742.jpg.jpeg',
        smallBottom: '/assets/category/DSC_5685.jpg.jpeg',
      },
    ],
    editorialTitle: 'Timeless',
    editorialHighlight: 'Details',
    editorialCaption: 'Small details, considered finishing — the Moksha signature.',
    categoryGridTitle: 'Accessories Categories',
  },
}

const EDITORIAL_IMAGES = [
  '/assets/category/DSC_5595.jpg.jpeg',
  '/assets/category/DSC_5550.jpg.jpeg',
  '/assets/category/DSC_5696.jpg.jpeg',
  '/assets/category/DSC_5607.jpg.jpeg',
]

export default function CategoryLanding({ type, description }: CategoryLandingProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)

  const [loading, setLoading] = useState(true)
  const content = CONTENT[type]

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getCategoryTree(type)
      .then((data) => mounted && setCategories(data))
      .catch(() => mounted && setCategories([]))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [type])

  useEffect(() => {
    let mounted = true
    setNewArrivalsLoading(true)
    getProducts(type, 1, 8)
      .then((data) => mounted && setNewArrivals(data.items))
      .catch(() => mounted && setNewArrivals([]))
      .finally(() => mounted && setNewArrivalsLoading(false))
    return () => {
      mounted = false
    }
  }, [type])

  useEffect(() => {
    setPage(1)
  }, [type])

  useEffect(() => {
    let mounted = true
    setProductsLoading(true)
    getProducts(type, page, PAGE_SIZE)
      .then((data) => {
        if (!mounted) return
        setProducts(data.items)
        setTotalPages(data.total_pages)
        setTotal(data.total)
      })
      .catch(() => {
        if (!mounted) return
        setProducts([])
        setTotalPages(1)
        setTotal(0)
      })
      .finally(() => mounted && setProductsLoading(false))
    return () => {
      mounted = false
    }
  }, [type, page])

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="category-landing">
      <CategoryHeroCarousel
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        highlight={content.heroHighlight}
        subtitle={content.heroSubtitle}
        sets={content.heroSets}
      />

      <Reveal as="section" className="container category-landing-section">
        <div className="section-heading">
          <span className="eyebrow">Curated Collection</span>
          <h2 className="section-title">New Arrivals</h2>
          <p className="section-subtitle">{description}</p>
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

      <Reveal>
        <EditorialSpotlight
          eyebrow="Our Edit"
          title={content.editorialTitle}
          highlight={content.editorialHighlight}
          caption={content.editorialCaption}
          images={EDITORIAL_IMAGES}
        />
      </Reveal>

      <Reveal as="section" className="container category-landing-section">
        <div className="section-heading">
          <span className="eyebrow">Full Catalogue</span>
          <h2 className="section-title">All Products</h2>
          {total > 0 && <p className="section-subtitle">{total} products available</p>}
        </div>

        {!productsLoading && products.length === 0 && (
          <EmptyState
            title="No Products Found"
            message="We're curating this collection with care. Check back shortly."
          />
        )}

        {products.length > 0 && (
          <>
            <div className="product-grid">
              {products.map((product) => (
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

            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-outline pagination-btn"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline pagination-btn"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Reveal>

      <Reveal as="section" className="container category-landing-section">
        <div className="section-heading">
          <span className="eyebrow">Shop By</span>
          <h2 className="section-title">{content.categoryGridTitle}</h2>
        </div>

        {!loading && categories.length === 0 && (
          <EmptyState
            title="Categories Coming Soon"
            message="We're organising this edit into categories — check back shortly or message us on WhatsApp."
          />
        )}

        {categories.length > 0 && (
          <div className="category-landing-grid">
            {categories.map((c) => (
              <CategoryCard key={c.id} category={c} basePath={`/${type}`} />
            ))}
          </div>
        )}
      </Reveal>
    </div>
  )
}
