import { useEffect, useState, type FormEvent } from 'react'
import { Percent, Trash2, Pencil } from 'lucide-react'
import {
  getDiscounts,
  removeDiscount,
  saveDiscount,
  searchZohoSyncProducts,
} from '../../api/admin'
import type { DiscountedProduct, ZohoSyncProduct } from '../../api/admin'
import './AdminCustomers.css'
import './AdminDiscounts.css'

const money = (v: number | null | undefined) => `BHD ${Number(v ?? 0).toFixed(3)}`

// <input type="datetime-local"> works in local time without a zone, e.g. 2026-11-03T17:30
const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [d ? `${d}d` : '', d || h ? `${h}h` : '', `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

type PickedProduct = Pick<ZohoSyncProduct, 'id' | 'zoho_sku' | 'name' | 'image_url' | 'stock_quantity'> & { price: number | null }

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export default function AdminDiscounts() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ZohoSyncProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PickedProduct | null>(null)
  const [discountPrice, setDiscountPrice] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [discounts, setDiscounts] = useState<DiscountedProduct[]>([])
  const [listError, setListError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const loadDiscounts = () =>
    getDiscounts()
      .then((res) => {
        setDiscounts(res)
        setListError('')
      })
      .catch((err) => setListError(errorMessage(err, 'Could not load discounts.')))

  useEffect(() => {
    void loadDiscounts()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

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

  const pick = (product: PickedProduct, existing?: DiscountedProduct) => {
    setSelected(product)
    setError('')
    setNotice('')
    if (existing) {
      setDiscountPrice(String(existing.discount_price))
      setStartsAt(toLocalInput(new Date(existing.discount_starts_at)))
      setEndsAt(toLocalInput(new Date(existing.discount_ends_at)))
    } else {
      const start = new Date()
      setDiscountPrice('')
      setStartsAt(toLocalInput(start))
      setEndsAt(toLocalInput(new Date(start.getTime() + 7 * 86400000)))
    }
  }

  const priceNumber = Number(discountPrice)
  const currentPrice = Number(selected?.price ?? 0)
  const percentOff = currentPrice > 0 && priceNumber > 0 ? Math.round((1 - priceNumber / currentPrice) * 100) : 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setError('')
    setNotice('')
    if (!(priceNumber > 0)) return setError('Enter the discount price.')
    if (priceNumber >= currentPrice) return setError('The discount price must be lower than the current price.')
    if (!startsAt || !endsAt) return setError('Choose the start and end date.')
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (end <= start) return setError('The end date must be after the start date.')
    if (end.getTime() <= Date.now()) return setError('The end date is already in the past.')

    setSaving(true)
    try {
      await saveDiscount(selected.id, {
        discount_price: priceNumber,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      })
      setNotice(`Discount saved for ${selected.zoho_sku}.`)
      setSelected(null)
      setDiscountPrice('')
      await loadDiscounts()
    } catch (err) {
      setError(errorMessage(err, 'Could not save the discount. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: DiscountedProduct) => {
    if (!window.confirm(`Remove the discount on ${item.zoho_sku}?`)) return
    try {
      await removeDiscount(item.id)
      if (selected?.id === item.id) setSelected(null)
      await loadDiscounts()
    } catch (err) {
      setListError(errorMessage(err, 'Could not remove the discount.'))
    }
  }

  const status = (item: DiscountedProduct) => {
    const start = Date.parse(item.discount_starts_at)
    const end = Date.parse(item.discount_ends_at)
    if (now >= end) return { key: 'expired', label: 'Ended', detail: `Ended ${formatWhen(item.discount_ends_at)}` }
    if (now < start) return { key: 'scheduled', label: 'Scheduled', detail: `Starts in ${formatDuration(start - now)}` }
    return { key: 'active', label: 'Live', detail: `${formatDuration(end - now)} left` }
  }

  return (
    <div className="admin-discounts">
      <h1><Percent size={20} /> Discounts</h1>
      <p className="admin-discounts-lead">
        Search a product by SKU, set a discount price and the dates. The website shows the old price cut
        through and the new price highlighted, only while the discount is running.
      </p>

      <input
        className="admin-customer-search"
        placeholder="Search SKU, e.g. BN-FNCY-001"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p>Searching…</p>}
      {!searching && query.trim() && results.length === 0 && <p>No product found for this SKU.</p>}

      <div className="admin-discounts-results">
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`admin-discounts-result${selected?.id === p.id ? ' is-selected' : ''}`}
            onClick={() => pick(p, discounts.find((d) => d.id === p.id))}
          >
            {p.image_url ? <img src={p.image_url} alt="" width={48} height={48} /> : <span className="admin-discounts-thumb" />}
            <span>
              <strong>{p.zoho_sku}</strong>
              <br />
              {p.name}
              <br />
              <small>Current price {money(p.price)} · Stock {p.stock_quantity ?? 0}</small>
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <form className="admin-discounts-form" onSubmit={submit}>
          <div className="admin-discounts-selected">
            {selected.image_url ? <img src={selected.image_url} alt="" width={64} height={64} /> : <span className="admin-discounts-thumb big" />}
            <div>
              <strong>{selected.zoho_sku}</strong>
              <div>{selected.name}</div>
              <div className="admin-discounts-current">Current price: <b>{money(selected.price)}</b></div>
            </div>
          </div>

          <label>
            Discount price (BHD)
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={discountPrice}
              onChange={(e) => setDiscountPrice(e.target.value)}
              placeholder="e.g. 7.500"
              required
            />
          </label>
          {percentOff > 0 && <p className="admin-discounts-percent">{percentOff}% off</p>}

          <div className="admin-discounts-dates">
            <label>
              Start date &amp; time
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>
            <label>
              End date &amp; time
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </label>
          </div>

          {error && <p className="admin-discounts-error" role="alert">{error}</p>}
          <div className="admin-discounts-actions">
            <button type="submit" className="admin-discounts-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save discount'}
            </button>
            <button type="button" className="admin-discounts-cancel" onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </form>
      )}

      {notice && <p className="admin-discounts-notice" role="status">{notice}</p>}

      <h2 className="admin-discounts-heading">Discounted products</h2>
      {listError && <p className="admin-discounts-error" role="alert">{listError}</p>}
      {!listError && discounts.length === 0 && <p className="admin-discounts-empty">No discounts yet.</p>}
      <div className="admin-discounts-grid">
        {discounts.map((item) => {
          const st = status(item)
          return (
            <article key={item.id} className={`admin-discount-card is-${st.key}`}>
              <div className="admin-discount-card-top">
                {item.image_url ? <img src={item.image_url} alt="" width={56} height={56} /> : <span className="admin-discounts-thumb big" />}
                <div>
                  <strong>{item.zoho_sku}</strong>
                  <div>{item.name}</div>
                </div>
                <span className={`admin-discount-badge is-${st.key}`}>{st.label}</span>
              </div>
              <div className="admin-discount-prices">
                <s>{money(item.price)}</s>
                <b>{money(item.discount_price)}</b>
              </div>
              <div className="admin-discount-time" aria-live="off">{st.detail}</div>
              <small>{formatWhen(item.discount_starts_at)} → {formatWhen(item.discount_ends_at)}</small>
              <div className="admin-discounts-actions">
                <button
                  type="button"
                  className="admin-discounts-cancel"
                  onClick={() => {
                    pick(item, item)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button type="button" className="admin-discounts-remove" onClick={() => void remove(item)}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
