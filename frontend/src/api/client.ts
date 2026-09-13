// Minimal fetch wrapper for the FastAPI backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

const TOKEN_STORAGE_KEY = 'moksha-auth-token'
let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY)

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getAuthToken() {
  return authToken
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body?.detail || detail
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(typeof detail === 'string' ? detail : 'Something went wrong', res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

