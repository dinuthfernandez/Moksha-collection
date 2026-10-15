const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export interface MaintenanceStatus {
  enabled: boolean
  message: string
  eta: string
  bypass?: boolean
  bypass_available?: boolean
}

export async function submitBypass(password: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/maintenance/bypass`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) return null
    const body = await res.json().catch(() => ({}))
    return typeof body?.detail === 'string' ? body.detail : 'Access denied'
  } catch {
    return 'Could not reach the server'
  }
}

export async function fetchMaintenance(signal?: AbortSignal): Promise<MaintenanceStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/maintenance`, { cache: 'no-store', signal })
    if (!res.ok) return null
    return (await res.json()) as MaintenanceStatus
  } catch {
    return null
  }
}
