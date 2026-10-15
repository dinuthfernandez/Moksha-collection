import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchMaintenance, type MaintenanceStatus } from '../../api/maintenance'
import MaintenancePage from '../../pages/Maintenance'

export const SUPERADMIN_PATH = '/noonecanfindthisonlyfordinuth'
const POLL_MS = 15_000

/** Blocks the whole storefront (and admin panel) while maintenance mode is on. */
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const next = await fetchMaintenance()
      if (cancelled) return
      if (next) setStatus(next)
      setChecked(true)
    }
    check()
    const timer = window.setInterval(check, POLL_MS)
    const giveUp = window.setTimeout(() => !cancelled && setChecked(true), 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(giveUp)
    }
  }, [])

  const isSuperAdmin = pathname.startsWith(SUPERADMIN_PATH)
  if (isSuperAdmin) return <>{children}</>
  if (!checked) return <div style={{ position: 'fixed', inset: 0, background: '#0e0a14' }} />
  if (status?.enabled && !status.bypass) {
    return (
      <MaintenancePage
        message={status.message}
        eta={status.eta}
        bypassAvailable={status.bypass_available}
        onUnlocked={() => fetchMaintenance().then((next) => next && setStatus(next))}
      />
    )
  }
  return <>{children}</>
}
