import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Page({ wide = false, className = '', children }) {
  return (
    <div className={`v2-page ${wide ? 'v2-page-wide' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function PageTopbar({ title, back, onBack, actions, subtitle }) {
  const navigate = useNavigate()
  const handleBack = () => {
    if (onBack) return onBack()
    if (back === true) return navigate(-1)
    if (typeof back === 'string') return navigate(back)
  }
  return (
    <div className="v2-topbar">
      {back !== undefined && (
        <button type="button" className="v2-topbar__back" onClick={handleBack} aria-label="Go back">
          <span aria-hidden>←</span>
        </button>
      )}
      <div className="v2-topbar__title">
        {title}
        {subtitle && <div className="v2-shell-topbar__sub">{subtitle}</div>}
      </div>
      {actions && <div className="v2-topbar__actions">{actions}</div>}
    </div>
  )
}

export function ShellTopbar({ title, subtitle, left, right }) {
  return (
    <div className="v2-shell-topbar">
      {left}
      <div className="v2-shell-topbar__title">
        {title}
        {subtitle && <div className="v2-shell-topbar__sub">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function Fab({ onClick, ariaLabel = 'Primary action', children }) {
  return (
    <button type="button" className="v2-fab" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
