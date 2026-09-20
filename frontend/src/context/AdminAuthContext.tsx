import { createContext, useContext, useState, type ReactNode } from 'react'
import { adminLogin } from '../api/admin'
import { setAdminToken, getAdminToken } from '../api/adminClient'

interface AdminAuthContextValue {
  isAuthenticated: boolean
  login: (password: string) => Promise<void>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAdminToken())

  const login = async (password: string) => {
    const res = await adminLogin(password)
    setAdminToken(res.access_token)
    setIsAuthenticated(true)
  }

  const logout = () => {
    setAdminToken(null)
    setIsAuthenticated(false)
  }

  return <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}
