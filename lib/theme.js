import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)
const LS_KEY = 'mihomo_theme'

function applyTheme(theme) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // auto: follow system preference
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', dark)
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('auto')

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) || 'auto'
    setThemeState(saved)
    applyTheme(saved)

    // Keep auto mode in sync when system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      if ((localStorage.getItem(LS_KEY) || 'auto') === 'auto') applyTheme('auto')
    }
    mq.addEventListener('change', onSystemChange)
    return () => mq.removeEventListener('change', onSystemChange)
  }, [])

  const setTheme = (t) => {
    localStorage.setItem(LS_KEY, t)
    setThemeState(t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
