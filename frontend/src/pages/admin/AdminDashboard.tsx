import { useEffect, useState } from 'react'
import { Users, Package, Undo2, TrendingUp } from 'lucide-react'
import {
  getAdminSettings,
  createCoupon,
  deleteCoupon,
  getCoupons,
  getDashboardStats,
  getDeliveryRates,
  updateAdminSettings,
  updateCoupon,
  updateDeliveryRate,
} from '../../api/admin'
import { AdminApiError } from '../../api/adminClient'
import type { AdminSettings, Coupon, CouponPayload, DashboardStats, DeliveryRate } from '../../types'
import './AdminDashboard.css'

interface CouponFormState {
  name: string
  percentage: number
  is_active: boolean
  valid_from: string
  valid_to: string
  minimum_cart_amount: number
}

function toLocalDateTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toUtcDateTime(value: string) {
  return new Date(value).toISOString()
}

function newCouponForm(): CouponFormState {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  return {
    name: '',
    percentage: 5,
    is_active: true,
    valid_from: toLocalDateTime(now.toISOString()),
    valid_to: toLocalDateTime(end.toISOString()),
    minimum_cart_amount: 20,
  }
}

function toCouponPayload(form: CouponFormState): CouponPayload {
  return {
    ...form,
    valid_from: toUtcDateTime(form.valid_from),
    valid_to: toUtcDateTime(form.valid_to),
  }
}

function couponApiErrorMessage(error: unknown, action: string) {
  if (error instanceof AdminApiError && error.status === 401) {
    return 'Your admin session expired. Sign in again, then retry.'
  }
  if (error instanceof AdminApiError && (error.status === 404 || error.status === 405)) {
    return 'Coupon API is unavailable in this backend. Restart or deploy the current backend, then retry.'
  }
  if (error instanceof AdminApiError && error.status >= 500) {
    return `Could not ${action} coupon. Confirm migration 010 completed successfully.`
  }
  return `Could not ${action} coupon. Check the fields and try again.`
}

