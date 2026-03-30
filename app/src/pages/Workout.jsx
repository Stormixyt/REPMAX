import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import RestTimer from '../components/RestTimer'

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
    const { data: w } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single()

    const { data: s } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_id', workoutId)
      .order('exercise_name')
      .order('set_number')

    setWorkout(w)
    setSets(s || [])
    setLoading(false)
  }

  // Group sets by exercise
  const exercises = sets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  async function updateSet(setId, field, value) {
    setSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s))
  }

  async function completeSet(setId) {
    const set = sets.find(s => s.id === setId)
    if (!set) return

    const newCompleted = !set.completed
    setSets(prev => prev.map(s => s.id === setId ? { ...s, completed: newCompleted } : s))

    await supabase.from('sets').update({
      actual_reps: set.actual_reps || set.target_reps,
      actual_weight: set.actual_weight || set.target_weight,
      rpe: set.rpe,
      completed: newCompleted
    }).eq('id', setId)

    // Auto-start rest timer when completing a set
    if (newCompleted) {
      setTimerDuration(120) // Default 2 min rest
      setShowTimer(true)
    }
  }

  async function finishWorkout() {
    const completedSets = sets.filter(s => s.completed)
    const totalVolume = completedSets.reduce((sum, s) => {
      return sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0))
    }, 0)
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)

    // Update workout as completed
    await supabase.from('workouts').update({
      completed_at: new Date().toISOString(),
      duration_seconds: duration,
      total_volume: totalVolume
    }).eq('id', workoutId)

    // Check for new PRs
    const exerciseMaxes = {}
    completedSets.forEach(s => {
      const weight = s.actual_weight || s.target_weight || 0
      const reps = s.actual_reps || s.target_reps || 0
      const key = s.exercise_name
      const e1rm = weight * (1 + reps / 30) // Epley formula
      if (!exerciseMaxes[key] || e1rm > exerciseMaxes[key].e1rm) {
        exerciseMaxes[key] = { weight, reps, e1rm }
      }
    })

    // Save PRs
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

    // Update profile stats
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
        <div className="skeleton" style={{ height: 12, borderRadius: 99, marginBottom: 24 }} />
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    )
  }

  if (showSummary) {
    const totalVolume = sets.filter(s => s.completed).reduce((sum, s) => {
      return sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0))
    }, 0)

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-emoji">🔥</div>
          <h2 className="modal-title">Workout Complete!</h2>
          <p className="modal-subtitle">Another session in the books. Here's how you did:</p>
          <div className="stat-row" style={{ marginBottom: 20 }}>
            <div className="stat-box">
              <div className="stat-value">{completedCount}</div>
              <div className="stat-desc">Sets Done</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{formatTime(elapsed)}</div>
              <div className="stat-desc">Duration</div>
            </div>
          </div>
          <div className="stat-row" style={{ marginBottom: 24 }}>
            <div className="stat-box">
              <div className="stat-value">{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</div>
              <div className="stat-desc">Lbs Moved</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{Object.keys(exercises).length}</div>
              <div className="stat-desc">Exercises</div>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>{workout?.day_name || 'Workout'}</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Week {workout?.week_number || 1} · {formatTime(elapsed)}</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={() => setShowTimer(true)}>
          ⏱ Timer
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          <span>{completedCount} of {totalSets} sets</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Exercises */}
      {Object.entries(exercises).map(([exerciseName, exerciseSets]) => {
        const allDone = exerciseSets.every(s => s.completed)
        return (
          <div key={exerciseName} className={`exercise-card ${allDone ? 'completed' : ''}`}>
            <div className="exercise-header">
              <div>
                <div className="exercise-name">{exerciseName}</div>
              </div>
              <div className="exercise-target">{exerciseSets.length} × {exerciseSets[0]?.target_reps || '?'}</div>
            </div>

            {/* Set header */}
            <div className="set-row" style={{ borderTop: 'none', paddingBottom: 4 }}>
              <div className="set-number" style={{ background: 'transparent', fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>SET</div>
              <div className="set-inputs">
                <div className="set-input-group"><div className="set-input-label">Weight</div></div>
                <div className="set-input-group"><div className="set-input-label">Reps</div></div>
                <div className="set-input-group"><div className="set-input-label">RPE</div></div>
              </div>
              <div style={{ width: 36 }} />
            </div>

            {exerciseSets.map(set => (
              <div key={set.id} className={`set-row ${set.completed ? 'completed' : ''}`}>
                <div className="set-number">{set.set_number}</div>
                <div className="set-inputs">
                  <div className="set-input-group">
                    <input
                      type="number"
                      className="input input-number"
                      placeholder={set.target_weight || '-'}
                      value={set.actual_weight ?? ''}
                      onChange={e => updateSet(set.id, 'actual_weight', parseFloat(e.target.value) || 0)}
                      disabled={set.completed}
                    />
                  </div>
                  <div className="set-input-group">
                    <input
                      type="number"
                      className="input input-number"
                      placeholder={set.target_reps || '-'}
                      value={set.actual_reps ?? ''}
                      onChange={e => updateSet(set.id, 'actual_reps', parseInt(e.target.value) || 0)}
                      disabled={set.completed}
                    />
                  </div>
                  <div className="set-input-group">
                    <input
                      type="number"
                      className="input input-number"
                      placeholder="—"
                      value={set.rpe ?? ''}
                      onChange={e => updateSet(set.id, 'rpe', parseFloat(e.target.value) || 0)}
                      disabled={set.completed}
                      step="0.5"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
                <button
                  className={`set-check ${set.completed ? 'checked' : ''}`}
                  onClick={() => completeSet(set.id)}
                >
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )
      })}

      {/* Finish button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, var(--bg-primary) 30%)', paddingTop: 40 }}>
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={finishWorkout}
          disabled={completedCount === 0}
        >
          Finish Workout ({completedCount}/{totalSets} sets)
        </button>
      </div>

      {/* Rest Timer */}
      {showTimer && (
        <RestTimer
          duration={timerDuration}
          onClose={() => setShowTimer(false)}
          onDurationChange={setTimerDuration}
        />
      )}
    </div>
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
