import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { RiHomeFill, RiHomeLine, RiBarChart2Fill, RiBarChart2Line, RiLeafFill, RiLeafLine, RiChat3Fill, RiChat3Line, RiBrainFill, RiBrainLine, RiUser3Fill, RiUser3Line } from '@remixicon/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const isCoachRoute = path === '/coach'
  const [toast, setToast] = useState(null)
  const { user } = useAuth()
  const { t } = useLanguage()

  async function syncUnreadBadge() {
    if (!user?.id) return

    const supportsBadging = 'setAppBadge' in navigator || 'clearAppBadge' in navigator
    if (!supportsBadging) return

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    try {
      if (count > 0 && 'setAppBadge' in navigator) {
        await navigator.setAppBadge(count)
      } else if (count === 0 && 'clearAppBadge' in navigator) {
        await navigator.clearAppBadge()
      }
    } catch {}
  }

  // Foreground notification toasts now come from the same Supabase notification
  // stream that powers the in-app bell and browser push flows.
  useEffect(() => {
    if (!user?.id) return undefined

    syncUnreadBadge()

    const channel = supabase
      .channel(`layout-toast-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, ({ new: notification }) => {
        if (!notification?.title) return
        if (notification.type === 'incoming_call') return

        const targetChatId = notification.data?.chat_id
        if (targetChatId && path === `/chat/${targetChatId}`) return

        setToast({ title: notification.title, body: notification.body || '' })
        setTimeout(() => setToast(null), 5000)
        syncUnreadBadge()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        syncUnreadBadge()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, path])

  const navItems = [
    { path: '/app', label: t('nav_home'), ActiveIcon: RiHomeFill, Icon: RiHomeLine },
    { path: '/progress', label: t('nav_progress'), ActiveIcon: RiBarChart2Fill, Icon: RiBarChart2Line },
    { path: '/nutrition', label: t('nav_diet'), ActiveIcon: RiLeafFill, Icon: RiLeafLine },
    { path: '/social', label: t('nav_chat'), ActiveIcon: RiChat3Fill, Icon: RiChat3Line },
    { path: '/coach', label: t('nav_coach'), ActiveIcon: RiBrainFill, Icon: RiBrainLine },
    { path: '/profile', label: t('nav_profile'), ActiveIcon: RiUser3Fill, Icon: RiUser3Line },
  ]

  // Global Swipe Navigation Logic
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    let lastValidTarget = null

    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX
      touchStartY = e.changedTouches[0].screenY
      lastValidTarget = e.target
    }

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].screenX
      const touchEndY = e.changedTouches[0].screenY
      
      const diffX = touchStartX - touchEndX
      const diffY = touchStartY - touchEndY
      
      // If scroll up/down is more than left/right, ignore
      if (Math.abs(diffY) > Math.abs(diffX)) return
      
      // Ignore if targeting horizontal scrollable elements like sliders, canvases or buttons
      if (lastValidTarget && lastValidTarget.closest('input, button, canvas, .horizontal-scroll, .scroll-x')) return
      
      // Swipe threshold
      if (Math.abs(diffX) > 80) {
        const paths = navItems.map(n => n.path)
        const currentIndex = paths.indexOf(path)
        
        if (currentIndex !== -1) {
          if (diffX > 0 && currentIndex < paths.length - 1) {
            // Swiped Left - go Next
            navigate(paths[currentIndex + 1])
          } else if (diffX < 0 && currentIndex > 0) {
            // Swiped Right - go Prev
            navigate(paths[currentIndex - 1])
          }
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [path, navigate])

  return (
    <div className="app-wrapper">
      <div className={`app-content ${isCoachRoute ? 'app-content--coach' : ''}`}><Outlet /></div>
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
