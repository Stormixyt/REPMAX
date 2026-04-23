import React from 'react'

const TONES = {
  default: '',
  accent: 'v2-badge--accent',
  ultra: 'v2-badge--ultra',
  gold: 'v2-badge--gold',
  live: 'v2-badge--live',
}

export default function Badge({ tone = 'default', className = '', children, ...rest }) {
  const classes = ['v2-badge', TONES[tone] || '', className].filter(Boolean).join(' ')
  return <span className={classes} {...rest}>{children}</span>
}
