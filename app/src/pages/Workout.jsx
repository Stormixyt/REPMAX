import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import RestTimer from '../components/RestTimer'
import { RiArrowLeftLine, RiTimerFlashFill, RiCheckLine, RiTrophyFill, RiFlashlightFill, RiAddFill, RiSubtractFill } from '@remixicon/react'

export default function Workout() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { user, updateProfile, profile } = useAuth()
  const [workout, setWorkout] = useState(null)
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTimer, setShowTimer] = useState(false)
  const [timerDuration, setTimerDuration] = useState(120)
  const [showSummary, setShowSummary] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [justCompleted, setJustCompleted] = useState(null)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    loadWorkout()
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [workoutId])

  async function loadWorkout() {
    const [wRes, sRes] = await Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('sets').select('*').eq('workout_id', workoutId).order('exercise_name').order('set_number')
    ])
    setWorkout(wRes.data)
    setSets(sRes.data || [])
    setLoading(false)
  }

  const exercises = sets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  function updateSet(setId, field, value) {
    setSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s))
  }

  function adjustWeight(setId, delta) {
    setSets(prev => prev.map(s => {
      if (s.id !== setId) return s
      const current = s.actual_weight ?? s.target_weight ?? 0
      return { ...s, actual_weight: Math.max(0, current + delta) }
    }))
  }

  function adjustReps(setId, delta) {
    setSets(prev => prev.map(s => {
      if (s.id !== setId) return s
      const current = s.actual_reps ?? s.target_reps ?? 0
      return { ...s, actual_reps: Math.max(0, current + delta) }
    }))
  }

  async function completeSet(setId) {
    const set = sets.find(s => s.id === setId)
    if (!set) return

    const newCompleted = !set.completed
    setSets(prev => prev.map(s => s.id === setId ? { ...s, completed: newCompleted } : s))

    if (newCompleted) {
      setJustCompleted(setId)
      setTimeout(() => setJustCompleted(null), 500)
      setTimerDuration(120)
      setShowTimer(true)
    }

    await supabase.from('sets').update({
      actual_reps: set.actual_reps || set.target_reps,
      actual_weight: set.actual_weight || set.target_weight,
      completed: newCompleted
    }).eq('id', setId)
  }

  async function finishWorkout() {
    const completedSets = sets.filter(s => s.completed)
    const totalVolume = completedSets.reduce((sum, s) => {
      return sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0))
    }, 0)
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)

    await supabase.from('workouts').update({
      completed_at: new Date().toISOString(),
      duration_seconds: duration,
      total_volume: totalVolume
    }).eq('id', workoutId)

    const exerciseMaxes = {}
    completedSets.forEach(s => {
      const weight = s.actual_weight || s.target_weight || 0
      const reps = s.actual_reps || s.target_reps || 0
      const key = s.exercise_name
      const e1rm = weight * (1 + reps / 30)
      if (!exerciseMaxes[key] || e1rm > exerciseMaxes[key].e1rm) {
        exerciseMaxes[key] = { weight, reps, e1rm }
      }
    })

    for (const [exercise, data] of Object.entries(exerciseMaxes)) {
      if (data.weight > 0) {
        const { data: existingPR } = await supabase
          .from('personal_records')
          .select('estimated_1rm')
          .eq('user_id', user.id)
          .eq('exercise_name', exercise)
          .order('estimated_1rm', { ascending: false })
          .limit(1)
          .single()

        if (!existingPR || data.e1rm > existingPR.estimated_1rm) {
          await supabase.from('personal_records').insert({
            user_id: user.id,
            exercise_name: exercise,
            weight: data.weight,
            reps: data.reps,
            estimated_1rm: Math.round(data.e1rm * 10) / 10
          })
        }
      }
    }

    const total = (profile?.total_workouts || 0) + 1
    const streak = (profile?.current_streak || 0) + 1
    const longest = Math.max(streak, profile?.longest_streak || 0)
    await updateProfile({ total_workouts: total, current_streak: streak, longest_streak: longest })
    setShowSummary(true)
  }

  const completedCount = sets.filter(s => s.completed).length
  const totalSets = sets.length
  const progress = totalSets > 0 ? (completedCount / totalSets) * 100 : 0

  if (loading) {
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 6, borderRadius: 99, marginBottom: 24 }} />
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 24, marginBottom: 16 }} />)}
      </div>
    )
  }

  if (showSummary) {
    const totalVolume = sets.filter(s => s.completed).reduce((sum, s) => {
      return sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0))
    }, 0)

    return (
      <div className="modal-overlay">
        <div className="modal anim-bounce-in" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}><RiTrophyFill size={56} color="var(--accent)" /></div>
          <h2 className="modal-title">Workout Complete! 🔥</h2>
          <p className="modal-subtitle">Another session in the books.</p>
          <div className="stat-row" style={{ marginBottom: 16 }}>
            <div className="stat-box">
              <div className="stat-value">{completedCount}</div>
              <div className="stat-desc">Sets</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{formatTime(elapsed)}</div>
              <div className="stat-desc">Duration</div>
            </div>
          </div>
          <div className="stat-row" style={{ marginBottom: 24 }}>
            <div className="stat-box">
              <div className="stat-value">{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</div>
              <div className="stat-desc">Volume</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{Object.keys(exercises).length}</div>
              <div className="stat-desc">Exercises</div>
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/')}>
            <RiFlashlightFill size={18} /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 12, paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}>
            <RiArrowLeftLine size={22} />
          </button>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{workout?.day_name || 'Workout'}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>Week {workout?.week_number || 1} · {formatTime(elapsed)}</p>
          </div>
        </div>
        <button onClick={() => setShowTimer(true)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent)', padding: '8px 14px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RiTimerFlashFill size={16} /> Timer
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 99, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, var(--accent), var(--accent-dim))`, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>

      {/* Exercise Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(exercises).map(([exerciseName, exerciseSets]) => {
          const doneSets = exerciseSets.filter(s => s.completed).length
          const allDone = doneSets === exerciseSets.length
          const exProgress = exerciseSets.length > 0 ? (doneSets / exerciseSets.length) * 100 : 0
          const circumference = 2 * Math.PI * 22

          return (
            <div key={exerciseName} className={`workout-card-view ${allDone ? 'completed' : doneSets > 0 ? 'active' : ''}`}>
              {/* Exercise header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="workout-exercise-name" style={{ color: allDone ? 'var(--success)' : 'var(--text-primary)' }}>
                    {exerciseName}
                  </div>
                  <div className="workout-exercise-meta">
                    {exerciseSets.length} sets · {exerciseSets[0]?.target_reps || '?'} reps target
                  </div>
                </div>
                {/* Mini progress ring */}
                <div className="workout-progress-ring">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle className="ring-bg" cx="28" cy="28" r="22" />
                    <circle className="ring-fill" cx="28" cy="28" r="22"
                      style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: circumference - (circumference * exProgress / 100),
                        stroke: allDone ? 'var(--success)' : 'var(--accent)'
                      }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: allDone ? 'var(--success)' : 'var(--accent)' }}>
                      {doneSets}/{exerciseSets.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Set rows — simplified with +/- buttons */}
              {exerciseSets.map(set => {
                const currentWeight = set.actual_weight ?? set.target_weight ?? 0
                const currentReps = set.actual_reps ?? set.target_reps ?? 0

                return (
                  <div key={set.id} className={`workout-set-row ${set.completed ? 'done' : ''}`}>
                    <div className="workout-set-num">{set.set_number}</div>

                    {/* Weight with +/- */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
                      <button className="workout-adjust-btn" onClick={() => adjustWeight(set.id, -2.5)} disabled={set.completed}>−</button>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="workout-set-input"
                        placeholder={String(set.target_weight || '—')}
                        value={set.actual_weight ?? ''}
                        onChange={e => updateSet(set.id, 'actual_weight', parseFloat(e.target.value) || 0)}
                        disabled={set.completed}
                      />
                      <button className="workout-adjust-btn" onClick={() => adjustWeight(set.id, 2.5)} disabled={set.completed}>+</button>
                    </div>

                    {/* Reps with +/- */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <button className="workout-adjust-btn" onClick={() => adjustReps(set.id, -1)} disabled={set.completed} style={{ width: 30, height: 30, fontSize: '0.9rem' }}>−</button>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="workout-set-input"
                        style={{ width: 52 }}
                        placeholder={String(set.target_reps || '—')}
                        value={set.actual_reps ?? ''}
                        onChange={e => updateSet(set.id, 'actual_reps', parseInt(e.target.value) || 0)}
                        disabled={set.completed}
                      />
                      <button className="workout-adjust-btn" onClick={() => adjustReps(set.id, 1)} disabled={set.completed} style={{ width: 30, height: 30, fontSize: '0.9rem' }}>+</button>
                    </div>

                    {/* Check button */}
                    <button
                      onClick={() => completeSet(set.id)}
                      className={`workout-check-btn ${set.completed ? 'done' : ''} ${justCompleted === set.id ? 'just-done' : ''}`}
                    >
                      <RiCheckLine size={22} />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Finish floating button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, var(--bg-primary) 30%)', paddingTop: 48 }}>
        <button className="btn btn-primary btn-full btn-lg" onClick={finishWorkout} disabled={completedCount === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 -8px 32px var(--accent-glow-strong)' }}>
          <RiFlashlightFill size={18} /> Finish Workout ({completedCount}/{totalSets})
        </button>
      </div>

      {showTimer && (
        <RestTimer duration={timerDuration} onClose={() => setShowTimer(false)} onDurationChange={setTimerDuration} />
      )}
    </div>
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
