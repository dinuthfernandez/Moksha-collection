// Fetch wrapper for admin-only endpoints, using a separate token from the customer session
// so an admin browsing the storefront and the admin panel in the same browser don't collide.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

const ADMIN_TOKEN_STORAGE_KEY = 'moksha-admin-token'
let adminToken: string | null = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)

export function setAdminToken(token: string | null) {
  adminToken = token
  if (token) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
}

export function getAdminToken() {
  return adminToken
}

export class AdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`

  const res = await fetch(`${API_BASE_URL}${path}`, { headers, ...options })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body?.detail || detail
    } catch {
      // ignore body parse errors
    }
    throw new AdminApiError(typeof detail === 'string' ? detail : 'Something went wrong', res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
