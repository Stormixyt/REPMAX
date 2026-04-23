import React from 'react'

function initials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || name[0]?.toUpperCase() || '?'
}

export default function Avatar({
  src,
  alt = '',
  name,
  size = 'md',
  ring = false,
  className = '',
  style,
  ...rest
}) {
  const classes = [
    'v2-avatar',
    `v2-avatar--${size}`,
    ring ? 'v2-avatar--ring' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <span className={classes} style={style} {...rest}>
      {src
        ? <img src={src} alt={alt || name || ''} loading="lazy" />
        : <span aria-hidden>{initials(name)}</span>
      }
    </span>
  )
}
