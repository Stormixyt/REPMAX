import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    // HARD SAFETY: if after 4s we still have no profile, force clean state
    const killSwitch = setTimeout(() => {
      if (!mounted.current) return
      if (loading || !profile) {
        console.warn('[REPMAX] Kill switch — no profile loaded, cleaning up')
        // If we have a user but no profile, session is probably dead
        // Force sign out so user gets a clean auth page
        supabase.auth.signOut().catch(() => {})
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }, 4000)

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await loadProfile(u.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted.current = false
      clearTimeout(killSwitch)
      subscription.unsubscribe()
    }
  }, [])

  async function initAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted.current) return

      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      } else {
        if (mounted.current) {
          setUser(null)
          setLoading(false)
        }
      }
    } catch {
      if (mounted.current) setLoading(false)
    }
  }

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      if (!mounted.current) return

      if (error) {
        // New user — profile row may not exist yet, retry once
        if (error.code === 'PGRST116') {
          await new Promise(r => setTimeout(r, 1000))
          const { data: retry } = await supabase
            .from('profiles').select('*').eq('id', userId).single()
          if (retry && mounted.current) {
            await ensureFriendCode(retry, userId)
            return
          }
        }
        if (mounted.current) setLoading(false)
        return
      }

      if (data) await ensureFriendCode(data, userId)
      else if (mounted.current) setLoading(false)
    } catch {
      if (mounted.current) setLoading(false)
    }
  }

  async function ensureFriendCode(data, userId) {
    if (!data.friend_code) {
      const code = genCode()
      const { data: updated } = await supabase
        .from('profiles').update({ friend_code: code })
        .eq('id', userId).select().single()
      if (mounted.current) {
        setProfile(updated || { ...data, friend_code: code })
        setLoading(false)
      }
    } else {
      if (mounted.current) {
        setProfile(data)
        setLoading(false)
      }
    }
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id).select().single()
    if (!error && data) setProfile(data)
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
    try { localStorage.removeItem('repmax-auth') } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut, updateProfile,
      fetchProfile: () => user && loadProfile(user.id),
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
