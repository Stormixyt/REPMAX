import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiVipCrownFill, RiBrainFill, RiBarChart2Fill, RiTeamFill, RiDownloadFill, RiShieldCheckFill, RiSparklingFill, RiArrowLeftLine, RiPaletteFill, RiFlashlightFill, RiCheckFill, RiStarFill, RiChat3Fill, RiLeafFill, RiTimerFlashFill, RiRocketFill, RiLoader4Fill, RiCloseLine, RiSendPlaneFill } from '@remixicon/react'

const TIERS = {
  pro: {
    name: 'PRO',
    price: '3',
    currency: '€',
    period: '/week',
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
    price: '5',
    currency: '€',
    period: '/week',
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
  const { user, profile, isPro, isUltra, subscriptionTier, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [requesting, setRequesting] = useState(false)
  const [requestTier, setRequestTier] = useState(null)
  const [existingRequest, setExistingRequest] = useState(null)
  const [loadingRequest, setLoadingRequest] = useState(true)
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedTier, setSelectedTier] = useState('ultra')

  useEffect(() => {
    loadExistingRequest()
  }, [user?.id])

  async function loadExistingRequest() {
    if (!user?.id) return
    const { data } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    setExistingRequest(data?.[0] || null)
    setLoadingRequest(false)
  }

  async function handleRequest(tier) {
    setRequestTier(tier)
    setShowConfirm(true)
  }

  async function submitRequest() {
    setRequesting(true)

    await supabase.from('subscription_requests').insert({
      user_id: user.id,
      requested_tier: requestTier,
      status: 'pending'
    })

    await updateProfile({
      pro_request_status: 'pending',
      pro_requested_at: new Date().toISOString()
    })

    setShowConfirm(false)
    setRequesting(false)
    await loadExistingRequest()
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

  // Pending request view
  if (existingRequest?.status === 'pending') {
    const tier = TIERS[existingRequest.requested_tier] || TIERS.pro
    return (
      <div className="page">
        <button onClick={() => navigate(-1)} className="back-btn">
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div className="pro-crown-float" style={{ marginBottom: 20 }}>
            <RiTimerFlashFill size={56} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
            Request <span style={{ color: tier.color }}>{tier.name}</span> Pending
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 340, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Your request for REPMAX {tier.name} is being reviewed. You'll be notified once it's approved.
          </p>

          <div className="card" style={{ background: 'rgba(204,255,0,0.05)', border: '1px solid rgba(204,255,0,0.15)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', animation: 'pulseGlow 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Awaiting review</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
              Requested {new Date(existingRequest.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Rejected view
  if (existingRequest?.status === 'rejected') {
    return (
      <div className="page">
        <button onClick={() => navigate(-1)} className="back-btn">
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>😔</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 8 }}>
            Request Not Approved
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 340, margin: '0 auto 16px' }}>
            {existingRequest.reason || 'Your request was not approved at this time.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await updateProfile({ pro_request_status: null })
              setExistingRequest(null)
            }}
          >
            Request Again
          </button>
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
                onClick={() => handleRequest(selectedTier)}
                style={{
                  marginTop: 20, fontSize: '1.05rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: isUltraTier ? 'linear-gradient(135deg, #ff2a85, #ff6b6b)' : '',
                  animation: 'pulseGlow 2s ease-in-out infinite'
                }}
              >
                <RiSendPlaneFill size={18} /> Request {tier.name} Access
              </button>
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

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <h2 className="modal-title" style={{ marginBottom: 8 }}>
              Request {TIERS[requestTier]?.name} Access
            </h2>
            <p className="modal-subtitle" style={{ marginBottom: 16 }}>
              Your request will be reviewed by the REPMAX team. You'll be notified once approved.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Price:</strong> {TIERS[requestTier]?.currency}{TIERS[requestTier]?.price}{TIERS[requestTier]?.period}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={submitRequest} disabled={requesting}>
                {requesting ? <RiLoader4Fill size={18} className="spin" /> : <><RiSendPlaneFill size={16} /> Submit</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
