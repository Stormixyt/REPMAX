import React, { forwardRef, useId } from 'react'

export const Input = forwardRef(function Input({
  label, hint, error, className = '', id, ...rest
}, ref) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={`v2-field ${className}`}>
      {label && <label htmlFor={fieldId} className="v2-label">{label}</label>}
      <input
        id={fieldId}
        ref={ref}
        className={`v2-input ${error ? 'is-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
      {error ? <div className="v2-field__error">{error}</div> : (hint && <div className="v2-field__hint">{hint}</div>)}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({
  label, hint, error, className = '', id, rows = 4, ...rest
}, ref) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={`v2-field ${className}`}>
      {label && <label htmlFor={fieldId} className="v2-label">{label}</label>}
      <textarea
        id={fieldId}
        ref={ref}
        rows={rows}
        className={`v2-textarea ${error ? 'is-error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
      {error ? <div className="v2-field__error">{error}</div> : (hint && <div className="v2-field__hint">{hint}</div>)}
    </div>
  )
})

export default Input
