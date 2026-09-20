import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { getAdminCustomerDetail, getAdminCustomers, setCustomerBan } from '../../api/admin'
import type { AdminCustomer, AdminCustomerDetail } from '../../types'
import './AdminCustomers.css'

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminCustomerDetail | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = (query?: string) => getAdminCustomers(query).then(setCustomers)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => load(search || undefined), 300)
    return () => clearTimeout(timeout)
  }, [search])

  const openDetail = async (customerId: string) => {
    const detail = await getAdminCustomerDetail(customerId)
    setSelected(detail)
  }

  const toggleBan = async (customer: AdminCustomer) => {
    setBusyId(customer.id)
    try {
      const updated = await setCustomerBan(customer.id, !customer.is_banned)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      if (selected && selected.id === updated.id) setSelected({ ...selected, is_banned: updated.is_banned })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-customers">
      <div className="section-heading">
        <span className="eyebrow">CRM</span>
        <h1 className="section-title">Customers</h1>
      </div>

      <div className="admin-customer-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-customer-table">
        {customers.map((customer) => (
          <button type="button" key={customer.id} className="admin-customer-row" onClick={() => openDetail(customer.id)}>
            <div>
              <strong>{customer.first_name} {customer.last_name}</strong>
              <span>{customer.email}</span>
            </div>
            <div className="admin-customer-row-meta">
              <span>{customer.phone_country_code} {customer.phone}</span>
              {customer.is_banned && <span className="admin-customer-banned-tag">Banned</span>}
            </div>
            <span
              className="admin-customer-ban-btn"
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                void toggleBan(customer)
              }}
              aria-disabled={busyId === customer.id}
            >
              {customer.is_banned ? 'Unban' : 'Ban'}
            </span>
          </button>
        ))}
        {customers.length === 0 && <p className="admin-orders-empty">No customers found.</p>}
      </div>

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{selected.first_name} {selected.last_name}</h2>
              <button type="button" onClick={() => setSelected(null)}>&times;</button>
            </header>
            <p>{selected.email}</p>
            <p>{selected.phone_country_code} {selected.phone}</p>
            <p>{selected.country_name}</p>
            <p>Joined {new Date(selected.created_at).toLocaleDateString()}</p>
            <button type="button" className="btn btn-outline" onClick={() => toggleBan(selected)}>
              {selected.is_banned ? 'Unban Customer' : 'Ban Customer'}
            </button>

            <h3>Addresses</h3>
            {selected.addresses.length === 0 && <p className="admin-orders-empty">No saved addresses.</p>}
            <ul className="admin-modal-list">
              {selected.addresses.map((a) => (
                <li key={a.id}>
                  {a.full_name} — {[a.address_line1, a.city, a.country_name].filter(Boolean).join(', ')}
                </li>
              ))}
            </ul>

            <h3>Orders</h3>
            {selected.orders.length === 0 && <p className="admin-orders-empty">No orders yet.</p>}
            <ul className="admin-modal-list">
              {selected.orders.map((o) => (
                <li key={o.id}>
                  #{o.id.slice(0, 8)} — {o.status} — {o.total_amount.toFixed(3)} BHD
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
