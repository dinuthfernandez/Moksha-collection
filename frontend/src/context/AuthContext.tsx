import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMyProfile, loginCustomer, registerCustomer } from '../api/auth'
import { setAuthToken, getAuthToken, ApiError } from '../api/client'
import type { Customer, LoginPayload, RegisterPayload } from '../types'

interface AuthContextValue {
  customer: Customer | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  setCustomer: (customer: Customer) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!getAuthToken()) {
      setIsLoading(false)
      return
    }
    getMyProfile()
      .then(setCustomer)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setAuthToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (payload: LoginPayload) => {
    const res = await loginCustomer(payload)
    setAuthToken(res.access_token)
    setCustomer(res.customer)
  }

  const register = async (payload: RegisterPayload) => {
    const res = await registerCustomer(payload)
    setAuthToken(res.access_token)
    setCustomer(res.customer)
  }

  const logout = () => {
    setAuthToken(null)
    setCustomer(null)
  }

  return (
    <AuthContext.Provider value={{ customer, isLoading, isAuthenticated: !!customer, login, register, logout, setCustomer }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
