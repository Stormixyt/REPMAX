import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { RiPhoneLine, RiPhoneFill, RiVideoLine, RiCloseLine } from '@remixicon/react'
import { Avatar } from '../ui'

/**
 * v2 Incoming call sheet — replaces the inline prompt previously drawn inside App.jsx.
 * Uses v2 tokens (Sheet vibe, no backdrop blocking) so other app chrome stays usable,
 * but slides in from the top with a strong visual hierarchy.
 */
export default function IncomingCallSheet({ prompt, onDismiss, onAnswer }) {
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    if (!prompt?.expiresAt) { setSecondsLeft(null); return undefined }
    const tick = () => {
      const ms = new Date(prompt.expiresAt).getTime() - Date.now()
      setSecondsLeft(Math.max(0, Math.round(ms / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [prompt?.expiresAt])

  const initials = useMemo(() => {
    const name = prompt?.callerName || '??'
    return name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).filter(Boolean).join('')
  }, [prompt?.callerName])

  if (!prompt?.chatId) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--v2-safe-top) + 12px)',
        left: 12,
        right: 12,
        zIndex: 10001,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
      aria-live="assertive"
      role="alert"
    >
      <div
        className="v2-card v2-card--glass"
        style={{
          width: 'min(460px, 100%)',
          pointerEvents: 'auto',
          padding: 14,
          animation: 'v2SheetUp 0.45s var(--v2-ease-spring, cubic-bezier(0.175, 0.885, 0.32, 1.275))',
          background: 'linear-gradient(180deg, rgba(20,22,28,0.96), rgba(12,13,17,0.96))',
          border: '1px solid rgba(204, 255, 0, 0.22)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="lg" className="v2-avatar--ring">{initials}</Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v2-card__eyebrow" style={{ marginBottom: 2 }}>
              <span className="v2-badge v2-badge--accent" style={{ animation: 'v2PulseDot 1.2s infinite' }}>
                {prompt.withVideo ? <RiVideoLine size={10} /> : <RiPhoneFill size={10} />}
                {prompt.withVideo ? 'Video Call' : 'Incoming Call'}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--v2-fs-18)',
              fontWeight: 800,
              letterSpacing: 'var(--v2-tracking-snug)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {prompt.callerName || 'Gym Buddy'}
            </div>
            <div style={{ fontSize: 'var(--v2-fs-12)', color: 'var(--text-tertiary)' }}>
              {secondsLeft != null ? `Expires in ${secondsLeft}s` : 'Ringing…'}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="v2-btn v2-btn--ghost v2-btn--sm"
            style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
          >
            <RiCloseLine size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="v2-btn v2-btn--secondary v2-btn--md"
            style={{ flex: 1 }}
            onClick={onDismiss}
          >
            Decline
          </button>
          <button
            type="button"
            className="v2-btn v2-btn--primary v2-btn--md"
            style={{ flex: 1.2, gap: 8 }}
            onClick={onAnswer}
          >
            {prompt.withVideo ? <RiVideoLine size={18} /> : <RiPhoneLine size={18} />}
            Answer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
