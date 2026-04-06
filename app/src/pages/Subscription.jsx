import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiVipCrownFill, RiBrainFill, RiBarChart2Fill, RiTeamFill, RiDownloadFill, RiShieldCheckFill, RiSparklingFill, RiArrowLeftLine, RiPaletteFill, RiFlashlightFill, RiCheckFill, RiStarFill, RiChat3Fill, RiLeafFill } from '@remixicon/react'

const PRO_FEATURES = [
  { icon: RiBrainFill, title: 'AI Coach Chat', desc: 'Unlimited questions to your personal AI fitness expert' },
  { icon: RiBarChart2Fill, title: 'Advanced Analytics', desc: 'Full charts, muscle heatmaps, strength projections' },
  { icon: RiTeamFill, title: 'Unlimited Friends', desc: 'Connect with your entire crew, no limits' },
  { icon: RiPaletteFill, title: 'Custom Themes', desc: 'Pink, Blue, Gold — make the app yours' },
  { icon: RiSparklingFill, title: 'Unlimited AI Programs', desc: 'Regenerate programs anytime with priority AI' },
  { icon: RiChat3Fill, title: 'Group Chats', desc: 'Create group chats and coordinate gym sessions' },
  { icon: RiFlashlightFill, title: 'Recurring Lock-In Series', desc: 'Turn one gym invite into a 4-week buddy plan' },
  { icon: RiLeafFill, title: 'Smart Diet Tracker', desc: 'AI nutrition search, water tracking, meal plans' },
  { icon: RiDownloadFill, title: 'Export Data', desc: 'Download full workout history as CSV' },
  { icon: RiShieldCheckFill, title: 'PRO Badge', desc: 'Gold verified badge on your profile everywhere' },
]

const COMPARISON = [
  { feature: 'AI Programs', free: '1', pro: 'Unlimited' },
  { feature: 'AI Coach', free: '—', pro: 'Unlimited' },
  { feature: 'Friends', free: '3 max', pro: 'Unlimited' },
  { feature: 'Themes', free: 'Default', pro: '4 choices' },
  { feature: 'Analytics', free: 'Basic', pro: 'Advanced' },
  { feature: 'Social', free: 'Direct + single invites', pro: 'Groups + recurring buddy series' },
  { feature: 'Diet Tracker', free: 'Basic', pro: 'Full + AI' },
  { feature: 'Data Export', free: '—', pro: 'CSV / PDF' },
  { feature: 'PRO Badge', free: '—', pro: '✓' },
]

export default function Subscription() {
  const { user, profile, isPro, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const weeksCompleted = profile?.subscription_weeks_completed || 0
  const canCancel = weeksCompleted >= 5

  async function handleSubscribe() {
    setProcessing(true)
    await new Promise(r => setTimeout(r, 2000))

    await updateProfile({
      subscription_status: 'pro',
      subscription_started_at: new Date().toISOString(),
      subscription_weeks_completed: 0,
      pro_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })

    await supabase.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'started',
      amount: 0
    })

    setProcessing(false)
  }

  async function handleCancel() {
    if (!canCancel) return
    await updateProfile({ subscription_status: 'cancelled' })
    await supabase.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'cancelled',
      amount: 0
    })
    setShowCancel(false)
  }

  if (isPro) {
    return (
      <div className="page">
        <button onClick={() => navigate(-1)} className="back-btn">
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div className="page-header">
          <h1 className="page-title">Your <span className="accent">PRO</span> Subscription</h1>
        </div>

        <div className="card card-accent" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div className="pro-crown-float" style={{ marginBottom: 12 }}>
            <RiVipCrownFill size={44} className="accent-icon" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>
            REPMAX PRO Active
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Week {weeksCompleted} of 5 minimum commitment
          </div>
          <div className="commitment-bar" style={{ marginTop: 16 }}>
            <div className="commitment-fill" style={{ width: `${Math.min(100, (weeksCompleted / 5) * 100)}%` }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
            {canCancel ? 'You can now cancel anytime' : `${5 - weeksCompleted} weeks until you can cancel`}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ fontSize: '0.95rem' }}>Billing</div>
          <div className="card-subtitle">$5.00 / week | Next: {new Date(Date.now() + 7 * 86400000).toLocaleDateString()}</div>
        </div>

        {canCancel && (
          <button className="btn btn-danger btn-full" onClick={() => setShowCancel(true)}>Cancel Subscription</button>
        )}

        {showCancel && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCancel(false) }}>
            <div className="modal">
              <h2 className="modal-title">Cancel PRO?</h2>
              <p className="modal-subtitle">You'll lose access to all PRO features at the end of this billing period.</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCancel(false)}>Keep PRO</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pro-page" style={{ background: 'var(--bg-primary)' }}>
      {/* Back button */}
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
          <RiVipCrownFill size={64} color="var(--accent)" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
          Upgrade to <span style={{ color: 'var(--accent)' }}>PRO</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
          Unlock the full power of REPMAX. Train smarter, connect deeper, look better.
        </p>
      </div>

      {/* Price Card */}
      <div className="pro-price-glass">
        <div className="pro-price-amount">
          <span className="pro-price-dollar">$</span>
          <span className="pro-price-value">5</span>
          <span className="pro-price-period">/week</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 24 }}>
          First 7 days free · Cancel after 5 weeks
        </p>
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleSubscribe}
          disabled={processing}
          style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {processing ? <span className="spinner" /> : <><RiVipCrownFill size={18} /> Start Free Trial</>}
        </button>
      </div>

      {/* Social Proof */}
      <div style={{ textAlign: 'center', padding: '0 24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
          {[1,2,3,4,5].map(i => <RiStarFill key={i} size={18} color="var(--accent)" />)}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 4 }}>
          "Best fitness app I've ever used. The AI programs are insane."
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>— Marcus, PRO member since Week 1</p>
      </div>

      {/* Features Grid */}
      <div style={{ padding: '0 24px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          Everything in <span style={{ color: 'var(--accent)' }}>PRO</span>
        </h2>
        <div className="pro-features-grid" style={{ padding: 0 }}>
          {PRO_FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} className="pro-feature-item">
                <div className="pro-feature-icon"><Icon size={24} /></div>
                <div className="pro-feature-title">{f.title}</div>
                <div className="pro-feature-desc">{f.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ padding: '0 24px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          Free vs PRO
        </h2>
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="pro-comparison-row" style={{ background: 'var(--bg-elevated)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div style={{ paddingLeft: 16 }}>Feature</div>
            <div style={{ textAlign: 'center' }}>Free</div>
            <div style={{ textAlign: 'center', color: 'var(--accent)' }}>PRO</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className="pro-comparison-row" style={{ paddingLeft: 16 }}>
              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{row.feature}</div>
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>{row.free}</div>
              <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 600, fontSize: '0.82rem' }}>{row.pro}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ padding: '16px 24px 60px', textAlign: 'center' }}>
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleSubscribe}
          disabled={processing}
          style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'pulseGlow 2s ease-in-out infinite' }}
        >
          {processing ? <span className="spinner" /> : <><RiVipCrownFill size={18} /> Start 7-Day Free Trial</>}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 12 }}>
          $5/week after trial · 5-week minimum · Cancel anytime after
        </p>
      </div>
    </div>
  )
}
