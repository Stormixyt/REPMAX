import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { RiCloseLine, RiVipCrownFill, RiFireFill, RiMessage3Fill } from '@remixicon/react'

export default function UserProfileModal({ userId, onClose, onMessage }) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) setProfile(data)
    }
    if (userId) load()
  }, [userId])

  if (!profile) return null

  const isPro = profile.subscription_status === 'pro'
  const avatarUrl = profile.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${profile.avatar_seed || profile.id}&backgroundColor=transparent`

  // Let's determine aura based on streak
  let auraLevel = 'aura-none'
  const streak = profile.current_streak || 0
  if (streak >= 3) auraLevel = 'aura-green'
  if (streak >= 7) auraLevel = 'aura-blue'
  if (streak >= 14) auraLevel = 'aura-purple'
  if (streak >= 30) auraLevel = 'aura-gold'
  if (streak >= 100) auraLevel = 'aura-fire'

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal glass-modal" style={{ padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Banner */}
        <div style={{ height: 100, background: isPro ? 'linear-gradient(135deg, var(--accent), #ffeb3b)' : 'var(--bg-elevated)' }} />
        
        {/* Header content */}
        <div style={{ padding: '0 20px 20px', marginTop: -40, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className={`aura-ring ${auraLevel}`} style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', border: '4px solid var(--bg-card)', position: 'relative' }}>
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              {/* Fake online indicator since we don't have realtime presence */}
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, background: 'var(--success)', border: '2px solid var(--bg-card)', borderRadius: '50%' }} />
            </div>
            
            <button className="icon-btn" onClick={onClose} style={{ marginTop: 44, background: 'rgba(255,255,255,0.1)' }}>
              <RiCloseLine size={24} />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {profile.display_name} {isPro && <RiVipCrownFill size={18} color="var(--accent)" />}
            </h2>
            {profile.username && <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: 'var(--accent)', fontFamily: 'monospace' }}>@{profile.username}</p>}
          </div>
          
          {/* Status */}
          {profile.status_emoji && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 20, marginTop: 12, fontSize: '0.85rem' }}>
              <span>{profile.status_emoji}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{profile.status_text}</span>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          {/* Bio section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 8 }}>About Me</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: profile.bio ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontStyle: profile.bio ? 'normal' : 'italic', lineHeight: 1.5 }}>
              {profile.bio || "This user hasn't added a bio yet."}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{profile.total_workouts || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Workouts</div>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RiFireFill size={16} color="#ef4444" /> {profile.current_streak || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Day Streak</div>
            </div>
            {profile.favorite_lift && (
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'capitalize' }}>{profile.favorite_lift.replace('_', ' ')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Fav Lift</div>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-full" onClick={() => { onClose(); onMessage(profile.id); }}>
            <RiMessage3Fill size={18} /> Send Message
          </button>
        </div>
      </div>
    </div>
  )
}
