import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

/**
 * REPMAX v2.0 is an ULTRA-exclusive experimental early-access build.
 * v1 is the default for every tier. v2 can only be enabled by an ULTRA user
 * who explicitly opts in via Settings → Experimental Early Access.
 */

const V2Context = createContext({
  v2: false,
  canUseV2: false,
  toggle: () => {}
})

const STORAGE_KEY = 'repmax_v2_enabled'

function readStored() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function V2Provider({ children }) {
  const { isUltra } = useAuth()
  const [preference, setPreference] = useState(() => readStored())

  const canUseV2 = !!isUltra
  const v2 = canUseV2 && preference

  useEffect(() => {
    const body = document.body
    if (!body) return
    body.dataset.v2 = v2 ? 'true' : 'false'
    body.dataset.v2Shell = v2 ? 'true' : 'false'
  }, [v2])

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, String(preference)) } catch {}
  }, [preference])

  // If user loses ULTRA, auto-disable the v2 preference.
  useEffect(() => {
    if (!canUseV2 && preference) setPreference(false)
  }, [canUseV2, preference])

  const toggle = useCallback((next) => {
    if (!canUseV2) return
    setPreference(prev => typeof next === 'boolean' ? next : !prev)
  }, [canUseV2])

  const value = useMemo(() => ({ v2, canUseV2, toggle }), [v2, canUseV2, toggle])
  return <V2Context.Provider value={value}>{children}</V2Context.Provider>
}

export function useV2() {
  return useContext(V2Context)
}
