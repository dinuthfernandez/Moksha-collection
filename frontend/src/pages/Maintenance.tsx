import './Maintenance.css'

interface Props {
  message?: string
  eta?: string
}

export default function MaintenancePage({ message, eta }: Props) {
  return (
    <div className="mt-page">
      <div className="mt-orb mt-orb--one" />
      <div className="mt-orb mt-orb--two" />
      <div className="mt-orb mt-orb--three" />
      <main className="mt-card">
        <div className="mt-logo">
          <span className="mt-logo-script">moksha</span>
          <span className="mt-logo-sub">Collections</span>
        </div>

        <div className="mt-gear" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="32" cy="32" r="9" />
            <path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.7 5.7M44.7 44.7l5.7 5.7M13.6 50.4l5.7-5.7M44.7 19.3l5.7-5.7" />
          </svg>
        </div>

        <h1>We're polishing things up</h1>
        <p className="mt-message">
          {message || 'Our store is getting a little upgrade. We will be back very soon — thank you for your patience.'}
        </p>

        <div className="mt-bar" aria-hidden="true"><span /></div>

        {eta && (
          <div className="mt-eta">
            <span>Expected back</span>
            <strong>{eta}</strong>
          </div>
        )}

        <p className="mt-foot">This page refreshes by itself — no need to reload.</p>
      </main>
    </div>
  )
}
