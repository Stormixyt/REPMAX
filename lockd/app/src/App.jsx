import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Stats from './pages/Stats'
import WarRooms from './pages/WarRooms'
import WarRoom from './pages/WarRoom'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-spinner" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function OnboardedRoute({ children }) {
  const { user, loading, isOnboarded } = useAuth()
  if (loading) return <div className="loading-spinner" />
  if (!user) return <Navigate to="/login" replace />
  if (!isOnboarded) return <Navigate to="/onboarding" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="loading-spinner" />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/onboarding" element={
        <ProtectedRoute><Onboarding /></ProtectedRoute>
      } />
      <Route path="/" element={
        <OnboardedRoute>
          <div className="app-shell">
            <Today />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="/stats" element={
        <OnboardedRoute>
          <div className="app-shell">
            <Stats />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="/war-rooms" element={
        <OnboardedRoute>
          <div className="app-shell">
            <WarRooms />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="/war-rooms/:roomId" element={
        <OnboardedRoute>
          <div className="app-shell">
            <WarRoom />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="/profile" element={
        <OnboardedRoute>
          <div className="app-shell">
            <Profile />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="/settings" element={
        <OnboardedRoute>
          <div className="app-shell">
            <Settings />
            <Nav />
          </div>
        </OnboardedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
