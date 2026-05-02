import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, Shield, Trophy } from 'lucide-react'
import { format } from 'date-fns'

export default function Profile() {
  const { user, profile, isPro, isUltra } = useAuth()
  const [pledges, setPledges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('lockd_pledges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPledges(data || [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <div className="loading-spinner" />

  const tier = isUltra ? 'ULTRA' : isPro ? 'PRO' : 'FREE'

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 700,
            border: '2px solid var(--border)',
          }}>
            {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>
              {profile?.display_name || profile?.username}
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>@{profile?.username}</p>
          </div>
        </div>
        <Link to="/settings" style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SettingsIcon size={18} color="var(--text-2)" />
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div className="streak-badge" style={{ flex: 1, justifyContent: 'center', padding: '12px 16px' }}>
          🔥 {profile?.current_streak || 0} day streak
        </div>
        <div className="streak-badge" style={{ flex: 1, justifyContent: 'center', padding: '12px 16px' }}>
          🏆 {profile?.longest_streak || 0} best
        </div>
      </div>

      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: tier === 'FREE' ? 'var(--bg-card)' : 'var(--bg-elevated)',
        borderColor: tier !== 'FREE' ? 'var(--border-h)' : undefined,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{tier}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {tier === 'FREE' ? 'upgrade for war rooms + hard mode' : 'all features unlocked'}
          </p>
        </div>
      </div>

      {isPro && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 24, marginBottom: 12,
          }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              <Shield size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              Hard Mode Pledges
            </p>
          </div>

          {pledges.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ color: 'var(--text-3)', fontSize: '0.86rem' }}>no pledges yet. pick your battle.</p>
            </div>
          ) : (
            pledges.map(pledge => (
              <div key={pledge.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pledge.title}</p>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background:
                      pledge.status === 'completed' ? 'rgba(48,164,108,0.15)' :
                      pledge.status === 'failed' ? 'rgba(229,72,77,0.15)' :
                      'var(--accent-glow)',
                    color:
                      pledge.status === 'completed' ? 'var(--success)' :
                      pledge.status === 'failed' ? 'var(--danger)' :
                      'var(--text-2)',
                  }}>
                    {pledge.status.toUpperCase()}
                  </span>
                </div>
                {pledge.description && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 6 }}>{pledge.description}</p>
                )}
                <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {format(new Date(pledge.start_date), 'MMM d')} → {format(new Date(pledge.end_date), 'MMM d, yyyy')}
                  {' · '}{pledge.duration_days} days
                </p>
              </div>
            ))
          )}
        </>
      )}

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 32 }}>
        member since {profile?.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : '...'}
      </p>
    </div>
  )
}
