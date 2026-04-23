import React from 'react'

export default function Chip({
  active = false,
  size = 'md',
  leftIcon,
  rightIcon,
  as: Tag = 'button',
  className = '',
  children,
  onClick,
  type,
  ...rest
}) {
  const classes = [
    'v2-chip',
    active ? 'v2-chip--active' : '',
    size === 'sm' ? 'v2-chip--sm' : '',
    className,
  ].filter(Boolean).join(' ')

  const props = Tag === 'button'
    ? { type: type || 'button', onClick, 'aria-pressed': active ? 'true' : 'false' }
    : { onClick }

  return (
    <Tag className={classes} {...props} {...rest}>
      {leftIcon && <span aria-hidden>{leftIcon}</span>}
      {children}
      {rightIcon && <span aria-hidden>{rightIcon}</span>}
    </Tag>
  )
}
