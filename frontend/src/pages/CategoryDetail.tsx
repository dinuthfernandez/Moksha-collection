import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCategoryBySlug, getProducts } from '../api/categories'
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

  useEffect(() => {
    setPage(1)
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    Promise.all([
      getCategoryBySlug(slug),
      getProducts(slug === 'accessories' || slug === 'clothing' ? slug : undefined, page, PAGE_SIZE),
    ])
      .then(([categoryData, productData]) => {
        if (!mounted) return
        setCategory(categoryData)
        setProducts(productData.items)
        setTotalPages(productData.total_pages)
      })
      .catch(() => {
        if (!mounted) return
        setCategory(null)
        setProducts([])
        setTotalPages(1)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [slug, page])

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="container category-detail" />

  return (
    <div className="container category-detail">
      <div className="section-heading">
        <span className="eyebrow">{category?.type === 'accessories' ? 'Accessories' : 'Clothing'}</span>
        <h1 className="section-title">{category?.name ?? 'Collection'}</h1>
      </div>

      {products.length === 0 ? (
        <div className="category-empty-state">
          <p>No products available in this collection yet.</p>
        </div>
      ) : (
        <>
          <div className="product-grid">
            {products.map((product) => (
              <Link key={product.id} to={`/product/${product.slug}`} className="product-card">
                <div className="product-card-image-wrap">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="product-card-image" /> : <div className="product-card-image placeholder">No Image</div>}
                </div>
                <div className="product-card-body">
                  <h2>{product.name}</h2>
                  <p className="product-card-price">BHD {Number(product.price || 0).toFixed(2)}</p>
                  <p className="product-card-stock">Stock on Hand: {product.stock_quantity}</p>
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
        <Link to={category?.type ? `/${category.type}` : '/'} className="btn btn-outline">
          Back to {category?.type === 'accessories' ? 'Accessories' : 'Clothing'}
        </Link>
      </div>
    </div>
  )
}
