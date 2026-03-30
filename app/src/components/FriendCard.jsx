import { RiNotification3Fill, RiSwordFill, RiMoreFill } from '@remixicon/react'
import ProBadge from './ProBadge'

export default function FriendCard({ friend, onNudge, onInvite, onRemove }) {
  const initials = (friend.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const lastActive = friend.last_workout ? getTimeAgo(friend.last_workout) : 'No workouts yet'

  return (
    <div className="friend-card">
      <div className="friend-card-left">
        <div className="friend-avatar">
          {initials}
          {friend.subscription_status === 'pro' && (
            <div className="friend-pro-dot" />
          )}
        </div>
        <div className="friend-info">
          <div className="friend-name">
            {friend.display_name || 'Athlete'}
            {friend.subscription_status === 'pro' && <ProBadge size="sm" />}
          </div>
          <div className="friend-meta">
            {friend.total_workouts || 0} workouts · {lastActive}
          </div>
        </div>
      </div>
      <div className="friend-actions">
        <button className="icon-btn" onClick={() => onNudge?.(friend)} title="Nudge">
          <RiNotification3Fill size={18} />
        </button>
        <button className="icon-btn icon-btn-accent" onClick={() => onInvite?.(friend)} title="Invite to train">
          <RiSwordFill size={18} />
        </button>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}
