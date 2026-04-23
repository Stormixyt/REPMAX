import React from 'react'

export function ProgressBar({ value = 0, max = 100, ultra = false, className = '', label, ...rest }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={`v2-progress ${ultra ? 'v2-progress--ultra' : ''} ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      {...rest}
    >
      <div className="v2-progress__fill" style={{ ['--_fill']: `${pct}%` }} />
    </div>
  )
}

export function Ring({
  value = 0,
  max = 100,
  size = 80,
  thickness = 6,
  color,
  children,
  className = '',
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={`v2-ring ${className}`}
      style={{
        ['--_size']: `${size}px`,
        ['--_thickness']: `${thickness}px`,
        ['--_progress']: pct,
        ['--_color']: color || 'var(--accent)',
      }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...rest}
    >
      <div className="v2-ring__inner">{children}</div>
    </div>
  )
}

export default ProgressBar
