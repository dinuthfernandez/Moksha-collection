import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchMaintenance, watchMaintenance, type MaintenanceStatus } from '../../api/maintenance'
import MaintenancePage from '../../pages/Maintenance'

export const SUPERADMIN_PATH = '/noonecanfindthisonlyfordinuth'
const POLL_MS = 15_000

/** Blocks the whole storefront (and admin panel) while maintenance mode is on. */
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [checked, setChecked] = useState(false)
  const requestId = useRef(0)

  const check = useCallback(async () => {
    const id = ++requestId.current
    const next = await fetchMaintenance()
    if (id !== requestId.current) return
    if (next) setStatus(next)
    setChecked(true)
  }, [])

  useEffect(() => {
    void check()
    const events = watchMaintenance(() => void check())
    const timer = window.setInterval(check, POLL_MS)
    const giveUp = window.setTimeout(() => setChecked(true), 3000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      requestId.current++
      events.close()
      window.clearInterval(timer)
      window.clearTimeout(giveUp)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  const isSuperAdmin = pathname.startsWith(SUPERADMIN_PATH)
  if (isSuperAdmin) return <>{children}</>
  if (!checked) return <div style={{ position: 'fixed', inset: 0, background: '#0e0a14' }} />
  if (status?.enabled && !status.bypass) {
    return (
      <MaintenancePage
        message={status.message}
        eta={status.eta}
        bypassAvailable={status.bypass_available}
        onUnlocked={() => void check()}
      />
    )
  }
  return <>{children}</>
}
