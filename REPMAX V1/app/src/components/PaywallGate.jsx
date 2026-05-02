import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RiLockFill, RiVipCrownFill } from '@remixicon/react'

export default function PaywallGate({
  children,
  feature = 'this feature',
  requiredTier = 'pro',
  title,
  description,
  ctaLabel,
}) {
  const { isPro, isUltra } = useAuth()
  const navigate = useNavigate()

  const normalizedTier = requiredTier === 'ultra' ? 'ultra' : 'pro'
  const hasAccess = normalizedTier === 'ultra' ? isUltra : isPro
  const upgradeLabel = normalizedTier === 'ultra' ? 'ULTRA' : 'PRO'

  if (hasAccess) return children

  return (
    <div className={`paywall-gate ${normalizedTier}`}>
      <div className="paywall-blur">{children}</div>
      <div className="paywall-overlay">
        <div className="paywall-icon">
          <RiLockFill size={28} />
        </div>
        <h3 className="paywall-title">{title || `Unlock ${feature}`}</h3>
        <p className="paywall-text">
          {description || `Upgrade to ${upgradeLabel} to access ${feature} and the premium systems built around it.`}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/subscribe')}>
          <RiVipCrownFill size={16} />
          {ctaLabel || `Upgrade to ${upgradeLabel}`}
        </button>
      </div>
    </div>
  )
}
