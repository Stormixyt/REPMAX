import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, opts = {}) => {
    const id = ++idRef.current
    const toast = { id, message, duration: opts.duration ?? 3200 }
    setToasts(list => [...list, toast])
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration)
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="v2-toast-stack" style={stackStyle} aria-live="polite" aria-atomic="true">
          {toasts.map(t => (
            <div key={t.id} className="v2-toast" style={{ position: 'relative', transform: 'none', left: 'auto', top: 'auto' }}>{t.message}</div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

const stackStyle = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
  zIndex: 1200,
}

export function useToast() {
  const ctx = useContext(ToastContext)
  return ctx || { show: () => {}, dismiss: () => {} }
}

// Convenience: inline toast element
export function Toast({ children, onDismiss, duration = 3200 }) {
  useEffect(() => {
    if (!duration) return undefined
    const t = setTimeout(() => onDismiss?.(), duration)
    return () => clearTimeout(t)
  }, [duration, onDismiss])
  return <div className="v2-toast">{children}</div>
}

export default Toast
