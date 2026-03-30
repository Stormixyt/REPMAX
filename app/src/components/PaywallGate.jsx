import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RiLockFill, RiVipCrownFill } from '@remixicon/react'

export default function PaywallGate({ children, feature = 'this feature' }) {
  const { isPro } = useAuth()
  const navigate = useNavigate()

  if (isPro) return children

  return (
    <div className="paywall-gate">
      <div className="paywall-blur">{children}</div>
      <div className="paywall-overlay">
        <div className="paywall-icon">
          <RiLockFill size={28} />
        </div>
        <h3 className="paywall-title">Unlock {feature}</h3>
        <p className="paywall-text">Upgrade to PRO to access {feature} and 10+ premium features.</p>
        <button className="btn btn-primary" onClick={() => navigate('/subscribe')}>
          <RiVipCrownFill size={16} />
          Upgrade to PRO
        </button>
      </div>
    </div>
  )
}
