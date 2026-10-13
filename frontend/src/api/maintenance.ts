const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export interface MaintenanceStatus {
  enabled: boolean
  message: string
  eta: string
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
