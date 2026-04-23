import React from 'react'

export default function EmptyState({ icon, title, body, action, className = '', children }) {
  return (
    <div className={`v2-empty ${className}`}>
      {icon && <div className="v2-empty__icon" aria-hidden>{icon}</div>}
      {title && <div className="v2-empty__title">{title}</div>}
      {body && <div className="v2-empty__body">{body}</div>}
      {action}
      {children}
    </div>
  )
}
