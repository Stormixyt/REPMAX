import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  RiHomeFill, RiHomeLine,
  RiBarChart2Fill, RiBarChart2Line,
  RiLeafFill, RiLeafLine,
  RiChat3Fill, RiChat3Line,
  RiBrainFill, RiBrainLine,
  RiUser3Fill, RiUser3Line,
  RiTeamFill, RiTeamLine,
  RiAddLine, RiRunLine, RiPulseLine, RiBookmarkLine,
  RiNotification3Line, RiSettings3Line
} from '@remixicon/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useV2 } from '../context/V2Context'
import { supabase } from '../lib/supabase'
import { hapticSelection } from '../lib/native'
import { Sheet } from './ui'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const isCoachRoute = path === '/coach'
  const [toast, setToast] = useState(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { user } = useAuth()
  const { t } = useLanguage()
  const { v2 } = useV2()

  async function syncUnreadBadge() {
    if (!user?.id) return

    const supportsBadging = 'setAppBadge' in navigator || 'clearAppBadge' in navigator

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setUnread(count || 0)

    if (!supportsBadging) return
    try {
      if (count > 0 && 'setAppBadge' in navigator) {
        await navigator.setAppBadge(count)
      } else if (count === 0 && 'clearAppBadge' in navigator) {
        await navigator.clearAppBadge()
      }
    } catch {}
  }

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
        if (targetChatId) return

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

  // v1 nav — preserved for backward compatibility
  const v1NavItems = useMemo(() => ([
    { path: '/app',         label: t('nav_home'),     ActiveIcon: RiHomeFill,      Icon: RiHomeLine },
    { path: '/progress',    label: t('nav_progress'), ActiveIcon: RiBarChart2Fill, Icon: RiBarChart2Line },
    { path: '/nutrition',   label: t('nav_diet'),     ActiveIcon: RiLeafFill,      Icon: RiLeafLine },
    { path: '/social',      label: t('nav_chat'),     ActiveIcon: RiChat3Fill,     Icon: RiChat3Line },
    { path: '/communities', label: 'Crews',           ActiveIcon: RiTeamFill,      Icon: RiTeamLine },
    { path: '/coach',       label: t('nav_coach'),    ActiveIcon: RiBrainFill,     Icon: RiBrainLine },
    { path: '/profile',     label: t('nav_profile'),  ActiveIcon: RiUser3Fill,     Icon: RiUser3Line },
  ]), [t])

  // v2 shell — 5 primary tabs (core daily flow), Coach is the differentiating middle slot
  const v2NavItems = useMemo(() => ([
    { path: '/app',       label: t('nav_home'),     ActiveIcon: RiHomeFill,      Icon: RiHomeLine },
    { path: '/progress',  label: t('nav_progress'), ActiveIcon: RiBarChart2Fill, Icon: RiBarChart2Line },
    { path: '/coach',     label: t('nav_coach'),    ActiveIcon: RiBrainFill,     Icon: RiBrainLine,  accent: true },
    { path: '/nutrition', label: t('nav_diet'),     ActiveIcon: RiLeafFill,      Icon: RiLeafLine },
    { path: '/profile',   label: t('nav_profile'),  ActiveIcon: RiUser3Fill,     Icon: RiUser3Line },
  ]), [t])

  const activeNavItems = v2 ? v2NavItems : v1NavItems

  // Contextual top bar title based on current route (v2 only)
  const shellTitle = useMemo(() => {
    if (path.startsWith('/app'))          return { title: t('nav_home') || 'Today', subtitle: 'Your training day' }
    if (path.startsWith('/progress'))     return { title: t('nav_progress') || 'Progress', subtitle: 'Trends and PRs' }
    if (path.startsWith('/nutrition'))    return { title: t('nav_diet') || 'Nutrition', subtitle: 'Fuel the signal' }
    if (path.startsWith('/social'))       return { title: t('nav_chat') || 'Social', subtitle: 'Crew and chats' }
    if (path.startsWith('/communities'))  return { title: 'Crews', subtitle: 'Find your people' }
    if (path.startsWith('/coach'))        return { title: t('nav_coach') || 'Coach', subtitle: 'AI training partner' }
    if (path.startsWith('/profile'))      return { title: t('nav_profile') || 'Profile', subtitle: 'Your signal' }
    return { title: 'REPMAX', subtitle: '' }
  }, [path, t])

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

      if (Math.abs(diffY) > Math.abs(diffX)) return

      if (lastValidTarget && lastValidTarget.closest('input, button, canvas, .horizontal-scroll, .scroll-x, [data-no-swipe]')) return

      if (Math.abs(diffX) > 80) {
        const paths = activeNavItems.map(n => n.path)
        const currentIndex = paths.indexOf(path)

        if (currentIndex !== -1) {
          if (diffX > 0 && currentIndex < paths.length - 1) {
            navigate(paths[currentIndex + 1])
          } else if (diffX < 0 && currentIndex > 0) {
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
  }, [path, navigate, activeNavItems])

  const onTabClick = (targetPath) => {
    hapticSelection()
    if (targetPath === path) return
    navigate(targetPath)
  }

  const quickActions = [
    { icon: <RiPulseLine size={20} />,   label: 'Log workout', hint: 'Start logging a session',        to: '/app',          tag: 'Today' },
    { icon: <RiLeafLine size={20} />,    label: 'Log meal',    hint: 'Add food + macros',              to: '/nutrition',    tag: 'Nutrition' },
    { icon: <RiRunLine size={20} />,     label: 'Start run',   hint: 'Track a cardio session',         to: '/run',          tag: 'Cardio' },
    { icon: <RiBrainLine size={20} />,   label: 'Ask coach',   hint: 'Get help from the AI coach',     to: '/coach',        tag: 'AI' },
    { icon: <RiTeamLine size={20} />,    label: 'Crews',       hint: 'Join or visit communities',      to: '/communities',  tag: 'Social' },
    { icon: <RiChat3Line size={20} />,   label: 'Chats',       hint: 'Go to your conversations',       to: '/social',       tag: 'Chat' },
    { icon: <RiBookmarkLine size={20} />,label: 'Recovery',    hint: 'Rest day + mobility',            to: '/recovery',     tag: 'Recovery' },
    { icon: <RiBarChart2Line size={20}/>,label: 'Progress',    hint: 'Charts, PRs, streaks',           to: '/progress',     tag: 'Insights' },
  ]

  // -----------------------------------------------------------
  // Legacy (v1) shell
  // -----------------------------------------------------------
  if (!v2) {
    return (
      <div className={`app-wrapper ${isCoachRoute ? 'app-wrapper--coach' : ''}`}>
        <div className={`app-content ${isCoachRoute ? 'app-content--coach' : ''}`}><Outlet /></div>
        <nav className="bottom-nav">
          {v1NavItems.map(item => {
            const isActive = path === item.path
            const IconComponent = isActive ? item.ActiveIcon : item.Icon
            return (
              <button
                key={item.path}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onTabClick(item.path)}
              >
                <IconComponent size={22} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {toast && (
          <div className="push-toast" onClick={() => setToast(null)}>
            <div className="push-toast-title">{toast.title}</div>
            <div className="push-toast-body">{toast.body}</div>
          </div>
        )}
      </div>
    )
  }

  // -----------------------------------------------------------
  // v2 shell — contextual top bar + 5-tab + FAB
  // -----------------------------------------------------------
  return (
    <div className={`app-wrapper app-wrapper--v2 ${isCoachRoute ? 'app-wrapper--coach' : ''}`}>
      {!isCoachRoute && (
        <div className="v2-shell-topbar">
          <div className="v2-shell-topbar__title">
            {shellTitle.title}
            {shellTitle.subtitle && <div className="v2-shell-topbar__sub">{shellTitle.subtitle}</div>}
          </div>
          <button
            type="button"
            className="v2-shell-topbar__icon-btn"
            aria-label="Notifications"
            onClick={() => navigate('/notifications')}
            style={{ position: 'relative' }}
          >
            <RiNotification3Line size={18} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 10, height: 10, borderRadius: 999,
                background: 'var(--accent)',
                boxShadow: '0 0 0 2px var(--bg-card)'
              }} />
            )}
          </button>
          <button
            type="button"
            className="v2-shell-topbar__icon-btn"
            aria-label="Settings"
            onClick={() => navigate('/settings')}
          >
            <RiSettings3Line size={18} />
          </button>
        </div>
      )}

      <div className={`app-content app-content--v2 ${isCoachRoute ? 'app-content--coach' : ''}`}>
        <Outlet />
      </div>

      {!isCoachRoute && (
        <button
          type="button"
          className="v2-fab"
          aria-label="Quick actions"
          onClick={() => { hapticSelection(); setFabOpen(true) }}
        >
          <RiAddLine size={24} />
        </button>
      )}

      <nav className="v2-tabbar" role="tablist">
        {v2NavItems.map(item => {
          const isActive = path === item.path
          const IconComponent = isActive ? item.ActiveIcon : item.Icon
          return (
            <button
              key={item.path}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`v2-tabbar__item ${isActive ? 'v2-tabbar__item--active' : ''} ${item.accent ? 'v2-tabbar__item--accent' : ''}`}
              onClick={() => onTabClick(item.path)}
            >
              <IconComponent size={22} />
              <span className="v2-tabbar__label">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <Sheet open={fabOpen} onClose={() => setFabOpen(false)} title="Quick actions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {quickActions.map(qa => (
            <button
              key={qa.to}
              type="button"
              className="v2-card v2-card--interactive"
              style={{ textAlign: 'left', padding: 14, cursor: 'pointer' }}
              onClick={() => { setFabOpen(false); navigate(qa.to) }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-glow)', color: 'var(--accent)', marginBottom: 10
              }}>
                {qa.icon}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--v2-fs-14)' }}>
                {qa.label}
              </div>
              <div style={{ fontSize: 'var(--v2-fs-12)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {qa.hint}
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      {toast && (
        <div className="push-toast" onClick={() => setToast(null)}>
          <div className="push-toast-title">{toast.title}</div>
          <div className="push-toast-body">{toast.body}</div>
        </div>
      )}
    </div>
  )
}
