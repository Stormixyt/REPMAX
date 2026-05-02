import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId, authUser = null) {
    const { data, error } = await supabase
      .from('lockd_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    if (data) {
      setProfile(data)
      return data
    }

    if (!authUser) {
      setProfile(null)
      return null
    }

    const fallbackUsername =
      authUser.user_metadata?.username?.trim() ||
      `user_${userId.slice(0, 8)}`
    const fallbackDisplayName =
      authUser.user_metadata?.display_name?.trim() ||
      fallbackUsername

    const { data: createdProfile, error: createError } = await supabase
      .from('lockd_profiles')
      .upsert({
        id: userId,
        username: fallbackUsername,
        display_name: fallbackDisplayName,
      }, {
        onConflict: 'id',
      })
      .select('*')
      .single()

    if (createError) throw createError

    setProfile(createdProfile)
    return createdProfile
  }

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchProfile(session.user.id, session.user)
        } else {
          setProfile(null)
        }
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchProfile(session.user.id, session.user).catch(() => {
          setProfile(null)
        })
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'ultra' ||
    (profile?.pro_until && new Date(profile.pro_until) > new Date())
  const isUltra = profile?.subscription_tier === 'ultra'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      fetchProfile,
      isPro,
      isUltra,
      isOnboarded: !!profile?.username && profile.username !== `user_${profile.id?.slice(0, 8)}`,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
