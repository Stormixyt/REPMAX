import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RiHomeFill, RiHomeLine, RiBarChart2Fill, RiBarChart2Line, RiTeamFill, RiTeamLine, RiBrainFill, RiBrainLine, RiUser3Fill, RiUser3Line } from '@remixicon/react'
import { onForegroundMessage } from '../lib/firebase'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [toast, setToast] = useState(null)

  // Listen for foreground FCM notifications
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {}
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
  }, [])

  const navItems = [
    { path: '/', label: 'Home', ActiveIcon: RiHomeFill, Icon: RiHomeLine },
    { path: '/progress', label: 'Progress', ActiveIcon: RiBarChart2Fill, Icon: RiBarChart2Line },
    { path: '/social', label: 'Social', ActiveIcon: RiTeamFill, Icon: RiTeamLine },
    { path: '/coach', label: 'AI Coach', ActiveIcon: RiBrainFill, Icon: RiBrainLine },
    { path: '/profile', label: 'Profile', ActiveIcon: RiUser3Fill, Icon: RiUser3Line },
  ]

  return (
    <div className="app-wrapper">
      <div className="app-content">{children}</div>
      <nav className="bottom-nav">
        {navItems.map(item => {
          const isActive = path === item.path
          const IconComponent = isActive ? item.ActiveIcon : item.Icon
          return (
            <button
              key={item.path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <IconComponent size={22} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Foreground push notification toast */}
      {toast && (
        <div className="push-toast" onClick={() => setToast(null)}>
          <div className="push-toast-title">{toast.title}</div>
          <div className="push-toast-body">{toast.body}</div>
        </div>
      )}
    </div>
  )
}
