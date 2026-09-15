import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.css'

interface ThemeToggleProps {
  className?: string
}

// A single accessible switch that flips the whole site between light and
// dark. Defaults to the device/browser preference until the user picks one
// explicitly (handled in ThemeContext), after which their choice persists.
export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className={`theme-toggle-track ${isDark ? 'is-dark' : 'is-light'}`}>
        <Sun size={13} className="theme-toggle-icon theme-toggle-icon-sun" />
        <Moon size={13} className="theme-toggle-icon theme-toggle-icon-moon" />
        <span className="theme-toggle-thumb">
          {isDark ? <Moon size={12} /> : <Sun size={12} />}
        </span>
      </span>
    </button>
  )
}
