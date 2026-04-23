import React from 'react'

export default function SectionHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`v2-section-head ${className}`}>
      <div>
        {eyebrow && <span className="v2-section-head__eyebrow">{eyebrow}</span>}
        <h2 className="v2-section-head__title">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
