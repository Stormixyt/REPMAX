import React from 'react'
import { createPortal } from 'react-dom'
import { RiInformationLine } from '@remixicon/react'

/**
 * v2 Call toast — replaces the generic .toast element shown when a call
 * ends/declines. Floats at the top center, fades after a few seconds.
 */
export default function CallToastV2({ message }) {
  if (!message) return null
  return createPortal(
    <div className="v2-toast" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <RiInformationLine size={16} style={{ color: 'var(--accent)' }} />
      <span>{message}</span>
    </div>,
    document.body
  )
}
