import React from 'react'

export function List({ className = '', children, ...rest }) {
  return <div className={`v2-list ${className}`} {...rest}>{children}</div>
}

export default function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  as: Tag = 'button',
  className = '',
  onClick,
  type,
  ...rest
}) {
  const props = Tag === 'button' ? { type: type || 'button', onClick } : { onClick }
  return (
    <Tag className={`v2-list-row ${className}`} {...props} {...rest}>
      {icon && <span className="v2-list-row__icon" aria-hidden>{icon}</span>}
      <span className="v2-list-row__body">
        {title && <div className="v2-list-row__title">{title}</div>}
        {subtitle && <div className="v2-list-row__subtitle">{subtitle}</div>}
      </span>
      {trailing !== undefined && <span className="v2-list-row__trailing">{trailing}</span>}
    </Tag>
  )
}
