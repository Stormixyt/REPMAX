import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiVipCrownFill, RiCheckFill, RiCloseLine, RiBrainFill, RiBarChart2Fill, RiTeamFill, RiSwordFill, RiDownloadFill, RiTimerFlashFill, RiShieldCheckFill, RiSparklingFill, RiArrowLeftLine } from '@remixicon/react'

const PRO_FEATURES = [
  { icon: <RiBrainFill size={20} />, title: 'AI Coach Chat', desc: 'Unlimited questions to your personal AI fitness expert' },
  { icon: <RiBarChart2Fill size={20} />, title: 'Advanced Analytics', desc: 'Full charts, muscle heatmaps, strength projections' },
  { icon: <RiTeamFill size={20} />, title: 'Unlimited Friends', desc: 'Connect with your entire crew (free: 3 max)' },
  { icon: <RiSwordFill size={20} />, title: 'Training Invites', desc: 'Invite friends to train together with time & location' },
  { icon: <RiSparklingFill size={20} />, title: 'Unlimited AI Programs', desc: 'Regenerate programs anytime with priority AI' },
  { icon: <RiDownloadFill size={20} />, title: 'Export Data', desc: 'Download your full workout history as CSV' },
  { icon: <RiTimerFlashFill size={20} />, title: 'Custom Rest Timers', desc: 'Save your own rest timer presets per exercise' },
  { icon: <RiShieldCheckFill size={20} />, title: 'PRO Badge', desc: 'Gold verified badge on your profile' },
]

const COMPARISON = [
  { feature: 'AI Program Generation', free: '1 program', pro: 'Unlimited' },
  { feature: 'AI Coach Chat', free: '—', pro: 'Unlimited' },
  { feature: 'Friends', free: '3 max', pro: 'Unlimited' },
  { feature: 'Training Invites', free: '—', pro: 'Unlimited' },
  { feature: 'Analytics', free: 'Basic', pro: 'Advanced' },
  { feature: 'Workout History', free: 'Last 10', pro: 'All time' },
  { feature: 'Data Export', free: '—', pro: 'CSV / PDF' },
  { feature: 'PRO Badge', free: '—', pro: <RiVipCrownFill size={16} /> },
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
    // Mock payment — in production this would redirect to Stripe Checkout
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
      amount: 0 // Free trial
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
        <button className="back-btn" onClick={() => navigate(-1)}>
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div className="page-header">
          <h1 className="page-title">Your <span className="accent">PRO</span> Subscription</h1>
        </div>

        <div className="card card-accent" style={{ marginBottom: 16, textAlign: 'center' }}>
          <RiVipCrownFill size={40} className="accent-icon" style={{ marginBottom: 12 }} />
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
          <div className="card-subtitle">$5.00 / week · Next billing: {new Date(Date.now() + 7 * 86400000).toLocaleDateString()}</div>
        </div>

        {canCancel && (
          <button className="btn btn-danger btn-full" onClick={() => setShowCancel(true)} style={{ marginTop: 8 }}>
            Cancel Subscription
          </button>
        )}

        {showCancel && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCancel(false) }}>
            <div className="modal">
              <h2 className="modal-title">Cancel PRO?</h2>
              <p className="modal-subtitle">You'll lose access to all PRO features at the end of this billing period. Are you sure?</p>
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
    <div className="subscribe-page">
      <button className="back-btn back-btn-float" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={20} />
      </button>

      {/* Hero */}
      <div className="subscribe-hero">
        <div className="subscribe-crown">
          <RiVipCrownFill size={48} />
        </div>
        <h1 className="subscribe-title">Upgrade to <span className="accent">PRO</span></h1>
        <p className="subscribe-subtitle">Unlock the full power of REPMAX and train like an elite athlete.</p>
      </div>

      {/* Price */}
      <div className="price-card">
        <div className="price-amount">
          <span className="price-currency">$</span>
          <span className="price-number">5</span>
          <span className="price-period">/week</span>
        </div>
        <p className="price-note">First 7 days free · Cancel after 5 weeks</p>
        <button className="btn btn-primary btn-full btn-lg subscribe-cta" onClick={handleSubscribe} disabled={processing}>
          {processing ? <span className="spinner" /> : <><RiVipCrownFill size={18} /> Start Free Trial</>}
        </button>
      </div>

      {/* Features Grid */}
      <div className="features-section">
        <h2 className="features-heading">Everything in PRO</h2>
        <div className="features-grid">
          {PRO_FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="comparison-section">
        <h2 className="features-heading">Free vs PRO</h2>
        <div className="comparison-table">
          <div className="comparison-header">
            <div className="comparison-feature">Feature</div>
            <div className="comparison-free">Free</div>
            <div className="comparison-pro">PRO</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className="comparison-row">
              <div className="comparison-feature">{row.feature}</div>
              <div className="comparison-free">{row.free}</div>
              <div className="comparison-pro">{row.pro}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ padding: '32px 24px 60px', textAlign: 'center' }}>
        <button className="btn btn-primary btn-full btn-lg subscribe-cta" onClick={handleSubscribe} disabled={processing}>
          {processing ? <span className="spinner" /> : <><RiVipCrownFill size={18} /> Start 7-Day Free Trial</>}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 12 }}>
          $5/week after trial · 5-week minimum commitment · Cancel anytime after
        </p>
      </div>
    </div>
  )
}
