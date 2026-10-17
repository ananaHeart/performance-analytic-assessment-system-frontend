import { Moon, Sun } from 'lucide-react'
import { setTheme, useTheme } from '../lib/theme'

// Sun/moon switch that sits beside the notification bell (and in the public headers).
function ThemeToggle({ variant = 'default' }) {
  const theme = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  const iconSize = variant === 'teacher' ? 17 : 18

  return (
    <button
      type="button"
      className={`theme-toggle-button is-${variant}`}
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun size={iconSize} strokeWidth={2.2} aria-hidden="true" /> : <Moon size={iconSize} strokeWidth={2.2} aria-hidden="true" />}
    </button>
  )
}

export default ThemeToggle
