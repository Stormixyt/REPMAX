import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generateProgram } from '../lib/groq'
import ProBadge from '../components/ProBadge'
import ThemeSelector from '../components/ThemeSelector'
import AvatarBuilder from '../components/AvatarBuilder'
import { RiSettings3Fill, RiRefreshLine, RiVipCrownFill, RiStarFill, RiChat3Fill, RiFireFill, RiCalendarCheckFill, RiFlashlightFill, RiCheckFill, RiArrowRightSLine, RiMedalFill, RiTeamFill, RiCrosshair2Fill, RiShuffleFill, RiPencilFill, RiImageEditFill, RiAtLine, RiEditLine, RiTrophyFill, RiEmotionHappyFill } from '@remixicon/react'

function getAuraLevel(streak) {
  if (streak >= 30) return 'fire'
  if (streak >= 14) return 'high'
  if (streak >= 7) return 'medium'
  if (streak >= 3) return 'low'
  return ''
}

const BADGE_DEFS = [
  { id: 'first_workout', icon: '🔥', name: 'First Workout', desc: 'Completed your first session', check: p => (p?.total_workouts || 0) >= 1 },
  { id: 'streak_7', icon: '💪', name: '7-Day Streak', desc: 'Trained 7 days in a row', check: p => (p?.longest_streak || 0) >= 7 },
  { id: 'streak_30', icon: '🏆', name: '30-Day Streak', desc: 'Trained 30 days in a row', check: p => (p?.longest_streak || 0) >= 30 },
  { id: 'workout_100', icon: '🎯', name: 'Century Club', desc: 'Completed 100 workouts', check: p => (p?.total_workouts || 0) >= 100 },
  { id: 'pro_member', icon: '👑', name: 'PRO Member', desc: 'Upgraded to REPMAX PRO', check: (p, isPro) => isPro },
  { id: 'custom_avatar', icon: '📸', name: 'Face Reveal', desc: 'Uploaded a custom avatar', check: p => !!p?.image_url },
  { id: 'has_bio', icon: '✍️', name: 'Storyteller', desc: 'Added a bio to your profile', check: p => !!p?.bio && p.bio.length > 0 },
  { id: 'has_username', icon: '🏷️', name: 'Identity', desc: 'Set your unique username', check: p => !!p?.username },
]

const STATUS_OPTIONS = [
  { emoji: '🏋️', text: 'At the gym' },
  { emoji: '😴', text: 'Rest day' },
  { emoji: '💪', text: 'Post-workout' },
  { emoji: '🍗', text: 'Meal prepping' },
  { emoji: '🧘', text: 'Stretching' },
  { emoji: '🔥', text: 'On a roll' },
  { emoji: '🎯', text: 'PR hunting' },
  { emoji: '', text: 'Clear status' },
]

const LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Pull-Up', 'Barbell Row', 'Dips', 'Romanian Deadlift']

