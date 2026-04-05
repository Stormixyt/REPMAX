import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Workout from './pages/Workout'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import Social from './pages/Social'
import AICoach from './pages/AICoach'
import Subscription from './pages/Subscription'
import Settings from './pages/Settings'
import Nutrition from './pages/Nutrition'
import Notifications from './pages/Notifications'
import ChatRoom from './pages/ChatRoom'
import HomeExercises from './pages/HomeExercises'
import Recovery from './pages/Recovery'
import Layout from './components/Layout'
import UsernameModal from './components/UsernameModal'

export default function App() {
  const { user, profile, loading, isOnboarded, needsUsername, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [incomingCallPrompt, setIncomingCallPrompt] = useState(null)

  useEffect(() => {
    document.body.classList.remove('theme-green', 'theme-pink', 'theme-blue', 'theme-gold')
    if (profile?.theme_color) {
      document.body.classList.add(`theme-${profile.theme_color}`)
    } else {
      document.body.classList.add('theme-green')
    }
  }, [profile?.theme_color])

  useEffect(() => {
    if (!user?.id) {
      setIncomingCallPrompt(null)
      return
    }

    let cancelled = false
    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, ({ new: notification }) => {
        if (notification.type !== 'incoming_call') return
        const chatPath = `/chat/${notification.data?.chat_id}`
        const expiresAt = notification.data?.expires_at
        if (chatPath === location.pathname) return
        if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return

        setIncomingCallPrompt({
          id: notification.id,
          chatId: notification.data?.chat_id,
          callerName: notification.data?.caller_name || 'Gym Buddy',
          withVideo: notification.data?.with_video === true,
          expiresAt
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, ({ new: notification }) => {
        if (notification.type !== 'incoming_call') return
        if (!notification.read) return

        setIncomingCallPrompt(prev => {
          if (!prev || prev.id !== notification.id) return prev
          return null
        })
      })
      .subscribe()

    async function loadPendingIncomingCall() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'incoming_call')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      if (cancelled) return

      const pendingCall = (data || []).find((notification) => {
        const chatPath = `/chat/${notification.data?.chat_id}`
        const expiresAt = notification.data?.expires_at
        const stillActive = !expiresAt || new Date(expiresAt).getTime() > Date.now()
        return stillActive && chatPath !== location.pathname
      })

      if (pendingCall) {
        setIncomingCallPrompt({
          id: pendingCall.id,
          chatId: pendingCall.data?.chat_id,
          callerName: pendingCall.data?.caller_name || 'Gym Buddy',
          withVideo: pendingCall.data?.with_video === true,
          expiresAt: pendingCall.data?.expires_at
        })
      }
    }

    loadPendingIncomingCall()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, location.pathname])

  useEffect(() => {
    if (!incomingCallPrompt?.expiresAt) return undefined

    const msRemaining = new Date(incomingCallPrompt.expiresAt).getTime() - Date.now()
    if (msRemaining <= 0) {
      setIncomingCallPrompt(null)
      return undefined
    }

    const timer = setTimeout(() => setIncomingCallPrompt(null), msRemaining)
    return () => clearTimeout(timer)
  }, [incomingCallPrompt?.expiresAt])

  useEffect(() => {
    if (!incomingCallPrompt?.chatId) return
    if (location.pathname === `/chat/${incomingCallPrompt.chatId}`) {
      setIncomingCallPrompt(null)
    }
  }, [incomingCallPrompt?.chatId, location.pathname])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">REPMAX<span className="dot" /></div>
        <div className="loading-dots">
          <span /><span /><span />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  if (profile && profile.onboarded !== true) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <>
      {incomingCallPrompt?.chatId && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          zIndex: 10001,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            width: 'min(440px, 100%)',
            pointerEvents: 'auto',
            background: 'rgba(14,16,20,0.96)',
            border: '1px solid rgba(212,255,0,0.22)',
            borderRadius: 22,
            padding: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(12px)'
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              Incoming {incomingCallPrompt.withVideo ? 'Video' : 'Voice'} Call
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
              {incomingCallPrompt.callerName} is calling you
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
              Open the chat to answer before the call expires.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setIncomingCallPrompt(null)}
              >
                Dismiss
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  navigate(`/chat/${incomingCallPrompt.chatId}`)
                  setIncomingCallPrompt(null)
                }}
              >
                Answer In Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Username modal — blocks the app until user picks a username */}
      {needsUsername && (
        <UsernameModal onComplete={() => fetchProfile()} />
      )}

      <Routes>
        <Route path="/setup" element={<Onboarding />} />
        <Route path="/workout/:workoutId" element={<Workout />} />
        <Route path="/subscribe" element={<Subscription />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/chat/:chatId" element={<ChatRoom />} />
        <Route path="/exercises" element={<HomeExercises />} />
        <Route path="/recovery" element={<Recovery />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/social" element={<Social />} />
          <Route path="/coach" element={<AICoach />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
