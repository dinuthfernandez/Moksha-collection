import { useEffect, useState } from 'react'
import { createAddress, deleteAddress, getAddresses, updateAddress } from '../api/addresses'
import type { Address, AddressPayload } from '../types'
import { COUNTRIES, findCountry } from '../data/countries'
import { BAHRAIN_GOVERNORATES, GCC_REGIONS, getAddressTier } from '../data/addressTiers'
import { useAuth } from '../context/AuthContext'
import CountryCodeSelect from '../components/ui/CountryCodeSelect'
import EmptyState from '../components/ui/EmptyState'
import './Addresses.css'

const BASE_EMPTY_FORM: AddressPayload = {
  label: 'Home',
  full_name: '',
  phone_country_code: '+973',
  phone: '',
  country_code: 'BH',
  country_name: 'Bahrain',
  address_line1: '',
  address_line2: '',
  city: '',
  state_region: '',
  postal_code: '',
  block_number: '',
  road_number: '',
  building_name: '',
  apartment_number: '',
  district: '',
  tax_id: '',
  delivery_notes: '',
  is_default: false,
}

export default function Addresses() {
  const { customer } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<AddressPayload>(BASE_EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getAddresses()
      .then(setAddresses)
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const emptyFormForNewAddress = (): AddressPayload => {
    if (!customer?.country_code) return BASE_EMPTY_FORM
    const country = findCountry(customer.country_code)
    return {
      ...BASE_EMPTY_FORM,
      country_code: customer.country_code,
      country_name: customer.country_name ?? country?.name ?? BASE_EMPTY_FORM.country_name,
      phone_country_code: country?.dialCode ?? BASE_EMPTY_FORM.phone_country_code,
    }
  }

  const startAdd = () => {
    setForm(emptyFormForNewAddress())
    setEditingId('new')
    setError(null)
  }

  const startEdit = (address: Address) => {
    const { id, customer_id, created_at, ...rest } = address
    void id
    void customer_id
    void created_at
    setForm({ ...BASE_EMPTY_FORM, ...rest })
    setEditingId(address.id)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(BASE_EMPTY_FORM)
  }

  const onCountryChange = (code: string) => {
    const country = findCountry(code)
    setForm((f) => ({
      ...f,
      country_code: code,
      country_name: country?.name ?? f.country_name,
      phone_country_code: country?.dialCode ?? f.phone_country_code,
    }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editingId === 'new') {
        await createAddress(form)
      } else if (editingId) {
        await updateAddress(editingId, form)
      }
      cancelEdit()
      load()
    } catch {
      setError('Could not save this address. Please check the details and try again.')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Remove this address?')) return
    await deleteAddress(id)
    load()
  }

  const tier = getAddressTier(form.country_code)
  const gccRegions = GCC_REGIONS[form.country_code] ?? []

  return (
    <div className="container addresses-page">
      <div className="section-heading">
        <span className="eyebrow">Delivery</span>
        <h1 className="section-title">Delivery Addresses</h1>
        <p className="section-subtitle">Add addresses anywhere in the world — we'll confirm delivery options at checkout.</p>
      </div>

      {!editingId && (
        <div className="addresses-toolbar">
          <button className="btn btn-primary" onClick={startAdd}>
            Add New Address
          </button>
        </div>
      )}

      {editingId && (
        <form className="address-form" onSubmit={onSubmit}>
          {error && <p className="auth-form-error">{error}</p>}

          <div className="address-form-row">
            <label>
              <span>Label</span>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Home, Work..." />
            </label>
            <label>
              <span>Full name</span>
              <input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </label>
          </div>

          <label>
            <span>Phone number</span>
            <div className="phone-field">
              <CountryCodeSelect
                value={form.phone_country_code}
                onChange={(dialCode) => setForm((f) => ({ ...f, phone_country_code: dialCode }))}
              />
              <input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </label>

          <label>
            <span>Country</span>
            <select required value={form.country_code} onChange={(e) => onCountryChange(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {tier === 'bahrain' && (
            <>
              <label>
                <span>Governorate</span>
                <select
                  required
                  value={form.state_region ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, state_region: e.target.value }))}
                >
                  <option value="" disabled>
                    Select governorate
                  </option>
                  {BAHRAIN_GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>

              <div className="address-form-row">
                <label>
                  <span>Block Number</span>
                  <input
                    required
                    value={form.block_number ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, block_number: e.target.value }))}
                    placeholder="e.g. 317"
                  />
                </label>
                <label>
                  <span>Road / Street Number</span>
                  <input
                    required
                    value={form.road_number ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, road_number: e.target.value }))}
                    placeholder="e.g. Road 1704"
                  />
                </label>
              </div>

              <div className="address-form-row">
                <label>
                  <span>Building / House Name &amp; Number</span>
                  <input
                    required
                    value={form.building_name ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, building_name: e.target.value }))}
                    placeholder="e.g. Building 220"
                  />
                </label>
                <label>
                  <span>Apartment / Flat / Office (optional)</span>
                  <input
                    value={form.apartment_number ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, apartment_number: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                <span>Delivery Instructions / Landmark (optional)</span>
                <textarea
                  rows={3}
                  value={form.delivery_notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_notes: e.target.value }))}
                  placeholder='e.g. "Near the petrol station"'
                />
              </label>
            </>
          )}

          {tier === 'gcc' && (
            <>
              <div className="address-form-row">
                <label>
                  <span>State / Province / Emirate</span>
                  {gccRegions.length > 0 ? (
                    <select
                      required
                      value={form.state_region ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, state_region: e.target.value }))}
                    >
                      <option value="" disabled>
                        Select region
                      </option>
                      {gccRegions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={form.state_region ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, state_region: e.target.value }))}
                    />
                  )}
                </label>
                <label>
                  <span>City</span>
                  <input required value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </label>
              </div>

              <label>
                <span>District / Neighborhood</span>
                <input required value={form.district ?? ''} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </label>

              <label>
                <span>Street Name / Number</span>
                <input
                  required
                  value={form.address_line1 ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                />
              </label>

              <div className="address-form-row">
                <label>
                  <span>Building / Villa Number / Unit No</span>
                  <input
                    required
                    value={form.building_name ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, building_name: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Postal Code / National Address Shortcode (optional)</span>
                  <input
                    value={form.postal_code ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                    placeholder="e.g. ABCD1234"
                  />
                </label>
              </div>

              <label>
                <span>Delivery notes (optional)</span>
                <textarea rows={3} value={form.delivery_notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, delivery_notes: e.target.value }))} />
              </label>
            </>
          )}

          {tier === 'international' && (
            <>
              <label>
                <span>Street Address Line 1</span>
                <input
                  required
                  value={form.address_line1 ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                />
              </label>
              <label>
                <span>Street Address Line 2 (optional)</span>
                <input value={form.address_line2 ?? ''} onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))} />
              </label>

              <div className="address-form-row">
                <label>
                  <span>City / Town</span>
                  <input required value={form.city ?? ''} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </label>
                <label>
                  <span>State / Province / Region</span>
                  <input
                    required
                    value={form.state_region ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, state_region: e.target.value }))}
                  />
                </label>
              </div>

              <div className="address-form-row">
                <label>
                  <span>Postal / ZIP Code</span>
                  <input required value={form.postal_code ?? ''} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
                </label>
                <label>
                  <span>Tax ID / VAT Number (optional)</span>
                  <input value={form.tax_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} />
                </label>
              </div>

              <label>
                <span>Delivery notes (optional)</span>
                <textarea rows={3} value={form.delivery_notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, delivery_notes: e.target.value }))} />
              </label>
            </>
          )}

          <label className="address-checkbox">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
            <span>Set as default delivery address</span>
          </label>

          <div className="address-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Address'}
            </button>
            <button className="btn btn-outline" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!loading && !editingId && addresses.length === 0 && (
        <EmptyState title="No Addresses Yet" message="Add your first delivery address to speed up checkout." />
      )}

      {!editingId && addresses.length > 0 && (
        <ul className="address-list">
          {addresses.map((a) => (
            <li key={a.id} className="address-card">
              {a.is_default && <span className="address-default-badge">Default</span>}
              <h3>{a.label}</h3>
              <p>{a.full_name}</p>
              <p>
                {a.phone_country_code} {a.phone}
              </p>
              {getAddressTier(a.country_code) === 'bahrain' ? (
                <>
                  <p>
                    Block {a.block_number}, Road {a.road_number}
                  </p>
                  <p>
                    {a.building_name}
                    {a.apartment_number ? `, Apt/Office ${a.apartment_number}` : ''}
                  </p>
                  <p>{a.state_region} Governorate</p>
                </>
              ) : (
                <>
                  <p>
                    {a.address_line1}
                    {a.address_line2 ? `, ${a.address_line2}` : ''}
                  </p>
                  {a.district && <p>{a.district}</p>}
                  {a.building_name && <p>{a.building_name}</p>}
                  <p>
                    {a.city}
                    {a.state_region ? `, ${a.state_region}` : ''} {a.postal_code ?? ''}
                  </p>
                </>
              )}
              <p>{a.country_name}</p>
              <div className="address-card-actions">
                <button className="btn btn-outline" onClick={() => startEdit(a)}>
                  Edit
                </button>
                <button className="btn btn-outline address-delete" onClick={() => onDelete(a.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
