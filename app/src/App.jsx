import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'
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
import Layout from './components/Layout'

export default function App() {
  const { user, profile, loading, isOnboarded } = useAuth()

  useEffect(() => {
    document.body.classList.remove('theme-green', 'theme-pink', 'theme-blue', 'theme-gold')
    if (profile?.theme_color) {
      document.body.classList.add(`theme-${profile.theme_color}`)
    } else {
      document.body.classList.add('theme-green')
    }
  }, [profile?.theme_color])

  // Single loading gate — AuthContext handles everything
  // loading=true until: (a) profile loads OR (b) safety timer fires OR (c) no user
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

  // Not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  // User exists but profile failed to load — show app anyway
  // (Dashboard will handle null profile gracefully with defaults)
  // Only redirect to Onboarding if we POSITIVELY know profile.onboarded === false
  if (profile && profile.onboarded !== true) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  // Fully authenticated (profile might be null if fetch failed — app handles it)
  return (
    <Routes>
      <Route path="/workout/:workoutId" element={<Workout />} />
      <Route path="/subscribe" element={<Subscription />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/chat/:chatId" element={<ChatRoom />} />

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
  )
}
