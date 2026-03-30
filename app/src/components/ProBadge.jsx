import { RiVipCrownFill } from '@remixicon/react'

export default function ProBadge({ size = 'sm' }) {
  const sizes = {
    sm: { fontSize: '0.6rem', padding: '2px 8px', iconSize: 10 },
    md: { fontSize: '0.7rem', padding: '4px 12px', iconSize: 12 },
    lg: { fontSize: '0.8rem', padding: '6px 16px', iconSize: 14 },
  }
  const s = sizes[size] || sizes.sm

  return (
    <span className="pro-badge" style={{ fontSize: s.fontSize, padding: s.padding }}>
      <RiVipCrownFill size={s.iconSize} />
      PRO
    </span>
  )
}