const DELIVERY_LABELS: Record<string, string> = {
  bahrain: 'Bahrain (Local)',
  gcc: 'GCC',
  international: 'International',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [rates, setRates] = useState<DeliveryRate[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponForm, setCouponForm] = useState<CouponFormState>(newCouponForm)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingRate, setSavingRate] = useState<string | null>(null)
  const [savingCoupon, setSavingCoupon] = useState<string | null>(null)
  const [creatingCoupon, setCreatingCoupon] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    getDashboardStats().then(setStats)
    getAdminSettings().then(setSettings)
    getDeliveryRates().then(setRates)
    getCoupons().then(setCoupons).catch((error) => setMessage(couponApiErrorMessage(error, 'load')))
  }, [])

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const onSaveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const updated = await updateAdminSettings(settings)
      setSettings(updated)
      flash('Settings saved')
    } finally {
      setSavingSettings(false)
    }
  }

  const onSaveRate = async (rate: DeliveryRate) => {
    setSavingRate(rate.delivery_type)
    try {
      const updated = await updateDeliveryRate(rate.delivery_type, {
        rate_bhd: rate.rate_bhd,
        description: rate.description,
        delivery_days_from: rate.delivery_days_from,
        delivery_days_to: rate.delivery_days_to,
        free_delivery_over_bhd: rate.free_delivery_over_bhd ?? null,
      })
      if (!Number.isInteger(updated.delivery_days_from) || !Number.isInteger(updated.delivery_days_to)) {
        flash('Rate saved, but delivery day ranges were not returned by the API. Apply migration 009 and restart or deploy the backend.')
        return
      }
      setRates((prev) => prev.map((r) => (r.delivery_type === rate.delivery_type ? updated : r)))
      flash('Delivery rate saved')
    } finally {
      setSavingRate(null)
    }
  }

  const onCreateCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatingCoupon(true)
    try {
      const created = await createCoupon(toCouponPayload(couponForm))
      setCoupons((previous) => [...previous, created].sort((a, b) => a.minimum_cart_amount - b.minimum_cart_amount))
      setCouponForm(newCouponForm())
      flash('Coupon created')
    } catch (error) {
      flash(couponApiErrorMessage(error, 'create'))
    } finally {
      setCreatingCoupon(false)
    }
  }

  const onSaveCoupon = async (coupon: Coupon) => {
    setSavingCoupon(coupon.id)
    try {
      const updated = await updateCoupon(coupon.id, toCouponPayload({
        name: coupon.name,
        percentage: Number(coupon.percentage),
        is_active: coupon.is_active,
        valid_from: toLocalDateTime(coupon.valid_from),
        valid_to: toLocalDateTime(coupon.valid_to),
        minimum_cart_amount: Number(coupon.minimum_cart_amount),
      }))
      setCoupons((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      flash('Coupon saved')
    } catch (error) {
      flash(couponApiErrorMessage(error, 'save'))
    } finally {
      setSavingCoupon(null)
    }
  }

  const onDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon “${coupon.name}”?`)) return
    setSavingCoupon(coupon.id)
    try {
      await deleteCoupon(coupon.id)
      setCoupons((previous) => previous.filter((item) => item.id !== coupon.id))
      flash('Coupon deleted')
    } catch (error) {
      flash(couponApiErrorMessage(error, 'delete'))
    } finally {
      setSavingCoupon(null)
    }
  }

  const updateCouponField = (couponId: string, patch: Partial<Coupon>) => {
    setCoupons((previous) => previous.map((coupon) => coupon.id === couponId ? { ...coupon, ...patch } : coupon))
  }

  return (
    <div className="admin-dashboard">
      <div className="section-heading">
        <span className="eyebrow">Overview</span>
        <h1 className="section-title">Dashboard</h1>
      </div>

      {message && <div className="admin-flash">{message}</div>}

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <Users size={20} />
          <span className="admin-stat-value">{stats?.total_customers ?? '—'}</span>
          <span className="admin-stat-label">Total Customers</span>
        </div>
        <div className="admin-stat-card">
          <Package size={20} />
          <span className="admin-stat-value">{stats?.total_orders ?? '—'}</span>
          <span className="admin-stat-label">Total Orders</span>
        </div>
        <div className="admin-stat-card">
          <Undo2 size={20} />
          <span className="admin-stat-value">{stats?.total_returns ?? '—'}</span>
          <span className="admin-stat-label">Total Returns</span>
        </div>
        <div className="admin-stat-card">
          <TrendingUp size={20} />
          <span className="admin-stat-value">{stats?.profit_estimate?.toFixed(2) ?? '—'} BHD</span>
          <span className="admin-stat-label">Profit Estimate</span>
        </div>
      </div>

      {settings && (
        <div className="admin-panel">
          <h2>Payment &amp; Receipts</h2>
          <div className="admin-form-grid">
            <label>
              <span>IBAN Number</span>
              <input
                type="text"
                value={settings.iban_number ?? ''}
                onChange={(e) => setSettings({ ...settings, iban_number: e.target.value })}
                placeholder="BH00 XXXX 0000 0000 0000 00"
              />
            </label>
            <label>
              <span>WhatsApp Number for Receipts (with country code)</span>
              <input
                type="text"
                value={settings.whatsapp_number ?? ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                placeholder="97335521619"
              />
            </label>
            <label>
              <span>Return Window (days)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={settings.return_window_days}
                onChange={(e) => setSettings({ ...settings, return_window_days: Number(e.target.value) })}
              />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onSaveSettings} disabled={savingSettings}>
            {savingSettings ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      <div className="admin-panel">
        <h2>Delivery Rates</h2>
        <div className="admin-delivery-rates">
          {rates.map((rate) => (
            <div className="admin-delivery-rate-row" key={rate.delivery_type}>
              <h3>{DELIVERY_LABELS[rate.delivery_type] ?? rate.delivery_type}</h3>
              <label>
                <span>Rate (BHD)</span>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={rate.rate_bhd}
                  onChange={(e) =>
                    setRates((prev) =>
                      prev.map((r) => (r.delivery_type === rate.delivery_type ? { ...r, rate_bhd: Number(e.target.value) } : r)),
                    )
                  }
                />
              </label>
              <label>
                <span>Free delivery over (BHD)</span>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={rate.free_delivery_over_bhd ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setRates((prev) =>
                      prev.map((r) =>
                        r.delivery_type === rate.delivery_type
                          ? { ...r, free_delivery_over_bhd: value === '' ? null : Number(value) }
                          : r,
                      ),
                    )
                  }}
                  placeholder="Disabled"
                />
              </label>
              <div className="admin-delivery-day-range">
                <label>
                  <span>Approx. delivery from (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={rate.delivery_days_from}
                    onChange={(e) =>
                      setRates((prev) =>
                        prev.map((r) => (r.delivery_type === rate.delivery_type ? { ...r, delivery_days_from: Number(e.target.value) } : r)),
                      )
                    }
                  />
                </label>
                <label>
                  <span>Approx. delivery to (days)</span>
                  <input
                    type="number"
                    min={rate.delivery_days_from}
                    max={90}
                    value={rate.delivery_days_to}
                    onChange={(e) =>
                      setRates((prev) =>
                        prev.map((r) => (r.delivery_type === rate.delivery_type ? { ...r, delivery_days_to: Number(e.target.value) } : r)),
                      )
                    }
                  />
                </label>
              </div>
              <label>
                <span>Description shown to customers</span>
                <textarea
                  rows={2}
                  value={rate.description ?? ''}
                  onChange={(e) =>
                    setRates((prev) =>
                      prev.map((r) => (r.delivery_type === rate.delivery_type ? { ...r, description: e.target.value } : r)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onSaveRate(rate)}
                disabled={savingRate === rate.delivery_type}
              >
                {savingRate === rate.delivery_type ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-panel admin-coupons-panel">
        <h2>Coupons</h2>
        <form className="admin-coupon-form" onSubmit={onCreateCoupon}>
          <h3>Create Coupon</h3>
          <label>
            <span>Coupon name</span>
            <input required maxLength={100} value={couponForm.name} onChange={(event) => setCouponForm({ ...couponForm, name: event.target.value })} placeholder="e.g. 10% off over BHD 50" />
          </label>
          <label>
            <span>Percentage (%)</span>
            <input required type="number" min={0.01} max={100} step="0.01" value={couponForm.percentage} onChange={(event) => setCouponForm({ ...couponForm, percentage: Number(event.target.value) })} />
          </label>
          <label>
            <span>Minimum cart amount (BHD)</span>
            <input required type="number" min={0} step="0.001" value={couponForm.minimum_cart_amount} onChange={(event) => setCouponForm({ ...couponForm, minimum_cart_amount: Number(event.target.value) })} />
          </label>
          <label>
            <span>Valid from</span>
            <input required type="datetime-local" value={couponForm.valid_from} onChange={(event) => setCouponForm({ ...couponForm, valid_from: event.target.value })} />
          </label>
          <label>
            <span>Valid to</span>
            <input required type="datetime-local" min={couponForm.valid_from} value={couponForm.valid_to} onChange={(event) => setCouponForm({ ...couponForm, valid_to: event.target.value })} />
          </label>
          <label className="admin-coupon-switch-row">
            <span>Status</span>
            <span className="admin-coupon-switch-label">
              <input type="checkbox" role="switch" checked={couponForm.is_active} onChange={(event) => setCouponForm({ ...couponForm, is_active: event.target.checked })} />
              {couponForm.is_active ? 'Active' : 'Inactive'}
            </span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={creatingCoupon}>
            {creatingCoupon ? 'Creating…' : 'Create Coupon'}
          </button>
        </form>

        <div className="admin-coupon-list">
          {coupons.length === 0 ? <p className="admin-coupons-empty">No coupons created yet.</p> : coupons.map((coupon) => (
            <article className="admin-coupon-card" key={coupon.id}>
              <label>
                <span>Coupon name</span>
                <input value={coupon.name} maxLength={100} onChange={(event) => updateCouponField(coupon.id, { name: event.target.value })} />
              </label>
              <label>
                <span>Percentage (%)</span>
                <input type="number" min={0.01} max={100} step="0.01" value={coupon.percentage} onChange={(event) => updateCouponField(coupon.id, { percentage: Number(event.target.value) })} />
              </label>
              <label>
                <span>Minimum cart amount (BHD)</span>
                <input type="number" min={0} step="0.001" value={coupon.minimum_cart_amount} onChange={(event) => updateCouponField(coupon.id, { minimum_cart_amount: Number(event.target.value) })} />
              </label>
              <label>
                <span>Valid from</span>
                <input type="datetime-local" value={toLocalDateTime(coupon.valid_from)} onChange={(event) => updateCouponField(coupon.id, { valid_from: event.target.value })} />
              </label>
              <label>
                <span>Valid to</span>
                <input type="datetime-local" min={toLocalDateTime(coupon.valid_from)} value={toLocalDateTime(coupon.valid_to)} onChange={(event) => updateCouponField(coupon.id, { valid_to: event.target.value })} />
              </label>
              <label className="admin-coupon-switch-row">
                <span>Status</span>
                <span className="admin-coupon-switch-label">
                  <input type="checkbox" role="switch" checked={coupon.is_active} onChange={(event) => updateCouponField(coupon.id, { is_active: event.target.checked })} />
                  {coupon.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
              <div className="admin-coupon-actions">
                <button type="button" className="btn btn-outline" disabled={savingCoupon === coupon.id} onClick={() => onSaveCoupon(coupon)}>
                  {savingCoupon === coupon.id ? 'Saving…' : 'Save Coupon'}
                </button>
                <button type="button" className="admin-coupon-delete" disabled={savingCoupon === coupon.id} onClick={() => onDeleteCoupon(coupon)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
