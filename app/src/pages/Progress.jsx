import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Progress() {
  const { user, profile } = useAuth()
  const [prs, setPRs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('overview')

  useEffect(() => { loadProgress() }, [])

  async function loadProgress() {
    const [prRes, wRes] = await Promise.all([
      supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }),
      supabase.from('workouts').select('*').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(50)
    ])
    setPRs(prRes.data || [])
    setWorkouts(wRes.data || [])
    setLoading(false)
  }

  // Calculate stats
  const totalVolume = workouts.reduce((sum, w) => sum + (w.total_volume || 0), 0)
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0)
  const avgDuration = workouts.length > 0 ? Math.round(totalDuration / workouts.length / 60) : 0

  // Group PRs by exercise (best per exercise)
  const bestPRs = {}
  prs.forEach(pr => {
    if (!bestPRs[pr.exercise_name] || pr.estimated_1rm > bestPRs[pr.exercise_name].estimated_1rm) {
      bestPRs[pr.exercise_name] = pr
    }
  })

  // Build calendar heatmap data for last 30 days
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
              <div className="stat-value">{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(0)}k` : totalVolume}</div>
              <div className="stat-desc">Lbs Total</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{avgDuration}m</div>
              <div className="stat-desc">Avg Duration</div>
            </div>
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 8, margin: '20px 0 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            {['overview', 'prs', 'history'].map(tab => (
              <button
                key={tab}
                className={`btn btn-sm ${view === tab ? 'btn-primary' : ''}`}
                style={{ flex: 1, background: view === tab ? '' : 'transparent', border: 'none', textTransform: 'capitalize' }}
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
                    <div
                      key={i}
                      className={`heatmap-cell ${d.count >= 2 ? 'l4' : d.count === 1 ? 'l2' : ''}`}
                      title={`${d.date}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* Streaks */}
              <div className="stat-row">
                <div className="stat-box">
                  <div className="stat-value">{profile?.current_streak || 0}</div>
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
                  <div className="card-label">Weekly Volume</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, marginTop: 12 }}>
                    {Object.entries(weeklyVolume).slice(-8).map(([week, vol], i, arr) => {
                      const max = Math.max(...arr.map(([, v]) => v))
                      const heightPct = max > 0 ? (vol / max) * 100 : 0
                      return (
                        <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: '100%',
                            height: `${heightPct}%`,
                            background: `linear-gradient(to top, var(--accent), rgba(204, 255, 0, 0.4))`,
                            borderRadius: '4px 4px 0 0',
                            minHeight: 4,
                            transition: 'height 0.5s ease'
                          }} />
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>W{i + 1}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
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
                          {pr.weight} lbs × {pr.reps} reps · Est. 1RM: {Math.round(pr.estimated_1rm)} lbs
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
                        {w.total_volume > 1000 ? `${(w.total_volume / 1000).toFixed(1)}k` : w.total_volume || 0} lbs
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
