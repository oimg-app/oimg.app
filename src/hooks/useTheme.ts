import { useState, useEffect } from 'react'
import type { ThemeMode } from '@/types'

const STORAGE_KEY = 'oimg-theme'

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark'
  const value = localStorage.getItem(STORAGE_KEY)
  // T-03-01 mitigation: only accept known values; anything else falls back to dark.
  return value === 'light' ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, setTheme, toggle }
}
