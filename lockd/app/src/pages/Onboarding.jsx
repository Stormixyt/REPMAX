import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const SUGGESTED_TASKS = [
  { emoji: '🏋️', title: 'Gym / Workout' },
  { emoji: '🥶', title: 'Cold Shower' },
  { emoji: '📖', title: 'Read 20 Pages' },
  { emoji: '🧘', title: 'Meditate' },
  { emoji: '💧', title: 'Drink 3L Water' },
  { emoji: '🚫', title: 'No Junk Food' },
  { emoji: '📝', title: 'Journal' },
  { emoji: '🛌', title: 'Sleep by 11pm' },
]

export default function Onboarding() {
  const { user, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [selected, setSelected] = useState([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function toggleTask(task) {
    setSelected(prev =>
      prev.find(t => t.title === task.title)
        ? prev.filter(t => t.title !== task.title)
        : prev.length < 5 ? [...prev, task] : prev
    )
  }

  function addCustom() {
    if (!custom.trim() || selected.length >= 5) return
    setSelected(prev => [...prev, { emoji: '🔥', title: custom.trim() }])
    setCustom('')
  }

  async function finish() {
    if (!username.trim() || selected.length === 0) return
    setLoading(true)
    setError(null)

    try {
      const { error: profileErr } = await supabase
        .from('lockd_profiles')
        .upsert({
          id: user.id,
          username: username.trim().toLowerCase(),
          display_name: username.trim(),
        }, {
          onConflict: 'id',
        })
      if (profileErr) throw profileErr

      const tasks = selected.map((t, i) => ({
        user_id: user.id,
        title: t.title,
        emoji: t.emoji,
        sort_order: i,
      }))
      const { error: taskErr } = await supabase.from('lockd_tasks').insert(tasks)
      if (taskErr) throw taskErr

      await fetchProfile(user.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="auth-screen__glow auth-screen__glow--top" />
      <div className="auth-screen__glow auth-screen__glow--bottom" />

      <div className="auth-card onboarding-card stagger-item">
        <div className="auth-badge">
          <span className="auth-badge__dot" />
          Setup flow
        </div>

        <div className="onboarding-progress" aria-hidden="true">
          <div className="onboarding-progress__step">
            <span style={{ transform: `scaleX(${step >= 0 ? 1 : 0})` }} />
          </div>
          <div className="onboarding-progress__step">
            <span style={{ transform: `scaleX(${step >= 1 ? 1 : 0})` }} />
          </div>
        </div>

        {step === 0 ? (
          <>
            <p style={{ fontSize: '2.7rem', marginBottom: 14 }}>🔒</p>
            <h1 className="page-title" style={{ marginBottom: 10 }}>
              Pick Your Handle
            </h1>
            <p className="page-subtitle" style={{ marginBottom: 26 }}>
              This is how your squad sees you when you post proof, stack streaks, and call each other out.
            </p>

            <input
              className="input"
              type="text"
              placeholder="username"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={20}
              autoFocus
            />
            <p className="helper-copy">
              Letters, numbers, underscores. 3-20 chars.
            </p>

            <button
              className="btn btn-primary"
              style={{ marginTop: 24 }}
              disabled={username.trim().length < 3}
              onClick={() => setStep(1)}
            >
              Next Step
            </button>
          </>
        ) : (
          <>
            <p className="page-kicker">Step 2 of 2</p>
            <h1 className="page-title" style={{ marginBottom: 10 }}>
              Your Non-Negotiables
            </h1>
            <p className="page-subtitle" style={{ marginBottom: 22 }}>
              Pick one to five daily rules. These are the things that keep counting, whether you feel like it or not.
            </p>

            <div className="task-chip-grid">
              {SUGGESTED_TASKS.map(task => {
                const active = selected.find(t => t.title === task.title)
                return (
                  <button
                    key={task.title}
                    onClick={() => toggleTask(task)}
                    className={`task-chip${active ? ' is-selected' : ''}`}
                  >
                    {task.emoji} {task.title}
                  </button>
                )
              })}
            </div>

            <div className="composer-row" style={{ marginBottom: 14 }}>
              <input
                className="input"
                placeholder="custom task..."
                value={custom}
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                maxLength={40}
              />
              <button className="btn btn-outline btn-small" onClick={addCustom} style={{ flexShrink: 0 }}>
                Add
              </button>
            </div>

            {selected.length > 0 && (
              <div className="list-block" style={{ marginBottom: 18 }}>
                <div style={{ padding: '14px 16px 0' }}>
                  <p className="divider-label">
                  YOUR LIST ({selected.length}/5)
                  </p>
                </div>
                {selected.map((t, i) => (
                  <div key={i} className="list-row">
                    <span style={{ fontSize: '0.88rem' }}>{t.emoji} {t.title}</span>
                    <button
                      type="button"
                      onClick={() => setSelected(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        background: 'none',
                        color: 'var(--text-3)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="status-pill status-pill--danger" style={{ justifyContent: 'center', padding: '12px 14px', marginBottom: 12 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setStep(0)} style={{ flex: 1 }}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={finish}
                disabled={loading || selected.length === 0}
                style={{ flex: 2 }}
              >
                {loading ? 'Locking in...' : 'Lock In 🔒'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
