/**
 * Theme Utility - Dark/light mode management with system preference detection.
 */

export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'courier-theme'

/**
 * Get the current theme preference from localStorage
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

/**
 * Store theme preference in localStorage
 */
export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

/**
 * Get the system's preferred color scheme
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Get the effective theme (resolves 'system' to actual theme)
 */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  const effective = getEffectiveTheme(theme)
  const root = document.documentElement

  if (effective === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/**
 * Initialize theme on app start
 */
export function initializeTheme(): Theme {
  const theme = getStoredTheme()
  applyTheme(theme)
  return theme
}

/**
 * Set up listener for system theme changes
 */
export function onSystemThemeChange(callback: (theme: 'light' | 'dark') => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light')
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}

/**
 * Toggle between light and dark (skips system)
 */
export function toggleTheme(): Theme {
  const current = getStoredTheme()
  const effective = getEffectiveTheme(current)
  const newTheme: Theme = effective === 'dark' ? 'light' : 'dark'
  setStoredTheme(newTheme)
  applyTheme(newTheme)
  return newTheme
}

/**
 * Cycle through themes: light -> dark -> system -> light
 */
export function cycleTheme(): Theme {
  const current = getStoredTheme()
  let newTheme: Theme

  switch (current) {
    case 'light':
      newTheme = 'dark'
      break
    case 'dark':
      newTheme = 'system'
      break
    case 'system':
    default:
      newTheme = 'light'
      break
  }

  setStoredTheme(newTheme)
  applyTheme(newTheme)
  return newTheme
}
