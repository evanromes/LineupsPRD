import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme, lightTheme } from '../constants/colors'
import type { Theme, ThemeType } from '../constants/colors'

// ── Context shape ──────────────────────────────────────────
interface ThemeContextValue {
  theme: Theme
  themeType: ThemeType
  toggleTheme: () => void
  setThemeType: (type: ThemeType) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeType: 'dark',
  toggleTheme: () => {},
  setThemeType: () => {},
})

// ── Storage key ────────────────────────────────────────────
const STORAGE_KEY = '@lineups_theme'

// ── Provider ───────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()

  // Default to the system preference; overridden by any saved user choice.
  const [themeType, setThemeTypeState] = useState<ThemeType>(
    systemScheme === 'light' ? 'light' : 'dark'
  )

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setThemeTypeState(stored)
      }
    })
  }, [])

  function setThemeType(type: ThemeType) {
    setThemeTypeState(type)
    AsyncStorage.setItem(STORAGE_KEY, type)
  }

  function toggleTheme() {
    setThemeType(themeType === 'dark' ? 'light' : 'dark')
  }

  const theme = themeType === 'dark' ? darkTheme : lightTheme

  return (
    <ThemeContext.Provider value={{ theme, themeType, toggleTheme, setThemeType }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────
// Usage in any component:
//   const { theme, themeType, toggleTheme } = useTheme()
export function useTheme() {
  return useContext(ThemeContext)
}
