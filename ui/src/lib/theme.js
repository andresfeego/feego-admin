export const THEME_KEY = 'feego.theme'

export function getSavedTheme() {
  const t = localStorage.getItem(THEME_KEY)
  if (t === 'dark' || t === 'light') return t
  return 'light' // default
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
  localStorage.setItem(THEME_KEY, t)
}
