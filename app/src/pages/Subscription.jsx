import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSellAppMissingConfig, openSellAppCheckout } from '../lib/sellapp'
import { RiVipCrownFill, RiBrainFill, RiBarChart2Fill, RiTeamFill, RiDownloadFill, RiShieldCheckFill, RiSparklingFill, RiArrowLeftLine, RiPaletteFill, RiFlashlightFill, RiCheckFill, RiStarFill, RiChat3Fill, RiLeafFill, RiTimerFlashFill, RiRocketFill, RiLoader4Fill, RiCloseLine, RiSendPlaneFill } from '@remixicon/react'

const TIERS = {
  pro: {
    name: 'PRO',
    price: '9.99',
    currency: '€',
    period: '/month',
    color: 'var(--accent)',
    icon: RiVipCrownFill,
    tagline: 'For serious lifters',
    features: [
      'Unlimited AI programs',
      'Weekly AI adaptation',
      'Full periodization cycles',
      'Advanced progress analytics',
      'Custom themes (4 colors)',
      'Unlimited friends',
      'Group chats',
      'Smart diet tracker',
      'Premium app skin',
      'PRO badge on profile',
    ]
  },
  ultra: {
    name: 'ULTRA',
    price: '19.99',
    currency: '€',
    period: '/month',
    color: '#ff2a85',
    icon: RiRocketFill,
    tagline: '15 exclusive features',
    popular: true,
    features: [
      'Everything in PRO',
      '① Plateau Doctor — detects stalled lifts, prescribes the exact fix',
      '② Exercise ROI heatmap — see which lifts actually pay off',
      '③ 14-day PR forecast — know your strongest session ahead of time',
      '④ Live PR probability on every working set',
      '⑤ Auto-deload oracle — predicts your optimal rest week',
      '⑥ Signature Lift Card — animated, shareable, tiered by population percentile',
      '⑦ Training DNA Sigil — unique emblem beside your username',
      '⑧ Leaderboard Aura — animated gradient + particle trail on chat + crew boards',
      '⑨ ULTRA Identity Ring — gemstone ring on profile, tiers up monthly',
      '⑩ Progression Reel — auto-stitched monthly photo clip',
      '⑪⑫⑬ City, Gym & Split Crews with weekly King-of-the-[x] crown',
      '⑭ Shared PR Wall with live crew reactions',
      '⑮ Challenge Rooms + Elite Streak Board (top 1% per country)',
      'V6 Aurora skin — apex interface, ULTRA only',
      'Priority AI + unlimited Coach with 3 model personalities',
      'Early access to every future feature drop',
    ]
  }
}

const COMPARISON = [
  { feature: 'AI Programs', free: '1', pro: '∞', ultra: '∞ + Priority' },
  { feature: 'AI Coach', free: '—', pro: '10/day', ultra: 'Unlimited' },
  { feature: 'ULTRA Lab', free: 'Preview', pro: 'Preview', ultra: 'Full access' },
  { feature: 'Routine Import', free: '—', pro: '—', ultra: 'Text + screenshots + edit' },
  { feature: 'Friends', free: '3', pro: '∞', ultra: '∞' },
  { feature: 'Themes', free: 'Default', pro: '4 colors', ultra: '4 colors' },
  { feature: 'Analytics', free: 'Basic', pro: 'Advanced', ultra: 'Intelligence layer' },
  { feature: 'Social', free: 'DMs only', pro: 'Groups + invites', ultra: 'Social Edge planner' },
  { feature: 'Diet Tracker', free: 'Basic', pro: 'Full + search', ultra: 'Full + AI scan' },
  { feature: 'Data Export', free: '—', pro: '—', ultra: 'CSV / PDF' },
  { feature: 'Badge', free: '—', pro: '⭐ PRO', ultra: '🚀 ULTRA' },
  { feature: 'Support', free: 'Community', pro: 'Priority', ultra: 'Priority' },
]

