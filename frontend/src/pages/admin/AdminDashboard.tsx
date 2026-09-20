import { useEffect, useState } from 'react'
import { Users, Package, Undo2, TrendingUp } from 'lucide-react'
import {
  getAdminSettings,
  getDashboardStats,
  getDeliveryRates,
  updateAdminSettings,
  updateDeliveryRate,
} from '../../api/admin'
import type { AdminSettings, DashboardStats, DeliveryRate } from '../../types'
import './AdminDashboard.css'

const DELIVERY_LABELS: Record<string, string> = {
  bahrain: 'Bahrain (Local)',
  gcc: 'GCC',
  international: 'International',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [rates, setRates] = useState<DeliveryRate[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingRate, setSavingRate] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    getDashboardStats().then(setStats)
    getAdminSettings().then(setSettings)
    getDeliveryRates().then(setRates)
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
      })
      setRates((prev) => prev.map((r) => (r.delivery_type === rate.delivery_type ? updated : r)))
      flash('Delivery rate saved')
    } finally {
      setSavingRate(null)
    }
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
    </div>
  )
}
