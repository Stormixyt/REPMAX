import React from 'react'

export default function Card({
  as: Tag = 'div',
  variant,
  padding,
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'v2-card',
    variant ? `v2-card--${variant}` : '',
    padding ? `v2-card--pad-${padding}` : '',
    interactive ? 'v2-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ')

  return <Tag className={classes} {...rest}>{children}</Tag>
}

export function CardEyebrow({ children, className = '' }) {
  return <div className={`v2-card__eyebrow ${className}`}>{children}</div>
}
export function CardTitle({ children, className = '', as: Tag = 'h3' }) {
  return <Tag className={`v2-card__title ${className}`}>{children}</Tag>
}
export function CardSubtitle({ children, className = '' }) {
  return <p className={`v2-card__subtitle ${className}`}>{children}</p>
}
