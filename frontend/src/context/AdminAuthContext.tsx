import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { adminLogin, getAdminSettings } from '../api/admin'
import { setAdminToken, getAdminToken } from '../api/adminClient'
import { AdminApiError } from '../api/adminClient'

interface AdminAuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  login: (password: string) => Promise<void>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(!!getAdminToken())

  useEffect(() => {
    const token = getAdminToken()
    if (!token) return

    let mounted = true
    getAdminSettings()
      .then(() => {
        if (mounted && getAdminToken() === token) setIsAuthenticated(true)
      })
      .catch((error: unknown) => {
        if (mounted && getAdminToken() === token && error instanceof AdminApiError && error.status === 401) {
          setAdminToken(null)
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const login = async (password: string) => {
    const res = await adminLogin(password)
    setAdminToken(res.access_token)
    setIsAuthenticated(true)
    setIsLoading(false)
  }

  const logout = () => {
    setAdminToken(null)
    setIsAuthenticated(false)
  }

  return <AdminAuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}
