// Minimal fetch wrapper for the FastAPI backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

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

const responseCache = new Map<string, { expires: number; data: unknown }>()
const inflightRequests = new Map<string, Promise<unknown>>()

/** Public GET with a short in-memory cache and request de-duplication. */
export function cachedGet<T>(path: string, ttlMs = 60_000): Promise<T> {
  const hit = responseCache.get(path)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.data as T)
  const pending = inflightRequests.get(path)
  if (pending) return pending as Promise<T>
  const promise = request<T>(path)
    .then((data) => {
      responseCache.set(path, { expires: Date.now() + ttlMs, data })
      return data
    })
    .finally(() => inflightRequests.delete(path))
  inflightRequests.set(path, promise)
  return promise
}

export function peekCached<T>(path: string): T | undefined {
  const hit = responseCache.get(path)
  return hit && hit.expires > Date.now() ? (hit.data as T) : undefined
}

export function clearApiCache() {
  responseCache.clear()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

