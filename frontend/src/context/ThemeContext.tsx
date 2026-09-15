import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, getInitialTheme, getStoredTheme, getSystemTheme, THEME_STORAGE_KEY, type Theme } from '../utils/theme'

interface ThemeContextValue {
  theme: Theme
  isFollowingSystem: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  useSystemTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [isFollowingSystem, setIsFollowingSystem] = useState<boolean>(() => getStoredTheme() === null)

  // Keep <html data-theme="..."> in sync (main.tsx already sets it once,
  // synchronously, before the first paint — this covers every update after).
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // While the user hasn't made an explicit choice, follow the OS/browser
  // preference live (e.g. they switch their phone to dark mode at night).
  useEffect(() => {
    if (!isFollowingSystem || typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setThemeState(getSystemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [isFollowingSystem])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    setIsFollowingSystem(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const useSystemTheme = useCallback(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY)
    setIsFollowingSystem(true)
    setThemeState(getSystemTheme())
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, isFollowingSystem, setTheme, toggleTheme, useSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
