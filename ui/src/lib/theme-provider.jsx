import React from 'react'

const ThemeCtx = React.createContext(null)

function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyThemeAttribute(theme) {
  // CSS expects data-theme on the root element
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
}

export function useTheme() {
  const ctx = React.useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

export default function ThemeProvider({ children }) {
  const storageKey = 'feego.theme'

  const [theme, setThemeState] = React.useState(() => {
    try {
      const v = localStorage.getItem(storageKey)
      return v || 'light'
    } catch {
      return 'light'
    }
  })

  const [systemTheme, setSystemTheme] = React.useState(() => (typeof window !== 'undefined' ? getSystemTheme() : 'light'))

  // Track system theme changes
  React.useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    if (!mq) return
    const onChange = () => setSystemTheme(getSystemTheme())
    onChange()
    // Safari < 14 uses addListener/removeListener
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  // Persist theme
  React.useEffect(() => {
    try { localStorage.setItem(storageKey, theme) } catch {}
  }, [theme])

  // Apply effective theme to DOM
  React.useEffect(() => {
    const effective = theme === 'system' ? systemTheme : theme
    applyThemeAttribute(effective)
  }, [theme, systemTheme])

  const setTheme = (t) => setThemeState(t)

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, systemTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}
