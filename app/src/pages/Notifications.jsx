import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { markNotificationRead, markAllRead } from '../lib/notifications'
import { RiArrowLeftLine, RiCheckDoubleFill, RiNotification3Fill, RiUserHeartFill, RiSwordFill, RiFlashlightFill, RiCalendarCheckFill, RiMedalFill } from '@remixicon/react'

const ICON_MAP = {
  friend_request: RiUserHeartFill,
  friend_accepted: RiUserHeartFill,
  nudge: RiFlashlightFill,
  invite: RiSwordFill,
  invite_accepted: RiSwordFill,
  invite_declined: RiSwordFill,
  daily_reminder: RiCalendarCheckFill,
  streak_warning: RiFlashlightFill,
  new_pr: RiMedalFill,
  session_reminder: RiCalendarCheckFill,
  weekly_progress: RiMedalFill,
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  async function handleRead(notif) {
    if (!notif.read) {
      await markNotificationRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    // Navigate based on notification type
    const url = notif.data?.url
    if (url) navigate(url)
  }

  async function handleMarkAll() {
    await markAllRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={20} /> Back
      </button>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Notifications</h1>
        {unreadCount > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={handleMarkAll}>
            <RiCheckDoubleFill size={16} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12, marginBottom: 8 }} />)
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <RiNotification3Fill size={48} className="empty-icon" />
          <h3 className="empty-title">No notifications yet</h3>
          <p className="empty-text">You'll see friend requests, training invites, and reminders here.</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map(notif => {
            const Icon = ICON_MAP[notif.type] || RiNotification3Fill
            return (
              <div
                key={notif.id}
                className={`notif-item ${notif.read ? '' : 'unread'}`}
                onClick={() => handleRead(notif)}
              >
                <div className={`notif-icon-wrap ${notif.type?.includes('invite') ? 'accent' : ''}`}>
                  <Icon size={18} />
                </div>
                <div className="notif-content">
                  <div className="notif-title">{notif.title}</div>
                  <div className="notif-body">{notif.body}</div>
                  <div className="notif-time">{timeAgo(notif.created_at)}</div>
                </div>
                {!notif.read && <div className="notif-dot" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
