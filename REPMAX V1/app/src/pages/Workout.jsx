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
  const unit = profile?.unit_preference || 'kg'
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
  const [finishing, setFinishing] = useState(false)
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState(null) // { setId, type, msg }
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
      supabase.from('sets').select('*').eq('workout_id', workoutId).order('id')
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

  function applyAdaptiveSuggestion(setId, suggestedWeight) {
    if (!Number.isFinite(suggestedWeight)) return
    updateSet(setId, 'actual_weight', suggestedWeight)
    setAdaptiveSuggestion(null)
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

      // ── Set-by-Set Adaptive Suggestion ──
      const actualReps = set.actual_reps || set.target_reps || 0
      const actualWeight = set.actual_weight || set.target_weight || 0
      const targetReps = set.target_reps || 8

      // Find the next uncompleted set of the same exercise
      const sameSets = sets.filter(s => s.exercise_name === set.exercise_name)
      const nextSet = sameSets.find(s => !s.completed && s.set_number > set.set_number)

      if (nextSet) {
        if (actualReps >= targetReps + 2 && actualWeight > 0) {
          const bump = isCompound ? 2.5 : 1
          const suggested = actualWeight + bump
          setAdaptiveSuggestion({
            setId: nextSet.id,
            type: 'up',
            suggestedWeight: suggested,
            msg: `↑ Try ${suggested}${unit || 'kg'} — you crushed ${actualReps} reps`
          })
        } else if (actualReps > 0 && actualReps <= targetReps - 2 && actualWeight > 0) {
          const drop = isCompound ? 2.5 : 1
          const suggested = Math.max(0, actualWeight - drop)
          setAdaptiveSuggestion({
            setId: nextSet.id,
            type: 'down',
            suggestedWeight: suggested,
            msg: `↓ Drop to ${suggested}${unit || 'kg'} — only hit ${actualReps} reps`
          })
        } else {
          setAdaptiveSuggestion({
            setId: nextSet.id,
            type: 'ok',
            suggestedWeight: actualWeight,
            msg: '✓ On track — keep this weight'
          })
        }
        // Auto-dismiss after 12s
        setTimeout(() => setAdaptiveSuggestion(null), 12000)
      }
    }

    await supabase.from('sets').update({
      actual_reps: set.actual_reps || set.target_reps,
      actual_weight: set.actual_weight || set.target_weight,
      completed: newCompleted
    }).eq('id', setId)
  }

  async function finishWorkout() {
    if (finishing) return
    setFinishing(true)

    try {
      // Guard: check if already completed (idempotent)
      const { data: currentWorkout } = await supabase
        .from('workouts')
        .select('completed_at')
        .eq('id', workoutId)
        .single()

      if (currentWorkout?.completed_at) {
        // Already finished — just show summary
        setShowSummary(true)
        setSummaryStep(0)
        setTimeout(() => setSummaryStep(1), 300)
        setTimeout(() => setSummaryStep(2), 700)
        setTimeout(() => setSummaryStep(3), 1100)
        setTimeout(() => setSummaryStep(4), 1500)
        return
      }

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

      // Calendar-day streak: only increment if no workout completed today yet
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: todayCount } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .neq('id', workoutId)
        .gte('completed_at', todayStart.toISOString())

      const total = (profile?.total_workouts || 0) + 1
      if ((todayCount || 0) === 0) {
        // First workout of the day — check if last workout was yesterday
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)
        const { count: yesterdayCount } = await supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', yesterdayStart.toISOString())
          .lt('completed_at', todayStart.toISOString())

        const streak = (yesterdayCount || 0) > 0
          ? (profile?.current_streak || 0) + 1
          : 1  // Reset streak if gap > 1 day
        const longest = Math.max(streak, profile?.longest_streak || 0)
        await updateProfile({ total_workouts: total, current_streak: streak, longest_streak: longest })
      } else {
        // Already worked out today — just update total, don't touch streak
        await updateProfile({ total_workouts: total })
      }

      setShowSummary(true)
      setSummaryStep(0)
      setTimeout(() => setSummaryStep(1), 300)
      setTimeout(() => setSummaryStep(2), 700)
      setTimeout(() => setSummaryStep(3), 1100)
      setTimeout(() => setSummaryStep(4), 1500)
    } catch (err) {
      console.error('Finish workout error:', err)
      setFinishing(false)
    }
  }

  const completedCount = sets.filter(s => s.completed).length
  const totalSets = sets.length
  const progress = totalSets > 0 ? (completedCount / totalSets) * 100 : 0
  const exerciseEntries = Object.entries(exercises)

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
          <button className={`btn btn-primary btn-full btn-lg victory-btn ${summaryStep >= 4 ? 'visible' : ''}`} onClick={() => navigate('/app')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page workout-shell">
      <header className="workout-topbar">
        <div className="workout-topbar-main">
          {!focusMode && (
            <button className="workout-back-btn" onClick={() => navigate(-1)}>
              <RiArrowLeftLine size={22} />
            </button>
          )}
          <div className="workout-title-block">
            <div className="workout-kicker">Week {workout?.week_number || 1}</div>
            <h1 className="workout-title">{workout?.day_name || 'Workout'}</h1>
            <p className="workout-subtitle">{formatTime(elapsed)} live session · {exerciseEntries.length} exercises loaded</p>
          </div>
        </div>
        <div className="workout-header-actions">
          <button
            className={`workout-action-chip ${focusMode ? 'active' : ''}`}
            onClick={() => setFocusMode(!focusMode)}
            title="Focus Mode"
          >
            {focusMode ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
          </button>
          <button className="workout-action-chip workout-action-chip-rest" onClick={() => setShowTimer(true)}>
            <RiTimerFlashFill size={16} />
            Rest
          </button>
        </div>
      </header>

      <section className="workout-progress-shell">
        <div className="workout-progress-copy">
          <span>Session progress</span>
          <strong>{completedCount}/{totalSets} sets</strong>
        </div>
        <div className="workout-progress-track">
          <div
            className="workout-progress-fill"
            style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : 'var(--accent)' }}
          />
        </div>
      </section>

      <div className="workout-card-stack">
        {exerciseEntries.map(([exerciseName, exerciseSets], exerciseIndex) => {
          const doneSets = exerciseSets.filter(s => s.completed).length
          const allDone = doneSets === exerciseSets.length

          return (
            <div key={exerciseName} className={`exercise-card ${allDone ? 'done' : ''}`}>
              <div className="exercise-header">
                <div className="exercise-header-main">
                  <div className="exercise-kicker">Exercise {exerciseIndex + 1}</div>
                  <div className="exercise-name" style={{ color: allDone ? 'var(--success)' : 'var(--text-primary)' }}>{exerciseName}</div>
                  <div className="exercise-meta-row">
                    <span className="exercise-meta-chip">{exerciseSets.length} sets</span>
                    <span className="exercise-meta-chip">{exerciseSets[0]?.target_reps || '?'} reps</span>
                    {ghostData[`${exerciseName}_${exerciseSets[0]?.set_number}`] && (
                      <span className="exercise-meta-chip ghost">Ghost loaded</span>
                    )}
                  </div>
                </div>
                <div className="exercise-counter" style={{ color: allDone ? 'var(--success)' : 'var(--accent)' }}>{doneSets}/{exerciseSets.length}</div>
              </div>

              <div className="exercise-body">
                <div className="set-header-row">
                  <div style={{ width: 28 }}>Set</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Weight</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Reps</div>
                  <div style={{ width: 48, textAlign: 'right' }}>Done</div>
                </div>

                {exerciseSets.map(set => {
                  const ghostKey = `${set.exercise_name}_${set.set_number}`
                  const ghost = ghostData[ghostKey]
                  const beaten = ghostBeaten === set.id

                  return (
                    <div key={set.id}>
                      {/* Adaptive suggestion chip */}
                      {adaptiveSuggestion?.setId === set.id && !set.completed && (
                        <div style={{
                          padding: '6px 12px', marginBottom: 4, borderRadius: 10,
                          fontSize: '0.75rem', fontWeight: 700,
                          background: adaptiveSuggestion.type === 'up' ? 'rgba(0,220,130,0.1)'
                            : adaptiveSuggestion.type === 'down' ? 'rgba(255,100,100,0.1)'
                            : 'rgba(204,255,0,0.06)',
                          color: adaptiveSuggestion.type === 'up' ? '#00dc82'
                            : adaptiveSuggestion.type === 'down' ? '#ff6b6b'
                            : 'var(--accent)',
                          border: `1px solid ${adaptiveSuggestion.type === 'up' ? 'rgba(0,220,130,0.15)'
                            : adaptiveSuggestion.type === 'down' ? 'rgba(255,100,100,0.15)'
                            : 'rgba(204,255,0,0.1)'}`,
                          animation: 'fadeIn 0.3s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span>{adaptiveSuggestion.msg}</span>
                            {adaptiveSuggestion.type !== 'ok' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 10px', minHeight: 0 }}
                                onClick={() => applyAdaptiveSuggestion(set.id, adaptiveSuggestion.suggestedWeight)}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <div className={`set-row ${beaten ? 'ghost-beaten' : ''}`}>
                        <div className="set-row-number" style={{ color: set.completed ? 'var(--success)' : 'var(--text-secondary)' }}>
                          {set.set_number}
                        </div>
                        <div className="set-row-field">
                          <input
                            type="number" inputMode="decimal"
                            placeholder={String(set.target_weight || '—')}
                            value={set.actual_weight ?? ''}
                            onChange={e => updateSet(set.id, 'actual_weight', parseFloat(e.target.value) || 0)}
                            disabled={set.completed}
                          />
                          {ghost && !set.completed && (
                            <div className="ghost-hint">{ghost.weight}</div>
                          )}
                        </div>
                        <div className="set-row-field">
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
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="workout-footer-bar">
        <button className="btn btn-primary btn-full btn-lg" onClick={finishWorkout} disabled={completedCount === 0 || finishing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <RiFlashlightFill size={18} /> {finishing ? 'Finishing…' : `Finish Workout (${completedCount}/${totalSets})`}
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