export default function Profile() {
  const { user, profile, signOut, updateProfile, fetchProfile, isPro, subscriptionTier } = useAuth()
  const navigate = useNavigate()
  const [regenerating, setRegenerating] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showBioEditor, setShowBioEditor] = useState(false)
  const [bioText, setBioText] = useState(profile?.bio || '')
  const [rating, setRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const drawnAvatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`
  const avatarUrl = profile?.image_url || drawnAvatarUrl

  const avatarConfig = profile?.avatar_config || {}
  const frameId = avatarConfig.profileFrame || 'none'
  const nameEffectId = avatarConfig.nameEffect || 'none'
  const bannerId = avatarConfig.profileBanner || 'none'

  const FRAME_STYLES = {
    none: {},
    'gold-ring': { boxShadow: '0 0 0 3px #ffb800, 0 0 16px rgba(255,184,0,0.5)' },
    'neon-glow': { boxShadow: '0 0 0 3px var(--accent), 0 0 22px var(--accent-glow-strong)' },
    'aurora': { boxShadow: '0 0 0 3px #b026ff, 0 0 18px rgba(176,38,255,0.6), 0 0 36px rgba(0,212,255,0.3)' },
    'fire': { boxShadow: '0 0 0 3px #ff5e00, 0 0 20px rgba(255,94,0,0.6), 0 0 40px rgba(255,42,133,0.2)' },
    'diamond': { boxShadow: '0 0 0 3px #00d4ff, 0 0 22px rgba(0,212,255,0.7), 0 0 44px rgba(176,38,255,0.25)' },
  }
  const NAME_STYLES = {
    none: {},
    'gradient-fire': { background: 'linear-gradient(90deg,#ff5e00,#ff2a85)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    'gradient-aurora': { background: 'linear-gradient(90deg,#b026ff,#00d4ff,#ccff00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    'gradient-gold': { background: 'linear-gradient(90deg,#ffb800,#ffd700,#ff5e00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    'glow-neon': { textShadow: '0 0 8px var(--accent), 0 0 20px var(--accent-glow)' },
  }
  const BANNER_STYLES = {
    none: {},
    'dark-grid': { background: 'linear-gradient(180deg,rgba(14,10,22,0.9),rgba(7,7,7,0.95))' },
    'aurora-wave': { background: 'linear-gradient(135deg,rgba(176,38,255,0.3),rgba(0,212,255,0.2),rgba(255,42,133,0.15))' },
    'fire-fade': { background: 'linear-gradient(135deg,rgba(255,94,0,0.3),rgba(255,42,133,0.15),rgba(176,38,255,0.1))' },
    'gold-luxury': { background: 'linear-gradient(135deg,rgba(255,184,0,0.25),rgba(255,215,0,0.1),rgba(204,255,0,0.08))' },
  }

  const frameStyle = FRAME_STYLES[frameId] || {}
  const nameStyle = NAME_STYLES[nameEffectId] || {}
  const bannerStyle = BANNER_STYLES[bannerId] || {}

  const canFeedback = (profile?.total_workouts || 0) >= 6

  const earnedBadges = BADGE_DEFS.filter(b => b.check(profile, isPro))
  const unearnedBadges = BADGE_DEFS.filter(b => !b.check(profile, isPro))

  async function regenerateProgram() {
    setRegenerating(true)
    const result = await generateProgram({
      goal: profile?.goal, experience_level: profile?.experience_level,
      training_days: profile?.training_days, equipment: profile?.equipment,
      preferred_split: profile?.preferred_split, display_name: profile?.display_name
    })
    if (result.success) {
      await supabase.from('programs').update({ active: false }).eq('user_id', user.id)
      await supabase.from('programs').insert({
        user_id: user.id, name: result.program.name || 'New Program',
        split_type: profile?.preferred_split, total_weeks: result.program.weeks?.length || 4,
        program_data: result.program, active: true
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

  async function setStatus(emoji, text) {
    await updateProfile({ status_emoji: emoji, status_text: text })
    setShowStatusPicker(false)
    showToast('Status updated!')
  }

  async function saveBio() {
    await updateProfile({ bio: bioText.slice(0, 150) })
    setShowBioEditor(false)
    showToast('Bio saved!')
  }

  async function setFavoriteLift(lift) {
    await updateProfile({ favorite_lift: lift })
    showToast(`Favorite lift: ${lift}`)
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
      <div className="profile-hero" style={{ position: 'relative', padding: '24px 0 16px', borderRadius: 22, ...bannerStyle }}>
        <div className={`profile-avatar-lg aura-ring ${getAuraLevel(profile?.current_streak || 0)}`} style={{ position: 'relative', overflow: 'visible', background: 'var(--bg-elevated)', border: isPro ? '3px solid var(--accent)' : '2px solid var(--border)', ...frameStyle }}>
          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          <button
            onClick={() => setShowAvatarBuilder(true)}
            style={{
              position: 'absolute', bottom: -4, right: -4,
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              border: '3px solid var(--bg-primary)', borderRadius: '50%',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', transition: 'transform 0.15s'
            }}
          >
            <RiPencilFill size={16} />
          </button>
          {isPro && <div className="profile-pro-ring" />}
        </div>
        <h2 className="profile-display-name" style={nameStyle}>
          {profile?.display_name || 'Athlete'}
          {isPro && <ProBadge size="md" tier={subscriptionTier} />}
        </h2>
        {profile?.username && (
          <p style={{ color: 'var(--accent)', fontSize: '0.88rem', fontWeight: 600, margin: '-4px 0 0', fontFamily: 'var(--font-mono, monospace)' }}>
            @{profile.username}
          </p>
        )}
        <p className="profile-email">{user?.email}</p>

        {/* Status */}
        <button
          onClick={() => setShowStatusPicker(true)}
          style={{
            background: profile?.status_emoji ? 'var(--bg-card)' : 'var(--bg-elevated)',
            border: '1px solid var(--border)', borderRadius: 20,
            padding: '6px 14px', cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)',
            transition: 'all 0.2s', marginTop: 8
          }}
        >
          {profile?.status_emoji ? (
            <><span>{profile.status_emoji}</span> {profile.status_text}</>
          ) : (
            <><RiEmotionHappyFill size={14} /> Set status</>
          )}
        </button>

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

      {/* Bio */}
      <div className="card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => { setBioText(profile?.bio || ''); setShowBioEditor(true) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-label" style={{ margin: 0 }}>Bio</div>
          <RiEditLine size={16} color="var(--text-tertiary)" />
        </div>
        <p style={{ fontSize: '0.85rem', color: profile?.bio ? 'var(--text-secondary)' : 'var(--text-tertiary)', margin: '8px 0 0', lineHeight: 1.5, fontStyle: profile?.bio ? 'normal' : 'italic' }}>
          {profile?.bio || 'Tap to add a bio...'}
        </p>
      </div>

      {/* Stats Row */}
      <div className="stat-row" style={{ marginBottom: 12 }}>
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

      {/* Favorite Lift */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label">Favorite Lift</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {LIFTS.map(lift => (
            <button
              key={lift}
              onClick={() => setFavoriteLift(lift)}
              style={{
                padding: '6px 12px', borderRadius: 10,
                border: `1.5px solid ${profile?.favorite_lift === lift ? 'var(--accent)' : 'var(--border)'}`,
                background: profile?.favorite_lift === lift ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                color: profile?.favorite_lift === lift ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {lift}
            </button>
          ))}
        </div>
      </div>

      {/* Trophy Case */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label"><RiTrophyFill size={14} style={{ color: '#fbbf24', verticalAlign: -2 }} /> Trophy Case</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
          {earnedBadges.map(b => (
            <div key={b.id} style={{
              textAlign: 'center', padding: '10px 4px', borderRadius: 12,
              background: 'var(--accent-glow)', border: '1px solid var(--accent)',
              animation: 'pulse 3s ease infinite'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{b.icon}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{b.name}</div>
            </div>
          ))}
          {unearnedBadges.map(b => (
            <div key={b.id} style={{
              textAlign: 'center', padding: '10px 4px', borderRadius: 12,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', opacity: 0.4
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4, filter: 'grayscale(1)' }}>{b.icon}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>{b.name}</div>
            </div>
          ))}
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
      {showAvatarBuilder && <AvatarBuilder onClose={() => setShowAvatarBuilder(false)} />}

      {/* Status Picker Modal */}
      {showStatusPicker && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowStatusPicker(false) }}>
          <div className="modal" style={{ maxWidth: 340 }}>
            <h2 className="modal-title" style={{ marginBottom: 16 }}>Set Your Status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUS_OPTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStatus(s.emoji, s.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 14,
                    background: profile?.status_emoji === s.emoji && s.emoji ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                    border: `1px solid ${profile?.status_emoji === s.emoji && s.emoji ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                    color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600
                  }}
                >
                  <span style={{ fontSize: '1.3rem', width: 28, textAlign: 'center' }}>{s.emoji || '❌'}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bio Editor Modal */}
      {showBioEditor && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBioEditor(false) }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <h2 className="modal-title" style={{ marginBottom: 4 }}>Edit Bio</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>Tell the world about yourself. Max 150 characters.</p>
            <textarea
              className="input"
              rows={3}
              maxLength={150}
              placeholder="I lift heavy things and put them back down..."
              value={bioText}
              onChange={e => setBioText(e.target.value)}
              style={{ resize: 'none', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', color: bioText.length >= 140 ? '#f87171' : 'var(--text-tertiary)' }}>{bioText.length}/150</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={saveBio}>Save Bio</button>
          </div>
        </div>
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
