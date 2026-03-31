import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(err => {
      console.error('Session fetch error', err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  function generateFriendCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function fetchProfile(userId, retries = 3) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116' && retries > 0) {
          console.log('Profile not found yet, retrying in 500ms...', retries)
          setTimeout(() => fetchProfile(userId, retries - 1), 500)
          return
        }
        console.error('Profile fetch error:', error)
        // If it's a network error or unrelated, aggressively retry so we don't boot them to Onboarding
        setTimeout(() => fetchProfile(userId, retries), 2000)
        return
      }

      if (data) {
      // Auto-generate friend_code if missing
      if (!data.friend_code) {
        const friendCode = generateFriendCode()
        const { data: updated, error: updateErr } = await supabase
          .from('profiles')
          .update({ friend_code: friendCode })
          .eq('id', userId)
          .select()
          .single()
        if (!updateErr && updated) {
          setProfile(updated)
        } else {
          // If update fails (e.g. column doesn't exist yet), still set profile
          setProfile({ ...data, friend_code: friendCode })
        }
      } else {
        setProfile(data)
      }
    }
    } catch (err) {
      console.error('fetchProfile exception:', err)
      setTimeout(() => fetchProfile(userId, retries), 2000)
      return
    }
    setLoading(false)
  }

  async function updateProfile(updates) {
    if (!user) return { error: 'Not authenticated' }
    // Filter out any keys that might not exist in the schema yet
    const safeUpdates = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) console.error('Profile update error:', error.message, safeUpdates)
    if (!error && data) setProfile(data)
    return { data, error }
  }

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    })
    return { data, error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
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
