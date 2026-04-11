import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useCall } from './context/CallContext'
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
import AdminPanel from './pages/AdminPanel'
import RunTracker from './pages/RunTracker'
import UltraLab from './pages/UltraLab'
import Layout from './components/Layout'
import CallScreen from './components/CallScreen'
import UsernameModal from './components/UsernameModal'
import { syncPushSubscription } from './lib/pushNotifications'

export default function App() {
  const { user, profile, loading, isOnboarded, needsUsername, fetchProfile, isAdmin, isPro, isUltra } = useAuth()
  const { activeCall, clearActiveCall, callMinimized, setCallMinimized, callToast, showCallToast } = useCall()
  const navigate = useNavigate()
  const location = useLocation()
  const [incomingCallPrompt, setIncomingCallPrompt] = useState(null)
  const activeCallChannelRef = useRef(null)
  const activeCallRef = useRef(null)

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    document.body.classList.remove('theme-green', 'theme-pink', 'theme-blue', 'theme-gold', 'theme-cherry-red', 'theme-neon-purple', 'theme-cyber-orange', 'tier-free', 'tier-pro', 'tier-ultra')
    if (profile?.theme_color) {
      document.body.classList.add(`theme-${profile.theme_color}`)
    } else {
      document.body.classList.add('theme-green')
    }

    if (isUltra) {
      document.body.classList.add('tier-ultra')
    } else if (isPro) {
      document.body.classList.add('tier-pro')
    } else {
      document.body.classList.add('tier-free')
    }
  }, [profile?.theme_color, isPro, isUltra])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const root = document.documentElement
    const body = document.body
    const visualViewport = window.visualViewport

    const syncViewportHeight = () => {
      const height = Math.round(visualViewport?.height || window.innerHeight)
      const keyboardOffset = Math.max(0, window.innerHeight - height)
      const keyboardOpen = keyboardOffset > 160

      root.style.setProperty('--app-viewport-height', `${height}px`)
      root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`)
      body.classList.toggle('keyboard-open', keyboardOpen)
    }

    syncViewportHeight()

    window.addEventListener('resize', syncViewportHeight)
    visualViewport?.addEventListener('resize', syncViewportHeight)
    visualViewport?.addEventListener('scroll', syncViewportHeight)

    return () => {
      window.removeEventListener('resize', syncViewportHeight)
      visualViewport?.removeEventListener('resize', syncViewportHeight)
      visualViewport?.removeEventListener('scroll', syncViewportHeight)
      root.style.setProperty('--keyboard-offset', '0px')
      body.classList.remove('keyboard-open')
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    syncPushSubscription(user.id).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return undefined

    const resyncPush = () => {
      if (document.visibilityState === 'hidden') return
      syncPushSubscription(user.id).catch(() => {})
    }

    window.addEventListener('focus', resyncPush)
    document.addEventListener('visibilitychange', resyncPush)

    return () => {
      window.removeEventListener('focus', resyncPush)
      document.removeEventListener('visibilitychange', resyncPush)
    }
  }, [user?.id])

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

  useEffect(() => {
    if (activeCall?.callId) {
      setIncomingCallPrompt(null)
    }
  }, [activeCall?.callId])

  async function clearPendingIncomingCalls(targetUserId) {
    if (!targetUserId) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', targetUserId)
      .eq('type', 'incoming_call')
      .eq('read', false)
  }

  useEffect(() => {
    if (!user?.id || !activeCall?.chatId || !activeCall?.callId) {
      return undefined
    }

    const channel = supabase
      .channel(`active-call-${activeCall.chatId}-${activeCall.callId}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'call-declined' }, ({ payload }) => {
        if (payload.callId !== activeCall.callId) return
        if (payload.callerId !== user.id) return

        clearActiveCall()
        showCallToast(payload.message || 'Call declined')
      })
      .on('broadcast', { event: 'end-call' }, ({ payload }) => {
        if (payload.callId !== activeCall.callId) return
        if (payload.callerId === user.id) return

        clearActiveCall()
        showCallToast(payload.message || `${payload.callerName || 'Caller'} ended the call`)
      })
      .subscribe()

    activeCallChannelRef.current = channel

    return () => {
      if (activeCallChannelRef.current === channel) {
        activeCallChannelRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [activeCall?.callId, activeCall?.chatId, clearActiveCall, showCallToast, user?.id])

  function handleGlobalCallEnd({ notifyRemote = true } = {}) {
    const currentCall = activeCallRef.current
    if (!currentCall) return

    if (currentCall.calleeId) {
      clearPendingIncomingCalls(currentCall.calleeId).catch(() => {})
    }

    if (notifyRemote) {
      activeCallChannelRef.current?.send({
        type: 'broadcast',
        event: 'end-call',
        payload: {
          callId: currentCall.callId,
          callerId: user.id,
          callerName: profile?.display_name || 'Gym Buddy',
          message: `${profile?.display_name || 'Caller'} ended the call`
        }
      }).catch(() => {})
    }

    clearActiveCall()
  }

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

      {activeCall && (
        <CallScreen
          callerName={activeCall.callerName}
          isVideo={activeCall.isVideo}
          roomName={activeCall.roomName}
          displayName={profile?.display_name || 'REPMAX User'}
          direction={activeCall.direction}
          minimized={callMinimized}
          onMinimize={() => setCallMinimized(true)}
          onExpand={() => setCallMinimized(false)}
          onEnd={handleGlobalCallEnd}
        />
      )}

      {callToast && <div className="toast fade-in">{callToast}</div>}

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
        {isAdmin && <Route path="/admin" element={<AdminPanel />} />}

        <Route element={<Layout />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/social" element={<Social />} />
          <Route path="/coach" element={<AICoach />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/run" element={<RunTracker />} />
          <Route path="/ultra-lab" element={<UltraLab />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  )
}
