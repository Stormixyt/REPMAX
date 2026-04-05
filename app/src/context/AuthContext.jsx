import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
      }
    )
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

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id).select().single()
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
    try { localStorage.removeItem('repmax-auth') } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, needsUsername,
      signUp, signIn, signOut, updateProfile,
      fetchProfile: () => user && loadProfileWithTimeout(user.id, 5000),
      isOnboarded: profile?.onboarded === true,
      isPro: profile?.subscription_status === 'pro' || (profile?.pro_until && new Date(profile.pro_until) > new Date())
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
