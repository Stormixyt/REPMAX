import { Routes, Route, Navigate } from 'react-router-dom'
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
import Notifications from './pages/Notifications'
import Layout from './components/Layout'

export default function App() {
  const { user, loading, isOnboarded } = useAuth()

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
      <Route path="/coach" element={<Layout><AICoach /></Layout>} />

      {/* Main app pages with bottom nav */}
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="/progress" element={<Layout><Progress /></Layout>} />
      <Route path="/social" element={<Layout><Social /></Layout>} />
      <Route path="/profile" element={<Layout><Profile /></Layout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
