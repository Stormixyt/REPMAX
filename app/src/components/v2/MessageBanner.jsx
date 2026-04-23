import React from 'react'
import { createPortal } from 'react-dom'
import { RiChat3Fill, RiCloseLine } from '@remixicon/react'

/**
 * v2 Message banner — slim, clickable in-app notification for incoming chats.
 * Rendered as a portal so it floats above the current route.
 */
export default function MessageBanner({ banner, onOpen, onClose }) {
  if (!banner) return null

  const handleClick = () => {
    onOpen?.(banner)
  }

  const stop = (e) => e.stopPropagation()

  return createPortal(
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      style={{
        position: 'fixed',
        top: 'calc(var(--v2-safe-top) + 12px)',
        left: 12,
        right: 12,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        cursor: 'pointer',
        animation: 'v2ToastIn 0.35s var(--v2-ease-out, cubic-bezier(0.22, 1, 0.36, 1))'
      }}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          background: 'rgba(14, 16, 20, 0.94)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid var(--v2-border-soft, rgba(255,255,255,0.12))',
          borderRadius: 'var(--v2-r-xl, 20px)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.45)'
        }}
      >
        <div style={{
          width: 40, height: 40,
          borderRadius: 12,
          background: 'var(--accent-glow, rgba(204,255,0,0.1))',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <RiChat3Fill size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--v2-fs-14, 0.9rem)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {banner.title || 'New message'}
          </div>
          <div style={{
            fontSize: 'var(--v2-fs-13, 0.84rem)',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%'
          }}>
            {banner.body || 'Tap to open chat'}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => { stop(e); onClose?.() }}
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            border: '1px solid var(--v2-border-hair, rgba(255,255,255,0.08))',
            background: 'var(--v2-surface-ghost, rgba(255,255,255,0.04))',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <RiCloseLine size={16} />
        </button>
      </div>
    </div>,
    document.body
  )
}
