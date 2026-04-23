import React from 'react'

const SIZES = { sm: 'v2-btn--sm', md: 'v2-btn--md', lg: 'v2-btn--lg', xl: 'v2-btn--xl' }
const VARIANTS = {
  primary: 'v2-btn--primary',
  secondary: 'v2-btn--secondary',
  ghost: 'v2-btn--ghost',
  danger: 'v2-btn--danger',
  ultra: 'v2-btn--ultra',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  pill = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = [
    'v2-btn',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    block ? 'v2-btn--block' : '',
    pill ? 'v2-btn--pill' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading
        ? <span className="v2-btn__spinner" aria-hidden style={spinnerStyle} />
        : (leftIcon && <span className="v2-btn__icon" aria-hidden>{leftIcon}</span>)}
      <span className="v2-btn__label">{children}</span>
      {!loading && rightIcon && <span className="v2-btn__icon" aria-hidden>{rightIcon}</span>}
    </button>
  )
}

const spinnerStyle = {
  width: 16,
  height: 16,
  border: '2px solid transparent',
  borderTopColor: 'currentColor',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
  display: 'inline-block',
}
