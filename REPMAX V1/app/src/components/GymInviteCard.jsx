import { RiFlashlightFill, RiMapPin2Fill, RiTimeFill, RiCheckLine } from '@remixicon/react'

export default function GymInviteCard({ senderName, location, time, acceptedBy = [], isMe, onAccept }) {
  const myName = isMe ? null : undefined

  return (
    <div className="gym-invite-card">
      {/* Lightning bolt watermark */}
      <div className="gym-invite-bolt">
        <RiFlashlightFill size={100} />
      </div>

      {/* Sender */}
      <div className="gym-invite-sender">
        <RiFlashlightFill size={14} className="bolt-icon" />
        <span>{senderName} sent a gym invite</span>
      </div>

      {/* Location */}
      <div className="gym-invite-detail">
        <RiMapPin2Fill size={18} className="gym-invite-detail-icon" />
        <div>
          <div className="gym-invite-detail-label">Location</div>
          <div className="gym-invite-detail-value">{location}</div>
        </div>
      </div>

      {/* Time */}
      <div className="gym-invite-detail">
        <RiTimeFill size={18} className="gym-invite-detail-icon" />
        <div>
          <div className="gym-invite-detail-label">Time</div>
          <div className="gym-invite-detail-value">{time}</div>
        </div>
      </div>

      {/* Accepted list */}
      {acceptedBy.length > 0 && (
        <div className="gym-invite-accepted">
          {acceptedBy.map((name, i) => (
            <div key={i} className="gym-invite-chip">
              <RiCheckLine size={12} /> {name}
            </div>
          ))}
        </div>
      )}

      {/* Accept / Status */}
      {!isMe ? (
        <button className="gym-invite-accept-btn" onClick={onAccept}>
          <RiFlashlightFill size={16} /> Accept
        </button>
      ) : (
        <div className="gym-invite-waiting">
          {acceptedBy.length > 0 ? `${acceptedBy.length} accepted` : 'Waiting for responses...'}
        </div>
      )}
    </div>
  )
}
