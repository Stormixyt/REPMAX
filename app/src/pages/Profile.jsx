import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/groq'
import ProBadge from '../components/ProBadge'
import ThemeSelector from '../components/ThemeSelector'
import AvatarBuilder from '../components/AvatarBuilder'
import { RiSettings3Fill, RiRefreshLine, RiVipCrownFill, RiStarFill, RiChat3Fill, RiFireFill, RiCalendarCheckFill, RiFlashlightFill, RiCheckFill, RiArrowRightSLine, RiMedalFill, RiTeamFill, RiCrosshair2Fill, RiShuffleFill, RiPencilFill, RiImageEditFill } from '@remixicon/react'

export default function Profile() {
  const { user, profile, signOut, updateProfile, fetchProfile, isPro } = useAuth()
  const navigate = useNavigate()
  const [regenerating, setRegenerating] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`

  const canFeedback = (profile?.total_workouts || 0) >= 6

  async function regenerateProgram() {
    setRegenerating(true)
    const result = await generateProgram({
      goal: profile?.goal,
      experience_level: profile?.experience_level,
      training_days: profile?.training_days,
      equipment: profile?.equipment,
      preferred_split: profile?.preferred_split,
      display_name: profile?.display_name
    })

    if (result.success) {
      await supabase.from('programs').update({ active: false }).eq('user_id', user.id)
      await supabase.from('programs').insert({
        user_id: user.id,
        name: result.program.name || 'New Program',
        split_type: profile?.preferred_split,
        total_weeks: result.program.weeks?.length || 4,
        program_data: result.program,
        active: true
      })
      showToast('New program generated! 🔥')
    } else {
      showToast('Failed to generate program')
    }
    setRegenerating(false)
  }

  async function submitFeedback() {
    if (rating === 0) return
    await supabase.from('feedback').insert({ user_id: user.id, rating, comment: feedbackText })
    if (!isPro) {
      await updateProfile({ pro_until: new Date(Date.now() + 30 * 86400000).toISOString() })
    }
    setFeedbackSent(true)
    setTimeout(() => { setShowFeedback(false); setFeedbackSent(false) }, 2000)
  }

  async function randomizeAvatar() {
    const newSeed = Math.random().toString(36).substring(7)
    await updateProfile({ avatar_seed: newSeed })
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Profile</h1>
        <button className="icon-btn" onClick={() => navigate('/settings')}>
          <RiSettings3Fill size={22} />
        </button>
      </div>

      {/* Avatar + Info */}
      <div className="profile-hero" style={{ position: 'relative' }}>
        <div className="profile-avatar-lg" style={{ position: 'relative', overflow: 'visible', background: 'var(--bg-elevated)', border: isPro ? '3px solid var(--accent)' : '2px solid var(--border)' }}>
          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          {/* Edit avatar button */}
          <button
            onClick={() => setShowAvatarBuilder(true)}
            style={{
              position: 'absolute', bottom: -4, right: -4,
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              border: '3px solid var(--bg-primary)', borderRadius: '50%',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              transition: 'transform 0.15s'
            }}
          >
            <RiPencilFill size={16} />
          </button>
          {isPro && <div className="profile-pro-ring" />}
        </div>
        <h2 className="profile-display-name">
          {profile?.display_name || 'Athlete'}
          {isPro && <ProBadge size="md" />}
        </h2>
        <p className="profile-email">{user?.email}</p>

        {/* Quick avatar actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={randomizeAvatar}>
            <RiShuffleFill size={14} /> Randomize
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowAvatarBuilder(true)}>
            <RiImageEditFill size={14} /> Customize
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stat-row" style={{ marginBottom: 24 }}>
        <div className="stat-box">
          <div className="stat-value">{profile?.total_workouts || 0}</div>
          <div className="stat-desc">Workouts</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{profile?.current_streak || 0}</div>
          <div className="stat-desc">Streak</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{profile?.longest_streak || 0}</div>
          <div className="stat-desc">Best Streak</div>
        </div>
      </div>

      {/* Training Preferences */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label">Training Preferences</div>
        <div className="profile-pref-grid">
          <div className="profile-pref">
            <RiCrosshair2Fill size={16} className="pref-icon" />
            <span className="pref-value">{({ strength: 'Strength', hypertrophy: 'Muscle Growth', athletic: 'Athletic', general: 'General' })[profile?.goal] || 'Not set'}</span>
          </div>
          <div className="profile-pref">
            <RiFlashlightFill size={16} className="pref-icon" />
            <span className="pref-value">{profile?.experience_level ? profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1) : 'Not set'}</span>
          </div>
          <div className="profile-pref">
            <RiCalendarCheckFill size={16} className="pref-icon" />
            <span className="pref-value">{profile?.training_days?.length || 0} days/week</span>
          </div>
          <div className="profile-pref">
            <RiFireFill size={16} className="pref-icon" />
            <span className="pref-value">{profile?.preferred_split?.replace('_', '/').toUpperCase() || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {isPro ? (
        <button className="btn btn-primary btn-full" onClick={regenerateProgram} disabled={regenerating} style={{ marginBottom: 12 }}>
          <RiRefreshLine size={18} className={regenerating ? 'spin' : ''} />
          {regenerating ? 'Generating...' : 'Regenerate Program'}
        </button>
      ) : (
        <button className="btn btn-accent btn-full" onClick={() => navigate('/subscribe')} style={{ marginBottom: 12 }}>
          <RiVipCrownFill size={18} /> Upgrade to PRO
        </button>
      )}

      {/* Verified Feedback */}
      {canFeedback && (
        <div className="card card-feedback" style={{ marginBottom: 12 }} onClick={() => setShowFeedback(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="feedback-icon"><RiChat3Fill size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Leave Feedback</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                {isPro ? 'Help us improve REPMAX' : 'Earn 1 month of PRO access'}
              </div>
            </div>
          </div>
          <RiArrowRightSLine size={20} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      )}

      {/* Settings Link */}
      <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RiSettings3Fill size={20} style={{ color: 'var(--text-tertiary)' }} />
            <span>Settings</span>
          </div>
          <RiArrowRightSLine size={20} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      <ThemeSelector />

      {/* Avatar Builder Modal */}
      {showAvatarBuilder && (
        <AvatarBuilder onClose={() => setShowAvatarBuilder(false)} />
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFeedback(false) }}>
          <div className="modal">
            {feedbackSent ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <RiCheckFill size={48} className="accent-icon" />
                <h2 className="modal-title" style={{ marginTop: 12 }}>Thank You!</h2>
                <p className="modal-subtitle">{!isPro ? 'Your PRO access has been activated for 30 days!' : 'Your feedback helps us improve.'}</p>
              </div>
            ) : (
              <>
                <h2 className="modal-title">Rate Your Experience</h2>
                <p className="modal-subtitle">How's REPMAX working for you?</p>
                <div className="star-rating" style={{ marginBottom: 20 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} className={`star-btn ${n <= rating ? 'active' : ''}`} onClick={() => setRating(n)}>
                      <RiStarFill size={28} />
                    </button>
                  ))}
                </div>
                <div className="input-group">
                  <textarea className="input" rows={3} placeholder="Tell us what you think... (optional)" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} style={{ resize: 'none' }} />
                </div>
                <button className="btn btn-primary btn-full" onClick={submitFeedback} disabled={rating === 0}>Submit Feedback</button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
