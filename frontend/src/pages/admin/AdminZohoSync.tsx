import { useEffect, useState } from 'react'
import { refreshProductFromZoho, searchZohoSyncProducts } from '../../api/admin'
import type { ZohoRefreshResult, ZohoSyncProduct } from '../../api/admin'
import './AdminCustomers.css'

const money = (v: number | null) => (v == null ? '-' : `BHD ${Number(v).toFixed(3)}`)

export default function AdminZohoSync() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ZohoSyncProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ZohoSyncProduct | null>(null)
  const [fetching, setFetching] = useState(false)
  const [result, setResult] = useState<ZohoRefreshResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchZohoSyncProducts(term)
        .then((res) => setResults(res))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const fetchToDatabase = async () => {
    if (!selected) return
    setFetching(true)
    setError('')
    setResult(null)
    try {
      const res = await refreshProductFromZoho(selected.zoho_sku)
      setResult(res)
      setSelected(res.product)
      setResults((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)))
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Could not fetch this item from Zoho. Please try again.')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Manual sync from Zoho</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Search a product by SKU, select it, then fetch all its details and image from Zoho again.
      </p>

      <input
        className="admin-customer-search"
        placeholder="Search SKU, e.g. BN-FNCY-001"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p>Searching…</p>}
      {!searching && query.trim() && results.length === 0 && <p>No product found for this SKU.</p>}

      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
        {results.map((p) => {
          const active = selected?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelected(p)
                setResult(null)
                setError('')
              }}
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                textAlign: 'left',
                padding: '0.6rem',
                border: active ? '2px solid #7a1f3d' : '1px solid #ddd',
                borderRadius: 8,
                background: active ? '#fbf1f4' : '#fff',
                cursor: 'pointer',
              }}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" width={52} height={52} style={{ objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 52, height: 52, background: '#eee', borderRadius: 6 }} />
              )}
              <span style={{ flex: 1 }}>
                <strong>{p.zoho_sku}</strong>
                <br />
                {p.name}
                <br />
                <small>
                  Stock {p.stock_quantity ?? 0} · {money(p.price)}
                  {!p.is_active ? ' · inactive' : ''}
                </small>
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={fetchToDatabase}
        disabled={!selected || fetching}
        style={{
          marginTop: '1rem',
          padding: '0.7rem 1.2rem',
          borderRadius: 8,
          border: 'none',
          background: !selected || fetching ? '#bbb' : '#7a1f3d',
          color: '#fff',
          cursor: !selected || fetching ? 'not-allowed' : 'pointer',
        }}
      >
        {fetching ? 'Fetching from Zoho…' : selected ? `Fetch to database (${selected.zoho_sku})` : 'Fetch to database'}
      </button>

      {error && <p style={{ color: '#b00020', marginTop: '0.75rem' }}>{error}</p>}
      {result && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #cde5cd', borderRadius: 8, background: '#f3fbf3' }}>
          <strong>Updated {result.sku}</strong>
          <p style={{ margin: '0.3rem 0' }}>
            Changed fields: {result.changed_fields.length ? result.changed_fields.join(', ') : 'none (already up to date)'}
          </p>
          <p style={{ margin: 0 }}>Image: {result.image_refreshed ? 'refreshed from Zoho' : 'no image in Zoho, kept existing'}</p>
        </div>
      )}
    </div>
  )
}

