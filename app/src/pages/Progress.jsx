import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatWeight, formatVolume, weightLabel } from '../lib/units'
import { getLearningProgress, getLearningStatus } from '../lib/learningEngine'

export default function Progress() {
  const { user, profile } = useAuth()
  const [prs, setPRs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('overview')
  const mounted = useRef(true)

  const unit = profile?.unit_preference || 'lbs'

  useEffect(() => { 
    mounted.current = true
    loadProgress() 
    return () => { mounted.current = false }
  }, [])

  async function loadProgress() {
    const [prRes, wRes] = await Promise.all([
      supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }),
      supabase.from('workouts').select('*').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(50)
    ])
    if (!mounted.current) return
    setPRs(prRes.data || [])
    setWorkouts(wRes.data || [])
    if (mounted.current) setLoading(false)
  }

  // Calculate stats
  const totalVolume = workouts.reduce((sum, w) => sum + (w.total_volume || 0), 0)
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0)
  const avgDuration = workouts.length > 0 ? Math.round(totalDuration / workouts.length / 60) : 0

  // Group PRs by exercise
  const bestPRs = {}
  prs.forEach(pr => {
    if (!bestPRs[pr.exercise_name] || pr.estimated_1rm > bestPRs[pr.exercise_name].estimated_1rm) {
      bestPRs[pr.exercise_name] = pr
    }
  })

  // Heatmap data (last 30 days)
  const heatmapDays = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = workouts.filter(w => w.completed_at?.split('T')[0] === dateStr).length
    heatmapDays.push({ date: dateStr, count, dayLabel: d.toLocaleDateString('en', { weekday: 'narrow' }) })
  }

  // Volume by week
  const weeklyVolume = {}
  workouts.forEach(w => {
    if (!w.completed_at) return
    const d = new Date(w.completed_at)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().split('T')[0]
    weeklyVolume[key] = (weeklyVolume[key] || 0) + (w.total_volume || 0)
  })

  // Duration trends
  const recentDurations = workouts.slice(0, 10).map(w => ({
    date: new Date(w.completed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    minutes: Math.round((w.duration_seconds || 0) / 60)
  })).reverse()

  // Consistency score (last 4 weeks)
  const fourWeeksAgo = new Date(now - 28 * 86400000)
  const recentWorkouts = workouts.filter(w => new Date(w.completed_at) > fourWeeksAgo)
  const plannedDays = (profile?.training_days || []).length || 3
  const expectedSessions = plannedDays * 4
  const consistencyScore = expectedSessions > 0 ? Math.min(100, Math.round((recentWorkouts.length / expectedSessions) * 100)) : 0

  // Muscle group distribution from workout names
  const muscleDistribution = {}
  workouts.forEach(w => {
    const name = (w.day_name || '').toLowerCase()
    if (name.includes('push') || name.includes('chest')) muscleDistribution['Push'] = (muscleDistribution['Push'] || 0) + 1
    else if (name.includes('pull') || name.includes('back')) muscleDistribution['Pull'] = (muscleDistribution['Pull'] || 0) + 1
    else if (name.includes('leg')) muscleDistribution['Legs'] = (muscleDistribution['Legs'] || 0) + 1
    else if (name.includes('upper')) muscleDistribution['Upper'] = (muscleDistribution['Upper'] || 0) + 1
    else if (name.includes('lower')) muscleDistribution['Lower'] = (muscleDistribution['Lower'] || 0) + 1
    else muscleDistribution['Other'] = (muscleDistribution['Other'] || 0) + 1
  })

  const learningStatus = getLearningStatus(profile)
  const learningProgress = getLearningProgress(profile)

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="skeleton" style={{ width: 160, height: 28 }} />
        </div>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />)}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Your <span className="accent">Progress</span></h1>
      </div>

      {/* Learning status for quick onboarding users */}
      {learningStatus && (
        <div className="card" style={{ marginBottom: 16, background: `${learningStatus.color}08`, border: `1px solid ${learningStatus.color}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>{learningStatus.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>REPMAX AI Learning</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{learningStatus.text}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '0.92rem', color: learningStatus.color }}>{learningProgress}%</div>
          </div>
          <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${learningProgress}%`, height: '100%', background: learningStatus.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">📊</div>
          <h3 className="empty-title">No data yet</h3>
          <p className="empty-text">Complete your first workout to start tracking your progress.</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-value">{workouts.length}</div>
              <div className="stat-desc">Workouts</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{formatVolume(totalVolume, unit)}</div>
              <div className="stat-desc">{weightLabel(unit)} Total</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{avgDuration}m</div>
              <div className="stat-desc">Avg Duration</div>
            </div>
          </div>

          {/* Consistency Score */}
          <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="card-label">Weekly Consistency</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {recentWorkouts.length} / {expectedSessions} planned sessions (4 weeks)
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: consistencyScore >= 80 ? 'var(--accent)' : consistencyScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                {consistencyScore}%
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
              <div style={{
                width: `${consistencyScore}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                background: consistencyScore >= 80 ? 'var(--accent)' : consistencyScore >= 50 ? '#f59e0b' : '#ef4444'
              }} />
            </div>
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 6, margin: '16px 0 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            {['overview', 'prs', 'muscles', 'history'].map(tab => (
              <button
                key={tab}
                className={`btn btn-sm ${view === tab ? 'btn-primary' : ''}`}
                style={{ flex: 1, background: view === tab ? '' : 'transparent', border: 'none', textTransform: 'capitalize', fontSize: '0.78rem' }}
                onClick={() => setView(tab)}
              >
                {tab === 'prs' ? 'PRs' : tab}
              </button>
            ))}
          </div>

          {/* Overview */}
          {view === 'overview' && (
            <>
              {/* Activity Heatmap */}
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-label">Last 30 Days</div>
                <div className="card-title" style={{ marginBottom: 12 }}>Activity</div>
                <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${Math.min(heatmapDays.length, 10)}, 1fr)` }}>
                  {heatmapDays.map((d, i) => (
                    <div key={i} className={`heatmap-cell ${d.count >= 2 ? 'l4' : d.count === 1 ? 'l2' : ''}`} title={`${d.date}: ${d.count} workout${d.count !== 1 ? 's' : ''}`} />
                  ))}
                </div>
              </div>

              {/* Streaks */}
              <div className="stat-row">
                <div className="stat-box">
                  <div className="stat-value">{profile?.current_streak || 0}🔥</div>
                  <div className="stat-desc">Current Streak</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{profile?.longest_streak || 0}</div>
                  <div className="stat-desc">Best Streak</div>
                </div>
              </div>

              {/* Volume trend */}
              {Object.keys(weeklyVolume).length > 1 && (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="card-label">Weekly Volume ({weightLabel(unit)})</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, marginTop: 12 }}>
                    {Object.entries(weeklyVolume).slice(-8).map(([week, vol], i, arr) => {
                      const max = Math.max(...arr.map(([, v]) => v))
                      const heightPct = max > 0 ? (vol / max) * 100 : 0
                      return (
                        <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                            {formatVolume(vol, unit)}
                          </div>
                          <div style={{ width: '100%', height: `${heightPct}%`, background: 'linear-gradient(to top, var(--accent), rgba(204, 255, 0, 0.4))', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} />
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>W{i + 1}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Duration trends */}
              {recentDurations.length > 2 && (
                <div className="card" style={{ marginTop: 12 }}>
                  <div className="card-label">Session Duration (min)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginTop: 12 }}>
                    {recentDurations.map((d, i) => {
                      const max = Math.max(...recentDurations.map(x => x.minutes))
                      const h = max > 0 ? (d.minutes / max) * 100 : 0
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>{d.minutes}</span>
                          <div style={{ width: '100%', height: `${h}%`, background: 'linear-gradient(to top, #3b82f6, rgba(59,130,246,0.3))', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Muscle Distribution */}
          {view === 'muscles' && (
            <div>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-label">Training Distribution</div>
                <div className="card-title" style={{ marginBottom: 16 }}>Workout Split Balance</div>
                {Object.entries(muscleDistribution).sort(([, a], [, b]) => b - a).map(([muscle, count]) => {
                  const maxCount = Math.max(...Object.values(muscleDistribution))
                  const pct = (count / maxCount) * 100
                  const colors = { Push: '#ef4444', Pull: '#3b82f6', Legs: '#22c55e', Upper: '#f59e0b', Lower: '#8b5cf6', Other: 'var(--text-tertiary)' }
                  return (
                    <div key={muscle} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{muscle}</span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{count} sessions</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: colors[muscle] || 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {Object.keys(muscleDistribution).length === 0 && (
                <div className="empty-state">
                  <div className="empty-emoji">💪</div>
                  <h3 className="empty-title">No split data</h3>
                  <p className="empty-text">Train more to see your muscle group balance.</p>
                </div>
              )}
            </div>
          )}

          {/* PRs Tab */}
          {view === 'prs' && (
            <div>
              {Object.keys(bestPRs).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-emoji">🏆</div>
                  <h3 className="empty-title">No PRs yet</h3>
                  <p className="empty-text">Keep training — your first PR is coming soon.</p>
                </div>
              ) : (
                Object.values(bestPRs)
                  .sort((a, b) => (b.estimated_1rm || 0) - (a.estimated_1rm || 0))
                  .map(pr => (
                    <div key={pr.id} className="pr-item">
                      <div className="pr-badge">🏆</div>
                      <div className="pr-info">
                        <div className="pr-exercise">{pr.exercise_name}</div>
                        <div className="pr-details">
                          {formatWeight(pr.weight, unit)} {weightLabel(unit)} × {pr.reps} reps · Est. 1RM: {formatWeight(pr.estimated_1rm, unit)} {weightLabel(unit)}
                        </div>
                      </div>
                      <div className="pr-date">{new Date(pr.achieved_at).toLocaleDateString()}</div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* History Tab */}
          {view === 'history' && (
            <div>
              {workouts.map(w => (
                <div key={w.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="card-title" style={{ fontSize: '0.95rem' }}>{w.day_name || 'Workout'}</div>
                      <div className="card-subtitle">{new Date(w.completed_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {formatVolume(w.total_volume, unit)} {weightLabel(unit)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {Math.round((w.duration_seconds || 0) / 60)} min
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
