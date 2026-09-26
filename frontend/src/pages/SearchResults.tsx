import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { searchProducts } from '../api/categories'
import type { Product } from '../types'
import './SearchResults.css'

const PAGE_SIZE = 24

function readPrice(value: string | null) {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const minParam = searchParams.get('min_price')
  const maxParam = searchParams.get('max_price')
  const [minimum, setMinimum] = useState(minParam ?? '')
  const [maximum, setMaximum] = useState(maxParam ?? '')
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    setMinimum(minParam ?? '')
    setMaximum(maxParam ?? '')
  }, [minParam, maxParam])

  useEffect(() => {
    if (!query) {
      setProducts([])
      setTotal(0)
      setTotalPages(1)
      setLoading(false)
      setError('')
      return
    }

    let active = true
    setLoading(true)
    setError('')
    searchProducts(query, page, PAGE_SIZE, readPrice(minParam), readPrice(maxParam))
      .then((result) => {
        if (!active) return
        setProducts(result.items)
        setTotal(result.total)
        setTotalPages(result.total_pages)
      })
      .catch(() => {
        if (!active) return
        setProducts([])
        setTotal(0)
        setTotalPages(1)
        setError('Search is temporarily unavailable. Please try again.')
      })
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [query, page, minParam, maxParam])

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const min = readPrice(minimum || null)
    const max = readPrice(maximum || null)
    if (minimum && min === undefined || maximum && max === undefined) {
      setFilterError('Enter a valid price of 0 or more.')
      return
    }
    if (min !== undefined && max !== undefined && min > max) {
      setFilterError('Minimum price must not exceed maximum price.')
      return
    }

    const next = new URLSearchParams({ q: query })
    if (min !== undefined) next.set('min_price', String(min))
    if (max !== undefined) next.set('max_price', String(max))
    setFilterError('')
    setSearchParams(next)
  }

  const clearFilters = () => {
    setMinimum('')
    setMaximum('')
    setFilterError('')
    setSearchParams(query ? { q: query } : {})
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="search-results-page container">
      <div className="search-results-heading">
        <span className="eyebrow">Moksha Collections</span>
        <h1>Search results</h1>
        {query ? (
          <p>Showing matches for <strong>“{query}”</strong>{!loading && ` · ${total} ${total === 1 ? 'item' : 'items'}`}</p>
        ) : (
          <p>Search by product name or product code.</p>
        )}
      </div>

      <div className="search-results-layout">
        <aside className="search-filter-panel" aria-label="Filter results">
          <div className="search-filter-heading">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>Price range</h2>
          </div>
          <form onSubmit={applyFilters}>
            <label>
              Minimum (BHD)
              <input type="number" min="0" step="0.1" inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="0.000" />
            </label>
            <label>
              Maximum (BHD)
              <input type="number" min="0" step="0.1" inputMode="decimal" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="No limit" />
            </label>
            {filterError && <p className="search-filter-error" role="alert">{filterError}</p>}
            <button type="submit" className="btn btn-primary search-filter-apply">Apply filters</button>
            <button type="button" className="search-filter-clear" onClick={clearFilters}>Clear price range</button>
          </form>
        </aside>

        <div className="search-results-content" aria-live="polite">
          {!query ? (
            <div className="search-empty-state">
              <Search size={26} aria-hidden="true" />
              <h2>What are you looking for?</h2>
              <p>Enter a product name or code in the header search.</p>
            </div>
          ) : loading ? (
            <p className="search-status">Searching the collection…</p>
          ) : error ? (
            <p className="search-status search-status-error" role="alert">{error}</p>
          ) : products.length === 0 ? (
            <div className="search-empty-state">
              <Search size={26} aria-hidden="true" />
              <h2>No matching products</h2>
              <p>Try a different name or code, or widen the price range.</p>
            </div>
          ) : (
            <>
              <div className="search-product-grid">
                {products.map((product) => (
                  <Link key={product.id} to={`/product/${product.slug}`} className="search-product-card">
                    <div className="search-product-image-wrap">
                      {product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>No Image</span>}
                    </div>
                    <div className="search-product-body">
                      <h2>{product.name}</h2>
                      <p className="search-product-code">Code: {product.product_code ?? product.zoho_sku ?? product.id.slice(0, 12).toUpperCase()}</p>
                      <p className="search-product-price">BHD {Number(product.price || 0).toFixed(3)}</p>
                    </div>
                  </Link>
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="search-pagination" aria-label="Search result pages">
                  <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" className="btn btn-outline" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Next</button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
