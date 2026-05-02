import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { themes, getThemeColors } from './colors'
import { useAuth } from '../context/AuthContext'

const ThemeContext = createContext(null)

function normalizeThemeName(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(themes, normalized) ? normalized : 'green'
}

export function ThemeProvider({ children }) {
  const { profile } = useAuth()
  const [themeName, setThemeName] = useState('green')
  const [tier, setTier] = useState('free')
  const [skin, setSkin] = useState('default')

  useEffect(() => {
    if (profile?.theme_color) {
      setThemeName(normalizeThemeName(profile.theme_color))
    }
  }, [profile?.theme_color])

  useEffect(() => {
    const activeTier =
      profile?.subscription_tier ||
      profile?.subscription_status ||
      ((profile?.pro_until && new Date(profile.pro_until) > new Date()) ? 'pro' : 'free') ||
      'free'

    setTier(activeTier)
  }, [profile?.subscription_tier, profile?.subscription_status, profile?.pro_until])

  useEffect(() => {
    if (profile?.interface_skin) {
      setSkin(profile.interface_skin)
    }
  }, [profile?.interface_skin])

  const theme = useMemo(() => ({
    ...getThemeColors(themeName),
    themeName,
    tier,
    skin,
  }), [themeName, tier, skin])

  return (
    <ThemeContext.Provider value={{ theme, setThemeName, setTier, setSkin }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
