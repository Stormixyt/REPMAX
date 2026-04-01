import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import RestTimer from '../components/RestTimer'
import { RiArrowLeftLine, RiTimerFlashFill, RiCheckLine, RiTrophyFill, RiFlashlightFill, RiFireFill, RiMedalFill, RiEyeOffLine, RiEyeLine } from '@remixicon/react'

export default function Workout() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { user, updateProfile, profile } = useAuth()
  const [workout, setWorkout] = useState(null)
  const [sets, setSets] = useState([])
  const [ghostData, setGhostData] = useState({})
  const [loading, setLoading] = useState(true)
  const [showTimer, setShowTimer] = useState(false)
  const [timerDuration, setTimerDuration] = useState(120)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryStep, setSummaryStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [justCompleted, setJustCompleted] = useState(null)
  const [ghostBeaten, setGhostBeaten] = useState(null)
  const [focusMode, setFocusMode] = useState(false)
  const [newPRs, setNewPRs] = useState([])
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

    // GHOST SETS: Load previous workout data for same exercises
    if (wRes.data?.day_name) {
      try {
        const { data: prevWorkouts } = await supabase.from('workouts')
          .select('id')
          .eq('user_id', user.id)
          .eq('day_name', wRes.data.day_name)
          .not('completed_at', 'is', null)
          .neq('id', workoutId)
          .order('completed_at', { ascending: false })
          .limit(1)

        if (prevWorkouts?.[0]) {
          const { data: prevSets } = await supabase.from('sets')
            .select('exercise_name, set_number, actual_weight, actual_reps')
            .eq('workout_id', prevWorkouts[0].id)
            .eq('completed', true)

          const ghost = {}
          prevSets?.forEach(s => {
            const key = `${s.exercise_name}_${s.set_number}`
            ghost[key] = { weight: s.actual_weight, reps: s.actual_reps }
          })
          setGhostData(ghost)
        }
      } catch {}
    }
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

  async function completeSet(setId) {
    const set = sets.find(s => s.id === setId)
    if (!set) return

    const newCompleted = !set.completed
    setSets(prev => prev.map(s => s.id === setId ? { ...s, completed: newCompleted } : s))

    if (newCompleted) {
      setJustCompleted(setId)
      setTimeout(() => setJustCompleted(null), 500)

      // Ghost comparison
      const ghostKey = `${set.exercise_name}_${set.set_number}`
      const ghost = ghostData[ghostKey]
      if (ghost) {
        const currentWeight = set.actual_weight || set.target_weight || 0
        const currentReps = set.actual_reps || set.target_reps || 0
        if (currentWeight > ghost.weight || (currentWeight === ghost.weight && currentReps > ghost.reps)) {
          setGhostBeaten(setId)
          setTimeout(() => setGhostBeaten(null), 1200)
        }
      }

      // Smart Rest: vary timer by exercise type
      const name = set.exercise_name.toLowerCase()
      const isCompound = ['squat', 'bench', 'deadlift', 'press', 'row'].some(w => name.includes(w))
      setTimerDuration(isCompound ? 180 : set.target_reps <= 6 ? 150 : 90)
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

    const prList = []
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
        const { data: existingPR } = await supabase.from('personal_records')
          .select('estimated_1rm').eq('user_id', user.id).eq('exercise_name', exercise)
          .order('estimated_1rm', { ascending: false }).limit(1).single()

        if (!existingPR || data.e1rm > existingPR.estimated_1rm) {
          await supabase.from('personal_records').insert({
            user_id: user.id, exercise_name: exercise,
            weight: data.weight, reps: data.reps,
            estimated_1rm: Math.round(data.e1rm * 10) / 10
          })
          prList.push({ exercise, weight: data.weight, reps: data.reps })
        }
      }
    }
    setNewPRs(prList)

    const total = (profile?.total_workouts || 0) + 1
    const streak = (profile?.current_streak || 0) + 1
    const longest = Math.max(streak, profile?.longest_streak || 0)
    await updateProfile({ total_workouts: total, current_streak: streak, longest_streak: longest })

    setShowSummary(true)
    // Victory Replay animation sequence
    setSummaryStep(0)
    setTimeout(() => setSummaryStep(1), 300)
    setTimeout(() => setSummaryStep(2), 700)
    setTimeout(() => setSummaryStep(3), 1100)
    setTimeout(() => setSummaryStep(4), 1500)
  }

  const completedCount = sets.filter(s => s.completed).length
  const totalSets = sets.length
  const progress = totalSets > 0 ? (completedCount / totalSets) * 100 : 0

  if (loading) {
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 6, borderRadius: 99, marginBottom: 24 }} />
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    )
  }

  // ======================
  // VICTORY REPLAY SCREEN
  // ======================
  if (showSummary) {
    const totalVolume = sets.filter(s => s.completed).reduce((sum, s) => {
      return sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0))
    }, 0)

    return (
      <div className="victory-overlay">
        <div className="victory-bg-pulse" />
        <div className="victory-content">
          {/* Trophy */}
          <div className={`victory-icon ${summaryStep >= 0 ? 'visible' : ''}`}>
            <RiTrophyFill size={56} />
          </div>

          {/* Title */}
          <h1 className={`victory-title ${summaryStep >= 1 ? 'visible' : ''}`}>Session Complete</h1>

          {/* Stats Grid */}
          <div className={`victory-stats ${summaryStep >= 2 ? 'visible' : ''}`}>
            <div className="victory-stat">
              <div className="victory-stat-value">{completedCount}</div>
              <div className="victory-stat-label">Sets</div>
            </div>
            <div className="victory-stat">
              <div className="victory-stat-value">{formatTime(elapsed)}</div>
              <div className="victory-stat-label">Duration</div>
            </div>
            <div className="victory-stat">
              <div className="victory-stat-value">{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</div>
              <div className="victory-stat-label">Volume</div>
            </div>
            <div className="victory-stat">
              <div className="victory-stat-value">{Object.keys(exercises).length}</div>
              <div className="victory-stat-label">Exercises</div>
            </div>
          </div>

          {/* New PRs */}
          {newPRs.length > 0 && (
            <div className={`victory-prs ${summaryStep >= 3 ? 'visible' : ''}`}>
              <div className="victory-pr-title"><RiMedalFill size={16} /> New Personal Records</div>
              {newPRs.map((pr, i) => (
                <div key={i} className="victory-pr-item">
                  <span>{pr.exercise}</span>
                  <span className="victory-pr-weight">{pr.weight} x {pr.reps}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <button className={`btn btn-primary btn-full btn-lg victory-btn ${summaryStep >= 4 ? 'visible' : ''}`} onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 12, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!focusMode && (
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}>
              <RiArrowLeftLine size={22} />
            </button>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{workout?.day_name || 'Workout'}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>Week {workout?.week_number || 1} / {formatTime(elapsed)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFocusMode(!focusMode)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: focusMode ? 'var(--accent)' : 'var(--text-tertiary)', padding: '8px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Focus Mode">
            {focusMode ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
          </button>
          <button onClick={() => setShowTimer(true)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent)', padding: '8px 14px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RiTimerFlashFill size={16} /> Rest
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 99, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>

      {/* Exercises */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(exercises).map(([exerciseName, exerciseSets]) => {
          const doneSets = exerciseSets.filter(s => s.completed).length
          const allDone = doneSets === exerciseSets.length

          return (
            <div key={exerciseName} className={`exercise-card ${allDone ? 'done' : ''}`}>
              {/* Exercise header */}
              <div className="exercise-header">
                <div>
                  <div className="exercise-name" style={{ color: allDone ? 'var(--success)' : 'var(--text-primary)' }}>{exerciseName}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{exerciseSets.length} sets / {exerciseSets[0]?.target_reps || '?'} reps</div>
                </div>
                <div className="exercise-counter" style={{ color: allDone ? 'var(--success)' : 'var(--accent)' }}>{doneSets}/{exerciseSets.length}</div>
              </div>

              <div style={{ padding: '0 16px' }}>
                <div className="set-header-row">
                  <div style={{ width: 28 }}>Set</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Weight</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Reps</div>
                  <div style={{ width: 48 }}></div>
                </div>

                {exerciseSets.map(set => {
                  const ghostKey = `${set.exercise_name}_${set.set_number}`
                  const ghost = ghostData[ghostKey]
                  const beaten = ghostBeaten === set.id

                  return (
                    <div key={set.id} className={`set-row ${beaten ? 'ghost-beaten' : ''}`}>
                      <div style={{ width: 28, fontWeight: 700, fontSize: '0.85rem', color: set.completed ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {set.set_number}
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number" inputMode="decimal"
                          placeholder={String(set.target_weight || '—')}
                          value={set.actual_weight ?? ''}
                          onChange={e => updateSet(set.id, 'actual_weight', parseFloat(e.target.value) || 0)}
                          disabled={set.completed}
                        />
                        {/* Ghost overlay */}
                        {ghost && !set.completed && (
                          <div className="ghost-hint">{ghost.weight}</div>
                        )}
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number" inputMode="numeric"
                          placeholder={String(set.target_reps || '—')}
                          value={set.actual_reps ?? ''}
                          onChange={e => updateSet(set.id, 'actual_reps', parseInt(e.target.value) || 0)}
                          disabled={set.completed}
                        />
                        {ghost && !set.completed && (
                          <div className="ghost-hint">{ghost.reps}</div>
                        )}
                      </div>
                      <button
                        onClick={() => completeSet(set.id)}
                        className={`set-check-btn ${set.completed ? 'done' : 'pending'} ${justCompleted === set.id ? 'just-done' : ''}`}
                      >
                        <RiCheckLine size={20} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Finish button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(transparent, var(--bg-primary) 30%)', paddingTop: 40, zIndex: 20 }}>
        <button className="btn btn-primary btn-full btn-lg" onClick={finishWorkout} disabled={completedCount === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <RiFlashlightFill size={18} /> Finish Workout ({completedCount}/{totalSets})
        </button>
      </div>

      {showTimer && <RestTimer duration={timerDuration} onClose={() => setShowTimer(false)} onDurationChange={setTimerDuration} />}
    </div>
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
