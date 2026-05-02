import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = ['nassimchahman8@gmail.com']
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsUsername, setNeedsUsername] = useState(false)
  const mounted = useRef(true)
  const initDone = useRef(false)

  useEffect(() => {
    mounted.current = true
    if (initDone.current) return
    initDone.current = true
    startAuth()
    return () => { mounted.current = false }
  }, [])

  async function startAuth() {
    const timeout = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn('[REPMAX] Auth timeout reached')
        setLoading(false)
      }
    }, 6000)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted.current) { clearTimeout(timeout); return }

      if (session?.user) {
        setUser(session.user)
        await loadProfileWithTimeout(session.user.id, 5000)
        if (mounted.current) setLoading(false)
      } else {
        if (mounted.current) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    } catch (err) {
      console.warn('[REPMAX] Auth init error:', err)
      if (mounted.current) setLoading(false)
    }

    clearTimeout(timeout)

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await loadProfileWithTimeout(session.user.id, 5000)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setNeedsUsername(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
        if (!profile) await loadProfileWithTimeout(session.user.id, 3000)
      }
    })
  }

  async function loadProfileWithTimeout(userId, timeoutMs) {
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        console.warn('[REPMAX] Profile fetch timed out')
        resolve(false)
      }, timeoutMs)

      try {
        const { data, error } = await supabase
          .from('profiles').select('*').eq('id', userId).single()

        clearTimeout(timer)
        if (!mounted.current) { resolve(false); return }

        if (error) {
          if (error.code === 'PGRST116') {
            await new Promise(r => setTimeout(r, 1000))
            const { data: retry } = await supabase
              .from('profiles').select('*').eq('id', userId).single()
            if (retry && mounted.current) {
              setProfile(retry)
              setNeedsUsername(!retry.username)
              resolve(true)
              return
            }
          }
          resolve(false)
          return
        }

        if (data && mounted.current) {
          setProfile(data)
          setNeedsUsername(!data.username)
          resolve(true)
        } else {
          resolve(false)
        }
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  function getMissingProfileColumn(error) {
    const message = String(error?.message || '')
    const match = message.match(/Could not find the '([^']+)' column of 'profiles'/i)
    return match?.[1] || null
  }

  async function updateProfileWithFallback(updates) {
    let nextUpdates = { ...updates, updated_at: new Date().toISOString() }
    let lastError = null
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabase
        .from('profiles').update(nextUpdates).eq('id', user.id).select().single()
      if (!error) return { data, error: null }
      lastError = error
      const missingColumn = getMissingProfileColumn(error)
      if (error.code !== 'PGRST204' || !missingColumn || !(missingColumn in nextUpdates)) break
      delete nextUpdates[missingColumn]
    }
    return { data: null, error: lastError }
  }

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    const { data, error } = await updateProfileWithFallback(updates)
    if (!error && data) {
      setProfile(data)
      if (updates.username) setNeedsUsername(false)
    }
    return { data, error }
  }

  const signUp = async (email, password, displayName) =>
    supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })

  const signIn = async (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setNeedsUsername(false)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, needsUsername,
      signUp, signIn, signOut, updateProfile,
      fetchProfile: () => user && loadProfileWithTimeout(user.id, 5000),
      isOnboarded: profile?.onboarded === true,
      isAdmin: !!(profile?.is_admin || ADMIN_EMAILS.includes(user?.email)),
      isPro: profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'ultra' || profile?.subscription_status === 'pro' || (profile?.pro_until && new Date(profile.pro_until) > new Date()),
      isUltra: profile?.subscription_tier === 'ultra',
      subscriptionTier: profile?.subscription_tier || 'free',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
