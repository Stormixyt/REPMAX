import React from 'react'

export default function Stat({ label, value, delta, direction, className = '', children, ...rest }) {
  return (
    <div className={`v2-stat ${className}`} {...rest}>
      {label && <div className="v2-stat__label">{label}</div>}
      <div className="v2-stat__value">{value ?? children}</div>
      {delta !== undefined && delta !== null && (
        <div className={`v2-stat__delta v2-stat__delta--${direction || (String(delta).startsWith('-') ? 'down' : 'up')}`}>
          {delta}
        </div>
      )}
    </div>
  )
}

export function StatGrid({ cols = 2, className = '', children }) {
  return (
    <div className={`v2-stat-grid ${cols === 3 ? 'v2-stat-grid--3' : ''} ${className}`}>
      {children}
    </div>
  )
}