export default function Subscription() {
  const { user, subscriptionTier } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [checkingOutTier, setCheckingOutTier] = useState(null)
  const [selectedTier, setSelectedTier] = useState('ultra')

  useEffect(() => {
    setMessage('')
  }, [selectedTier])

  function handleCheckout(tier) {
    if (!user?.id) {
      navigate('/auth?mode=signup')
      return
    }

    const missingConfig = getSellAppMissingConfig(tier)
    if (missingConfig.length > 0) {
      setMessage(`Sell.app checkout is missing: ${missingConfig.join(', ')}`)
      return
    }

    setMessage('')
    setCheckingOutTier(tier)

    const result = openSellAppCheckout(tier, {
      email: user.email,
      userId: user.id,
    })

    if (!result.ok) {
      setCheckingOutTier(null)
      setMessage(result.error)
    }
  }

  // Already subscribed view
  if (subscriptionTier === 'pro' || subscriptionTier === 'ultra') {
    const tier = TIERS[subscriptionTier]
    const Icon = tier.icon
    return (
      <div className="page">
        <button onClick={() => navigate(-1)} className="back-btn">
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div className="page-header">
          <h1 className="page-title">Your <span className="accent">{tier.name}</span> Plan</h1>
        </div>

        <div className="card card-accent" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Icon size={48} style={{ color: tier.color }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
            REPMAX {tier.name} Active
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {tier.currency}{tier.price}{tier.period} · All features unlocked
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ fontSize: '0.95rem' }}>Your Features</div>
          <div style={{ marginTop: 12 }}>
            {tier.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < tier.features.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <RiCheckFill size={16} style={{ color: tier.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pro-page" style={{ background: 'var(--bg-primary)' }}>
      <button onClick={() => navigate(-1)} style={{
        position: 'fixed', top: 20, left: 20, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff',
        width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(8px)'
      }}>
        <RiArrowLeftLine size={20} />
      </button>

      {/* Hero */}
      <div className="pro-hero-section">
        <div className="pro-crown-float" style={{ marginBottom: 16 }}>
          <RiRocketFill size={64} color="var(--accent)" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
          Choose Your <span style={{ color: 'var(--accent)' }}>Level</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
          Free is powerful. PRO refines the whole app. ULTRA unlocks the lab: intelligence, import studio, and social edge.
        </p>
      </div>

      <div style={{ margin: '0 24px 20px', padding: '14px 16px', borderRadius: 18, border: '1px solid rgba(204,255,0,0.18)', background: 'rgba(204,255,0,0.06)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          Launch promo
        </div>
        <div style={{ marginTop: 6, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
          Use code REPMAXISOUT20 through May 31, 2026 for 10% off all subscriptions.
        </div>
      </div>

      {/* Tier Toggle */}
      <div style={{ display: 'flex', gap: 8, margin: '0 24px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 4 }}>
        {['pro', 'ultra'].map(tier => (
          <button
            key={tier}
            className={`btn btn-sm ${selectedTier === tier ? 'btn-primary' : ''}`}
            style={{ flex: 1, background: selectedTier === tier ? '' : 'transparent', border: 'none', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, fontSize: '0.85rem' }}
            onClick={() => setSelectedTier(tier)}
          >
            {TIERS[tier].name}
            {tier === 'ultra' && <span style={{ fontSize: '0.65rem', marginLeft: 6, background: '#ff2a85', color: '#fff', padding: '2px 6px', borderRadius: 8 }}>POPULAR</span>}
          </button>
        ))}
      </div>

      {/* Selected Tier Card */}
      {(() => {
        const tier = TIERS[selectedTier]
        const Icon = tier.icon
        const isUltraTier = selectedTier === 'ultra'
        return (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{
              background: isUltraTier
                ? 'linear-gradient(135deg, rgba(255,42,133,0.12), rgba(255,42,133,0.03))'
                : 'linear-gradient(135deg, rgba(204,255,0,0.12), rgba(204,255,0,0.03))',
              border: `1px solid ${isUltraTier ? 'rgba(255,42,133,0.25)' : 'rgba(204,255,0,0.25)'}`,
              borderRadius: 20, padding: 28, textAlign: 'center',
              position: 'relative', overflow: 'hidden'
            }}>
              {isUltraTier && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: '#ff2a85', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Most Popular
                </div>
              )}

              <Icon size={40} style={{ color: tier.color, marginBottom: 12 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
                REPMAX {tier.name}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 16 }}>{tier.tagline}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 auto 14px', maxWidth: 280, lineHeight: 1.55 }}>
                {isUltraTier
                  ? 'ULTRA moves the deep analytics, custom routine import, and premium social planning into one dedicated screen.'
                  : 'PRO upgrades the visual polish, smarter tracking, and faster access to the premium surfaces around the app.'}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 4 }}>
                <span style={{ fontSize: '1rem', color: 'var(--text-tertiary)' }}>{tier.currency}</span>
                <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{tier.price}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>{tier.period}</span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Promo code <strong style={{ color: 'var(--accent)' }}>REPMAXISOUT20</strong> auto-applies at checkout.
              </div>

              <div style={{ marginTop: 20, textAlign: 'left' }}>
                {tier.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    <RiCheckFill size={16} style={{ color: tier.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={() => handleCheckout(selectedTier)}
                style={{
                  marginTop: 20, fontSize: '1.05rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: isUltraTier ? 'linear-gradient(135deg, #ff2a85, #ff6b6b)' : '',
                  animation: 'pulseGlow 2s ease-in-out infinite'
                }}
                disabled={checkingOutTier === selectedTier}
              >
                {checkingOutTier === selectedTier ? (
                  <>
                    <RiLoader4Fill size={18} className="spin" /> Opening checkout...
                  </>
                ) : !user?.id ? (
                  <>
                    <RiSendPlaneFill size={18} /> Create Account To Buy {tier.name}
                  </>
                ) : (
                  <>
                    <RiSendPlaneFill size={18} /> Start {tier.name} Checkout
                  </>
                )}
              </button>

              <div style={{ marginTop: 10, fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                Secure Sell.app checkout. Your REPMAX account email and user id are prefilled automatically.
              </div>

              {message && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                }}>
                  {message}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Social Proof */}
      <div style={{ textAlign: 'center', padding: '0 24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
          {[1,2,3,4,5].map(i => <RiStarFill key={i} size={18} color="var(--accent)" />)}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 4 }}>
          "The ULTRA plan is insane. AI Coach alone is worth it."
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>— Marcus, ULTRA member since Week 1</p>
      </div>

      {/* Comparison Table */}
      <div style={{ padding: '0 24px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          Free vs <span style={{ color: 'var(--accent)' }}>PRO</span> vs <span style={{ color: '#ff2a85' }}>ULTRA</span>
        </h2>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="pro-comparison-row" style={{ background: 'var(--bg-elevated)', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div style={{ paddingLeft: 12, flex: 1.2 }}>Feature</div>
            <div style={{ textAlign: 'center', flex: 0.8 }}>Free</div>
            <div style={{ textAlign: 'center', flex: 0.8, color: 'var(--accent)' }}>PRO</div>
            <div style={{ textAlign: 'center', flex: 0.8, color: '#ff2a85' }}>ULTRA</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className="pro-comparison-row" style={{ paddingLeft: 12 }}>
              <div style={{ fontWeight: 500, fontSize: '0.8rem', flex: 1.2 }}>{row.feature}</div>
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.76rem', flex: 0.8 }}>{row.free}</div>
              <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontSize: '0.76rem', flex: 0.8 }}>{row.pro}</div>
              <div style={{ textAlign: 'center', color: '#ff2a85', fontWeight: 600, fontSize: '0.76rem', flex: 0.8 }}>{row.ultra}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
