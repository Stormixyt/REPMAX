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
    // Remove all old themes
    document.body.classList.remove('theme-green', 'theme-pink', 'theme-blue', 'theme-gold')
    // Apply user theme if selected, else default to green
    if (profile?.theme_color) {
      document.body.classList.add(`theme-${profile.theme_color}`)
    } else {
      document.body.classList.add('theme-green')
    }
  }, [profile?.theme_color])

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

  if (!isOnboarded) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* Full-screen pages (no bottom nav) */}
      <Route path="/workout/:workoutId" element={<Workout />} />
      <Route path="/subscribe" element={<Subscription />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/chat/:chatId" element={<ChatRoom />} />

      {/* Main app pages with bottom nav (Outlet) */}
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
