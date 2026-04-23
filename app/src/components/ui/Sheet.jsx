import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function useLockBodyScroll(active) {
  useEffect(() => {
    if (!active) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [active])
}

export function Sheet({ open, onClose, title, children, className = '' }) {
  useLockBodyScroll(!!open)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="v2-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`v2-sheet ${className}`} onClick={e => e.stopPropagation()}>
        <div className="v2-sheet__grip" aria-hidden />
        {title && <div className="v2-sheet__title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  )
}

export function Modal({ open, onClose, title, children, className = '' }) {
  useLockBodyScroll(!!open)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="v2-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`v2-modal ${className}`} onClick={e => e.stopPropagation()}>
        {title && <div className="v2-sheet__title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Sheet
