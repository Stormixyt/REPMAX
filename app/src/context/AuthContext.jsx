import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, ensureSession } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    // Safety net: NEVER stay on splash screen longer than 4 seconds (was 6, too slow)
    const safetyTimer = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn('[REPMAX] Safety timeout — forcing load complete')
        setLoading(false)
      }
    }, 4000)

    // Use ensureSession which handles corrupted tokens
    ensureSession().then((session) => {
      if (!mounted.current) return
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted.current) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted.current) return
        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) {
          await fetchProfile(newUser.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted.current = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  function generateFriendCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function fetchProfile(userId, retries = 2) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      if (error) {
        if (retries > 0) {
          setTimeout(() => fetchProfile(userId, retries - 1), 800)
          return
        }
        if (mounted.current) setLoading(false)
        return
      }

      if (data && mounted.current) {
        if (!data.friend_code) {
          const friendCode = generateFriendCode()
          const { data: updated } = await supabase
            .from('profiles').update({ friend_code: friendCode })
            .eq('id', userId).select().single()
          setProfile(updated || { ...data, friend_code: friendCode })
        } else {
          setProfile(data)
        }
      }
    } catch {
      if (retries > 0) {
        setTimeout(() => fetchProfile(userId, retries - 1), 1000)
        return
      }
    }
    if (mounted.current) setLoading(false)
  }

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    const safeUpdates = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('profiles').update(safeUpdates).eq('id', user.id).select().single()
    if (!error && data) setProfile(data)
    return { data, error }
  }

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    })
    return { data, error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    // Clear ALL storage to prevent stale token issues
    try {
      localStorage.removeItem('repmax-auth')
      sessionStorage.clear()
    } catch {}
  }

  const value = {
    user, profile, loading,
    signUp, signIn, signOut, updateProfile,
    fetchProfile: () => user && fetchProfile(user.id),
    isOnboarded: profile?.onboarded === true,
    isPro: (profile?.subscription_status === 'pro') || (profile?.pro_until && new Date(profile.pro_until) > new Date())
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
