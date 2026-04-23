import React from 'react'

export default function Switch({ checked = false, onChange, disabled = false, ariaLabel, className = '', ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`v2-switch ${className}`}
      onClick={() => !disabled && onChange?.(!checked)}
      {...rest}
    />
  )
}
