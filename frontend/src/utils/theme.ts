// Shared helpers for the light/dark theme system. Kept outside React so the
// initial theme can be applied synchronously before the app mounts (avoids a
// flash of the wrong theme on page load).
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'moksha-theme'

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

// The theme the user actually sees: their explicit choice if they've made
// one, otherwise whatever their device/browser currently prefers.
export function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}
