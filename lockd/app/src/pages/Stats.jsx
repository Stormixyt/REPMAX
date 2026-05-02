import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { format, subDays, eachDayOfInterval } from 'date-fns'

export default function Stats() {
  const { user, profile } = useAuth()
  const [proofs, setProofs] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')

    Promise.all([
      supabase.from('lockd_proofs').select('*').eq('user_id', user.id).gte('proof_date', thirtyDaysAgo),
      supabase.from('lockd_tasks').select('*').eq('user_id', user.id).eq('is_active', true),
    ]).then(([{ data: proofData }, { data: taskData }]) => {
      setProofs(proofData || [])
      setTasks(taskData || [])
      setLoading(false)
    })
  }, [user])

  if (loading) return <div className="loading-spinner" />

  const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
  const taskCount = tasks.length || 1

  function dayStatus(date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayProofs = proofs.filter(p => p.proof_date === dateStr)
    if (dayProofs.length === 0) return 'none'
    if (dayProofs.length >= taskCount) return 'full'
    return 'partial'
  }

  const totalProofDays = days.filter(d => dayStatus(d) === 'full').length
  const proofRate = Math.round((totalProofDays / 30) * 100)

  return (
    <div className="page">
      <section className="hero-surface stagger-item">
        <p className="page-kicker">30 day overview</p>
        <div className="page-header page-header--compact">
          <div>
            <h1 className="page-title">Stats</h1>
            <p className="page-subtitle">
              See how consistent you have really been lately, not how consistent you felt.
            </p>
          </div>

          <div className="score-orb" style={{ '--fill': `${proofRate}%` }}>
            <div className="score-orb__inner">
              <span className="score-orb__value">{proofRate}%</span>
              <span className="score-orb__label">Hit rate</span>
            </div>
          </div>
        </div>

        <div className="metric-grid">
        {[
          { label: 'Current Streak', value: `${profile?.current_streak || 0}`, emoji: '🔥' },
          { label: 'Best Streak', value: `${profile?.longest_streak || 0}`, emoji: '🏆' },
          { label: 'Total Proofs', value: `${profile?.total_proofs || 0}`, emoji: '📸' },
        ].map(stat => (
          <div key={stat.label} className="metric-card">
            <span className="metric-card__eyebrow">{stat.emoji} {stat.label}</span>
            <span className="metric-card__value">{stat.value}</span>
            <p className="metric-card__meta">
              {stat.label === 'Current Streak' ? 'Days still alive' : stat.label === 'Best Streak' ? 'Personal record' : 'All time uploads'}
            </p>
          </div>
        ))}
        </div>
      </section>

      <div className="card stagger-item" style={{ animationDelay: '90ms' }}>
        <div className="section-title-row">
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.98rem' }}>Proof Calendar</p>
            <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
              Green means fully proved, amber means partial, dark means missed.
            </p>
          </div>
          <p className="streak-badge">{proofRate}% completion</p>
        </div>

        <div className="calendar-grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} style={{
              textAlign: 'center',
              fontSize: '0.65rem',
              color: 'var(--text-4)',
              fontWeight: 600,
              padding: '4px 0',
            }}>
              {d}
            </div>
          ))}

          {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}

          {days.map(day => {
            const status = dayStatus(day)
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div
                key={day.toISOString()}
                title={`${format(day, 'MMM d')}: ${status}`}
                className="calendar-cell"
                style={{
                  background:
                    status === 'full' ? 'var(--success)' :
                    status === 'partial' ? 'var(--warning)' :
                    'var(--bg-elevated)',
                  border: isToday ? '2px solid var(--text)' : '1px solid transparent',
                  opacity: status === 'none' ? 0.3 : 1,
                  transition: 'all 0.2s',
                }}
              />
            )
          })}
        </div>

        <div className="glass-row" style={{ marginTop: 16 }}>
          <span className="mini-pill"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Full</span>
          <span className="mini-pill"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> Partial</span>
          <span className="mini-pill"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} /> Missed</span>
        </div>
      </div>

      <div className="card stagger-item" style={{ marginTop: 12, animationDelay: '150ms' }}>
        <div className="section-title-row">
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.98rem' }}>Per-Task Completion</p>
            <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
              Which habits are holding up and which ones are getting shaky.
            </p>
          </div>
        </div>
        {tasks.map(task => {
          const taskProofs = proofs.filter(p => p.task_id === task.id)
          const rate = Math.round((taskProofs.length / 30) * 100)
          return (
            <div key={task.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '0.86rem' }}>{task.emoji} {task.title}</span>
                <span className={`status-pill ${rate >= 80 ? 'status-pill--success' : rate >= 50 ? 'status-pill--warning' : 'status-pill--danger'}`}>
                  {rate}%
                </span>
              </div>
              <div className="progress-track">
                <div style={{
                  height: '100%',
                  width: `${rate}%`,
                  background: rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)',
                  transition: 'width 0.4s var(--ease)',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
