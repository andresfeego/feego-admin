import React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export default function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      storageKey="feego.theme"
    >
      {children}
    </NextThemesProvider>
  )
}
