import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { getHomeTestVisibility, saveHomeTestVisibility, type HomeTestVisibility } from '../../api/homeTestVisibility'
import './AdminShowHide.css'

const sections: { key: keyof HomeTestVisibility; label: string }[] = [
  { key: 'under_5', label: 'Under 5 BHD' },
  { key: 'clearance', label: 'Clearance Sale' },
  { key: 'discounts', label: 'Discounts' },
]

export default function AdminShowHide() {
  const [settings, setSettings] = useState<HomeTestVisibility | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    getHomeTestVisibility()
      .then((data) => { if (active) setSettings(data) })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Could not load settings.') })
    return () => { active = false }
  }, [attempt])

  const toggle = async (key: keyof HomeTestVisibility) => {
    if (!settings || busy) return
    setBusy(true)
    setError('')
    try {
      setSettings(await saveHomeTestVisibility({ ...settings, [key]: !settings[key] }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-visibility">
      <h1><Eye size={22} /> Show and Hide</h1>
      <p className="admin-visibility-lead">Choose which offer sections appear on the homepage.</p>
      {error && <p className="admin-visibility-error" role="alert">{error}</p>}
      {!settings && !error && <p role="status">Loading settings...</p>}
      {!settings && error && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>}
      {settings && sections.map(({ key, label }) => (
        <div className="admin-visibility-card" key={key}>
          <div><strong>{label}</strong><span>{settings[key] ? 'Visible' : 'Hidden'} on the homepage</span></div>
          <button type="button" role="switch" aria-label={label} aria-checked={settings[key]} disabled={busy} className={`admin-visibility-toggle${settings[key] ? ' is-on' : ''}`} onClick={() => void toggle(key)}><span /></button>
        </div>
      ))}
    </div>
  )
}
