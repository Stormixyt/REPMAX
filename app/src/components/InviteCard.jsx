import { RiMapPinFill, RiTimeFill, RiSwordFill, RiCheckFill, RiCloseFill } from '@remixicon/react'

export default function InviteCard({ invite, currentUserId, onAccept, onDecline }) {
  const isReceiver = invite.receiver_id === currentUserId
  const isSender = invite.sender_id === currentUserId
  const isPending = invite.status === 'pending'
  const isAccepted = invite.status === 'accepted'
  const isPast = new Date(invite.scheduled_at) < new Date()

  const scheduledDate = new Date(invite.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = scheduledDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`invite-card ${isAccepted ? 'accepted' : ''} ${isPast ? 'past' : ''}`}>
      <div className="invite-card-header">
        <div className="invite-type-badge">
          <RiSwordFill size={14} />
          {invite.workout_type || 'Training Session'}
        </div>
        <span className={`invite-status ${invite.status}`}>
          {invite.status === 'pending' ? 'Pending' : invite.status === 'accepted' ? 'Confirmed' : invite.status === 'declined' ? 'Declined' : 'Expired'}
        </span>
      </div>

      <h3 className="invite-title">{invite.title}</h3>

      {invite.message && (
        <p className="invite-message">"{invite.message}"</p>
      )}

      <div className="invite-details">
        {invite.location && (
          <div className="invite-detail">
            <RiMapPinFill size={16} className="invite-detail-icon" />
            <span>{invite.location}</span>
          </div>
        )}
        <div className="invite-detail">
          <RiTimeFill size={16} className="invite-detail-icon" />
          <span>{dateStr} at {timeStr}</span>
        </div>
      </div>

      <div className="invite-footer">
        <div className="invite-from">
          {isSender ? `Sent to ${invite.receiver_name || 'Friend'}` : `From ${invite.sender_name || 'Friend'}`}
        </div>
        {isReceiver && isPending && !isPast && (
          <div className="invite-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => onDecline?.(invite.id)}>
              <RiCloseFill size={16} /> Decline
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onAccept?.(invite.id)}>
              <RiCheckFill size={16} /> Accept
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
