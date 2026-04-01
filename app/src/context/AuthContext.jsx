import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const profileFetched = useRef(false)

  useEffect(() => {
    mounted.current = true

    // HARD SAFETY: loading MUST end within 4 seconds no matter what
    const killSwitch = setTimeout(() => {
      if (mounted.current) {
        console.warn('[REPMAX] Kill switch — forcing app to render')
        setLoading(false)
      }
    }, 4000)

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted.current) return
        const u = session?.user ?? null
        setUser(u)
        if (u && !profileFetched.current) {
          await loadProfile(u.id)
        } else if (!u) {
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
        // No session — try refresh as last resort
        try {
          const { data } = await supabase.auth.refreshSession()
          if (data?.session?.user && mounted.current) {
            setUser(data.session.user)
            await loadProfile(data.session.user.id)
            return
          }
        } catch {}
        if (mounted.current) setLoading(false)
      }
    } catch {
      if (mounted.current) setLoading(false)
    }
  }

  async function loadProfile(userId) {
    if (profileFetched.current) return
    profileFetched.current = true

    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      if (!mounted.current) return

      if (error) {
        // Profile row might not exist yet (new user) — retry once
        if (error.code === 'PGRST116') {
          await new Promise(r => setTimeout(r, 800))
          const { data: retry } = await supabase
            .from('profiles').select('*').eq('id', userId).single()
          if (retry && mounted.current) {
            await ensureFriendCode(retry, userId)
            return
          }
        }
        // Give up — let the app render
        if (mounted.current) setLoading(false)
        return
      }

      if (data) await ensureFriendCode(data, userId)
    } catch {
      // Network error — let safety timer handle it
    }
    if (mounted.current) setLoading(false)
  }

  async function ensureFriendCode(data, userId) {
    if (!data.friend_code) {
      const code = genCode()
      const { data: updated } = await supabase
        .from('profiles').update({ friend_code: code })
        .eq('id', userId).select().single()
      if (mounted.current) setProfile(updated || { ...data, friend_code: code })
    } else {
      if (mounted.current) setProfile(data)
    }
    if (mounted.current) setLoading(false)
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
    profileFetched.current = false
    try { localStorage.removeItem('repmax-auth') } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut, updateProfile,
      fetchProfile: () => { profileFetched.current = false; user && loadProfile(user.id) },
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
