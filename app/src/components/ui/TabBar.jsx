import React from 'react'

export default function TabBar({ items = [], activePath, onNavigate, moreBadge }) {
  return (
    <nav className="v2-tabbar" role="tablist" aria-label="Primary">
      {items.map(item => {
        const active = item.path === activePath || (item.match?.(activePath))
        const Icon = active && item.ActiveIcon ? item.ActiveIcon : item.Icon
        return (
          <button
            key={item.key || item.path}
            type="button"
            role="tab"
            aria-selected={active ? 'true' : 'false'}
            aria-label={item.label}
            className={`v2-tabbar__item ${active ? 'v2-tabbar__item--active' : ''}`}
            onClick={() => onNavigate(item)}
          >
            {Icon ? <Icon size={22} /> : null}
            <span className="v2-tabbar__label">{item.label}</span>
            {item.badge ? <span className="v2-tabbar__more-count">{item.badge}</span> : null}
            {item.key === 'more' && moreBadge ? <span className="v2-tabbar__more-count">{moreBadge}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
