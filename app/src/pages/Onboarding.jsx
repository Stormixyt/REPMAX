import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { generateProgram } from '../lib/groq'
import { supabase } from '../lib/supabase'
import InstallGuideCard from '../components/InstallGuideCard'
import { RiRocketFill, RiFlashlightFill, RiSpeedFill, RiFireFill, RiSeedlingFill, RiLineChartFill, RiTrophyFill, RiBodyScanFill, RiBrainFill, RiCheckFill, RiArrowRightLine, RiTimerFill, RiHeartPulseFill, RiScalesFill, RiCalendarCheckFill, RiMagicFill, RiStarFill, RiArrowLeftLine, RiSparklingFill } from '@remixicon/react'

const GOALS = [
  { id: 'strength', icon: <RiFlashlightFill size={28} />, label: 'Strength', desc: 'Maximize your lifts', color: '#3b82f6' },
  { id: 'hypertrophy', icon: <RiFireFill size={28} />, label: 'Muscle Growth', desc: 'Build size & mass', color: '#ef4444' },
  { id: 'athletic', icon: <RiSpeedFill size={28} />, label: 'Athletic', desc: 'Speed & explosiveness', color: '#f59e0b' },
  { id: 'general', icon: <RiHeartPulseFill size={28} />, label: 'General Fitness', desc: 'Overall health', color: '#22c55e' },
]

const LEVELS = [
  { id: 'beginner', icon: <RiSeedlingFill size={24} />, label: 'Beginner', desc: '0–6 months lifting', color: '#22c55e' },
  { id: 'intermediate', icon: <RiLineChartFill size={24} />, label: 'Intermediate', desc: '6 months – 2 years', color: '#f59e0b' },
  { id: 'advanced', icon: <RiTrophyFill size={24} />, label: 'Advanced', desc: '2+ years consistent', color: '#ef4444' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EQUIPMENT = [
  { id: 'full_gym', label: 'Full Gym', desc: 'Barbells, machines, cables' },
  { id: 'dumbbells', label: 'Dumbbells Only', desc: 'Home or hotel gym' },
  { id: 'bodyweight', label: 'Bodyweight', desc: 'No equipment needed' },
  { id: 'home_gym', label: 'Home Gym', desc: 'Basic rack & bench' },
]

const FOCUS_MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings', 'Glutes', 'Core', 'Calves'
]

const INJURIES = [
  { id: 'none', label: 'No injuries' },
  { id: 'shoulder', label: 'Shoulder issues' },
  { id: 'knee', label: 'Knee problems' },
  { id: 'back', label: 'Lower back pain' },
  { id: 'wrist', label: 'Wrist pain' },
  { id: 'elbow', label: 'Elbow/tennis elbow' },
]

const SPLITS = {
  2: [
    { id: 'full_body', label: 'Full Body', desc: 'Train everything each session', rec: true },
    { id: 'upper_lower', label: 'Upper / Lower', desc: 'One upper, one lower focus day' },
  ],
  3: [
    { id: 'full_body', label: 'Full Body', desc: 'Hit everything 3x/week', rec: true },
    { id: 'ppl', label: 'Push/Pull/Legs', desc: 'Classic PPL' },
  ],
  4: [
    { id: 'upper_lower', label: 'Upper/Lower', desc: '2 upper + 2 lower', rec: true },
    { id: 'ppl', label: 'PPL + Full', desc: 'PPL + full body day' },
  ],
  5: [
    { id: 'ppl', label: 'PPL + Upper/Lower', desc: 'Best of both worlds', rec: true },
    { id: 'upper_lower', label: 'Upper/Lower +', desc: 'UL with extra day' },
    { id: 'bro_split', label: 'Bro Split', desc: 'One muscle/day' },
  ],
  6: [
    { id: 'ppl', label: 'PPL ×2', desc: 'Each muscle 2x/week', rec: true },
    { id: 'arnold', label: 'Arnold Split', desc: 'Chest/Back, Shoulders/Arms, Legs' },
  ],
}

const SPLIT_BADGES = {
  full_body: 'Best for consistency',
  ppl: 'Best for volume',
  upper_lower: 'Best for balance',
  bro_split: 'Best for focus',
  arnold: 'Best for old-school volume',
}

function getDaysCount(days = []) {
  return Math.max(2, Math.min(6, days.length || 3))
}

function getAvailableSplits(days = []) {
  return SPLITS[getDaysCount(days)] || SPLITS[3]
}

function getEquipmentLabel(equipmentId) {
  return EQUIPMENT.find((item) => item.id === equipmentId)?.label || 'Full Gym'
}

function getGoalLabel(goalId) {
  return GOALS.find((item) => item.id === goalId)?.label || 'General Fitness'
}

function getLevelLabel(levelId) {
  return LEVELS.find((item) => item.id === levelId)?.label || 'Beginner'
}

function getSplitLabel(splitId, days = []) {
  const scoped = getAvailableSplits(days).find((item) => item.id === splitId)
  if (scoped) return scoped.label

  const globalMatch = Object.values(SPLITS).flat().find((item) => item.id === splitId)
  return globalMatch?.label || 'Full Body'
}

function getProgramMood(goalId = 'general') {
  const copy = {
    strength: 'Heavier compounds, calmer volume, cleaner progression jumps.',
    hypertrophy: 'Higher-volume sessions with pumps, tension, and visible progression.',
    athletic: 'Explosive work, cleaner movement quality, and better carryover.',
    general: 'Balanced training that builds muscle, strength, and consistency together.',
  }

  return copy[goalId] || copy.general
}

function getProgramArchetype({ goalId, splitId, days, equipmentId }) {
  const goalText = getGoalLabel(goalId)
  const splitText = getSplitLabel(splitId || getAvailableSplits(days)[0]?.id, days)
  const equipmentText = getEquipmentLabel(equipmentId).replace('Only', '').trim()
  return `${goalText} · ${splitText} · ${equipmentText}`
}

export default function Onboarding() {
  const { user, updateProfile, fetchProfile } = useAuth()
  const [path, setPath] = useState(null) // null = choose, 'quick', 'advanced'
  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('')
  const [days, setDays] = useState([])
  const [unit, setUnit] = useState('kg')
  const [equipment, setEquipment] = useState('')
  const [focusMuscles, setFocusMuscles] = useState([])
  const [split, setSplit] = useState('')
  const [injuries, setInjuries] = useState([])
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [age, setAge] = useState('')

  const advancedSteps = [
    'goal', 'level', 'body', 'days', 'equipment', 'focus', 'split', 'injuries'
  ]
  const quickSteps = ['basics', 'schedule', 'split']

  const totalSteps = path === 'advanced' ? advancedSteps.length : quickSteps.length
  const progress = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0
  const motionKey = `${path || 'chooser'}-${step}`

  function canProceed() {
    if (path === 'advanced') {
      const s = advancedSteps[step]
      if (s === 'goal') return !!goal
      if (s === 'level') return !!level
      if (s === 'body') return true
      if (s === 'days') return days.length >= 2
      if (s === 'equipment') return !!equipment
      if (s === 'focus') return true
      if (s === 'split') return !!split
      if (s === 'injuries') return true
    } else {
      if (step === 0) return !!goal && !!level
      if (step === 1) return days.length >= 2 && !!equipment
      if (step === 2) return !!split
    }
    return true
  }

  async function finishOnboarding() {
    setGenerating(true)
    setError('')

    try {
      const daysCount = days.length || 3
      const availableSplits = getAvailableSplits(days)
      const chosenSplit = split || availableSplits[0]?.id || 'full_body'
      const normalizedEquipment = equipment || 'full_gym'
      const normalizedEquipmentList = [normalizedEquipment]
      const normalizedDays = days.length > 0 ? days : ['Mon', 'Wed', 'Fri']
      const normalizedLevel = level || 'beginner'
      const normalizedGoal = goal || 'general'
      const learnedPreferences = path === 'quick'
        ? {
            learning_active: true,
            workouts_analyzed: 0,
            starting_goal: normalizedGoal,
            starting_level: normalizedLevel,
            starting_equipment: normalizedEquipment,
            starting_split: chosenSplit,
            onboarding_confidence: 'guided_quick_start',
          }
        : {}

      const profileUpdates = {
        goal: normalizedGoal,
        level: normalizedLevel,
        experience_level: normalizedLevel,
        training_days: normalizedDays,
        equipment: normalizedEquipmentList,
        focus_muscles: focusMuscles,
        preferred_split: chosenSplit,
        unit_preference: unit,
        units: unit,
        onboarding_type: path,
        injuries: injuries.filter(i => i !== 'none'),
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        age: age ? parseInt(age) : null,
        learned_preferences: learnedPreferences,
        workouts_since_last_learn: 0,
        onboarded: true
      }

      const { error: profileError } = await updateProfile(profileUpdates)
      if (profileError) throw profileError

      // Generate initial program
      const programResult = await generateProgram({
        goal: normalizedGoal,
        level: normalizedLevel,
        experience_level: normalizedLevel,
        days: normalizedDays,
        training_days: normalizedDays,
        daysPerWeek: daysCount,
        split: chosenSplit,
        preferred_split: chosenSplit,
        equipment: normalizedEquipment,
        focusMuscles,
        focus_muscles: focusMuscles,
        injuries: injuries.filter(i => i !== 'none')
      })

      if (programResult?.success && programResult.program) {
        const { error: deactivateError } = await supabase.from('programs').update({ active: false }).eq('user_id', user.id)
        if (deactivateError) throw deactivateError

        const { error: insertError } = await supabase.from('programs').insert({
          user_id: user.id,
          name: programResult.program.name || `${getSplitLabel(chosenSplit, normalizedDays)} Program`,
          split_type: chosenSplit,
          total_weeks: programResult.program.weeks?.length || 4,
          current_week: 1,
          program_data: programResult.program,
          active: true
        })
        if (insertError) throw insertError
      }

      await fetchProfile()
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('Something went wrong. Please try again.')
      setGenerating(false)
    }
  }

  function nextStep() {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    } else {
      finishOnboarding()
    }
  }

  function prevStep() {
    if (step > 0) setStep(step - 1)
    else setPath(null)
  }

  // Generating screen
  if (generating) {
    return (
      <div className="onboarding-page onboarding-generating-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, textAlign: 'center' }}>
        <div className="onboarding-generating-icon-wrap" style={{ position: 'relative', marginBottom: 32 }}>
          <RiMagicFill size={56} style={{ color: 'var(--accent)', animation: 'pulseGlow 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -20, border: '2px solid rgba(204,255,0,0.2)', borderRadius: '50%', animation: 'spin 3s linear infinite' }} />
        </div>
        <h2 className="onboarding-generating-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 12 }}>
          {path === 'quick' ? 'Building Your Starter Program' : 'Crafting Your Perfect Program'}
        </h2>
        <p className="onboarding-generating-copy" style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 320, lineHeight: 1.6 }}>
          {path === 'quick'
            ? 'REPMAX will learn more about you as you train. Every workout teaches the AI something new.'
            : 'Analyzing your preferences, building a periodized mesocycle tailored to your exact goals and level.'
          }
        </p>
        {error && <div style={{ color: '#ef4444', marginTop: 16, fontSize: '0.88rem' }}>{error}</div>}
      </div>
    )
  }

  // Path selection screen
  if (path === null) {
    return (
      <div className="onboarding-page onboarding-chooser" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        <div className="onboarding-chooser-hero" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="onboarding-hero-badge" style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            margin: '0 auto 16px',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, rgba(204,255,0,0.18), rgba(204,255,0,0.04))',
            border: '1px solid rgba(204,255,0,0.18)'
          }}>
            <span style={{ fontSize: '2rem' }}>🏋️</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>
            Welcome to <span style={{ color: 'var(--accent)' }}>REPMAX</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
            Pick how dialed-in you want day one to feel. Either way, we’ll make the program feel personal instead of generic.
          </p>
        </div>

        {/* Advanced Path */}
        <button
          className="onboarding-path-card"
          onClick={() => { setPath('advanced'); setStep(0) }}
          style={{
            width: '100%', padding: 24, marginBottom: 12,
            background: 'linear-gradient(135deg, rgba(204,255,0,0.1), rgba(204,255,0,0.03))',
            border: '1px solid rgba(204,255,0,0.2)', borderRadius: 20,
            cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <RiBrainFill size={24} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem' }}>
                Deep Dive
                <span style={{ fontSize: '0.7rem', background: 'var(--accent)', color: '#000', padding: '2px 8px', borderRadius: 20, marginLeft: 8, fontWeight: 700, verticalAlign: 'middle' }}>RECOMMENDED</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            8 quick questions (~3 min). We'll know everything about you — goal, body metrics, equipment, injuries, preferred split. Your AI program will be <strong style={{ color: 'var(--text-primary)' }}>perfectly dialed in from day one.</strong>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}>
            <RiTimerFill size={14} /> ~3 minutes <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span> <RiStarFill size={14} /> Most precise starting plan
          </div>
        </button>

        {/* Quick Path */}
        <button
          className="onboarding-path-card onboarding-path-card-secondary"
          onClick={() => { setPath('quick'); setStep(0) }}
          style={{
            width: '100%', padding: 24,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20,
            cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <RiRocketFill size={24} style={{ color: '#8b5cf6' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem' }}>
              Quick Start
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            3 short steps (~45 sec). Pick your goal, your schedule, and your split style. <strong style={{ color: 'var(--text-primary)' }}>REPMAX keeps learning</strong> from every session after that.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#8b5cf6', fontSize: '0.82rem', fontWeight: 600 }}>
            <RiTimerFill size={14} /> ~45 seconds <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span> <RiMagicFill size={14} /> You still choose your split
          </div>
        </button>

        <InstallGuideCard />
      </div>
    )
  }

  // Step content renderer
  function renderStep() {
    if (path === 'quick') {
      if (step === 0) return renderQuickBasics()
      if (step === 1) return renderSchedule()
      if (step === 2) return renderSplit()
    } else {
      const s = advancedSteps[step]
      if (s === 'goal') return renderGoal()
      if (s === 'level') return renderLevel()
      if (s === 'body') return renderBody()
      if (s === 'days') return renderSchedule()
      if (s === 'equipment') return renderEquipment()
      if (s === 'focus') return renderFocus()
      if (s === 'split') return renderSplit()
      if (s === 'injuries') return renderInjuries()
    }
    return null
  }

  function renderQuickBasics() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          What's your <span style={{ color: 'var(--accent)' }}>goal</span>?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.5 }}>
          Pick your goal and current level. We’ll use this to set your starting volume, exercise difficulty, and progression speed.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {GOALS.map(g => (
            <button key={g.id} className={`onboarding-choice-card ${goal === g.id ? 'is-selected' : ''}`} onClick={() => setGoal(g.id)} style={{
              padding: 16, background: goal === g.id ? `${g.color}15` : 'var(--bg-card)',
              border: `2px solid ${goal === g.id ? g.color : 'var(--border)'}`, borderRadius: 16,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'center', transition: 'all 0.2s ease',
              animationDelay: `${GOALS.findIndex((item) => item.id === g.id) * 70}ms`
            }}>
              <div style={{ color: g.color, marginBottom: 6 }}>{g.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{g.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{g.desc}</div>
            </button>
          ))}
        </div>

        <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>Experience Level</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LEVELS.map(l => (
            <button key={l.id} className={`onboarding-choice-card onboarding-list-card ${level === l.id ? 'is-selected' : ''}`} onClick={() => setLevel(l.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: level === l.id ? `${l.color}15` : 'var(--bg-card)',
              border: `2px solid ${level === l.id ? l.color : 'var(--border)'}`, borderRadius: 14,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.2s ease',
              animationDelay: `${LEVELS.findIndex((item) => item.id === l.id) * 70}ms`
            }}>
              <div style={{ color: l.color }}>{l.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{l.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{l.desc}</div>
              </div>
              {level === l.id && <RiCheckFill size={18} style={{ marginLeft: 'auto', color: l.color }} />}
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 18,
          border: '1px solid rgba(204,255,0,0.12)',
          background: 'linear-gradient(180deg, rgba(204,255,0,0.08), rgba(255,255,255,0.02))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <RiMagicFill size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--accent)' }}>
              Quick Start Preview
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {goal ? getGoalLabel(goal) : 'Your goal'} · {level ? getLevelLabel(level) : 'Your level'}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            REPMAX will start you with a realistic program, then learn from every workout you complete so the app gets sharper instead of guessing forever.
          </p>
        </div>
      </div>
    )
  }

  function renderProgramPreviewCard() {
    const selectedSplit = split || getAvailableSplits(days)[0]?.id || 'full_body'
    const previewDays = days.length > 0 ? days : ['Mon', 'Wed', 'Fri']
    const previewEquipment = equipment || 'full_gym'

    return (
      <div className="onboarding-preview-card" style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        border: '1px solid rgba(204,255,0,0.12)',
        background: 'linear-gradient(165deg, rgba(204,255,0,0.10), rgba(255,255,255,0.02) 42%, rgba(255,255,255,0.01) 100%)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
        padding: 20
      }}>
        <div style={{
          position: 'absolute',
          inset: 'auto -40px -60px auto',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(204,255,0,0.18), rgba(204,255,0,0))',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
              Personalized Preview
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.15 }}>
              {getProgramArchetype({ goalId: goal || 'general', splitId: selectedSplit, days: previewDays, equipmentId: previewEquipment })}
            </div>
          </div>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(204,255,0,0.12)',
            color: 'var(--accent)',
            border: '1px solid rgba(204,255,0,0.16)',
            flexShrink: 0
          }}>
            <RiBrainFill size={20} />
          </div>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {getProgramMood(goal || 'general')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--accent)' }}>
              <RiCalendarCheckFill size={15} />
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Schedule</span>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {previewDays.length} days
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {previewDays.join(' · ')}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--accent)' }}>
              <RiScalesFill size={15} />
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Level</span>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {getLevelLabel(level || 'beginner')}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {unit.toUpperCase()} based tracking
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--accent)' }}>
              <RiBodyScanFill size={15} />
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Style</span>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {getSplitLabel(selectedSplit, previewDays)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {getEquipmentLabel(previewEquipment)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderGoal() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          What's your <span style={{ color: 'var(--accent)' }}>primary goal</span>?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          This determines exercise selection, rep ranges, and rest periods.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {GOALS.map(g => (
            <button key={g.id} onClick={() => setGoal(g.id)} style={{
              padding: 20, background: goal === g.id ? `${g.color}15` : 'var(--bg-card)',
              border: `2px solid ${goal === g.id ? g.color : 'var(--border)'}`, borderRadius: 16,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'center', transition: 'all 0.2s ease'
            }}>
              <div style={{ color: g.color, marginBottom: 8 }}>{g.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{g.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{g.desc}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderLevel() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Your <span style={{ color: 'var(--accent)' }}>experience</span> level
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          Be honest — the AI calibrates volume and intensity to your real level.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LEVELS.map(l => (
            <button key={l.id} onClick={() => setLevel(l.id)} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
              background: level === l.id ? `${l.color}15` : 'var(--bg-card)',
              border: `2px solid ${level === l.id ? l.color : 'var(--border)'}`, borderRadius: 16,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.2s ease'
            }}>
              <div style={{ color: l.color }}>{l.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{l.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{l.desc}</div>
              </div>
              {level === l.id && <RiCheckFill size={20} style={{ color: l.color }} />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderBody() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Body <span style={{ color: 'var(--accent)' }}>metrics</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          Optional but helps the AI estimate starting weights and nutrition.
        </p>

        {/* Unit toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 10, padding: 4 }}>
          {['kg', 'lbs'].map(u => (
            <button key={u} onClick={() => setUnit(u)} style={{
              flex: 1, padding: '10px 0', fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase',
              background: unit === u ? 'var(--accent)' : 'transparent', color: unit === u ? '#000' : 'var(--text-secondary)',
              border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease'
            }}>
              {u}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Height (cm)</label>
            <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" style={{
              width: '100%', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text-primary)', fontSize: '1rem', outline: 'none'
            }} />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              Weight ({unit})
            </label>
            <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder={unit === 'kg' ? '80' : '175'} style={{
              width: '100%', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text-primary)', fontSize: '1rem', outline: 'none'
            }} />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Age</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="22" style={{
              width: '100%', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text-primary)', fontSize: '1rem', outline: 'none'
            }} />
          </div>
        </div>
      </div>
    )
  }

  function renderSchedule() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Training <span style={{ color: 'var(--accent)' }}>schedule</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 4 }}>
          Select the days you can train (minimum 2).
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 20 }}>
          {days.length > 0 ? `${days.length} days selected — ` : ''}
          {days.length >= 6 ? 'Intense schedule! 🔥' : days.length >= 4 ? 'Solid commitment 💪' : days.length >= 2 ? 'Good starting point ✅' : 'Select at least 2 days'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 24 }}>
          {DAYS.map(d => {
            const active = days.includes(d)
            return (
              <button key={d} className={`onboarding-day-pill ${active ? 'is-selected' : ''}`} onClick={() => setDays(active ? days.filter(x => x !== d) : [...days, d])} style={{
                padding: '14px 0', borderRadius: 12, fontWeight: 700, fontSize: '0.8rem',
                background: active ? 'var(--accent)' : 'var(--bg-card)',
                color: active ? '#000' : 'var(--text-secondary)',
                border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
                animationDelay: `${DAYS.findIndex((item) => item === d) * 45}ms`
              }}>
                {d}
              </button>
            )
          })}
        </div>

        {path === 'quick' && (
          <>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 10, marginTop: 8 }}>Equipment</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {EQUIPMENT.map(e => (
                <button key={e.id} className={`onboarding-choice-card onboarding-list-card ${equipment === e.id ? 'is-selected' : ''}`} onClick={() => setEquipment(e.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  background: equipment === e.id ? 'rgba(204,255,0,0.1)' : 'var(--bg-card)',
                  border: `2px solid ${equipment === e.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 14, cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
                  transition: 'all 0.2s ease',
                  animationDelay: `${EQUIPMENT.findIndex((item) => item.id === e.id) * 70}ms`
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{e.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{e.desc}</div>
                  </div>
                  {equipment === e.id && <RiCheckFill size={18} style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
            </div>

            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 10, marginTop: 8 }}>Weight Unit</h3>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', borderRadius: 10, padding: 4 }}>
              {['kg', 'lbs'].map(u => (
                <button key={u} className={`onboarding-toggle-pill ${unit === u ? 'is-selected' : ''}`} onClick={() => setUnit(u)} style={{
                  flex: 1, padding: '12px 0', fontWeight: 700, fontSize: '0.92rem', textTransform: 'uppercase',
                  background: unit === u ? 'var(--accent)' : 'transparent', color: unit === u ? '#000' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease'
                }}>
                  {u}
                </button>
              ))}
            </div>

            <div style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--text-tertiary)' }}>
                  Your Starter Setup
                </span>
                <RiBrainFill size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(204,255,0,0.1)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  {days.length || 0} days / week
                </span>
                {equipment && (
                  <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {getEquipmentLabel(equipment)}
                  </span>
                )}
                <span style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {unit}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderEquipment() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Your <span style={{ color: 'var(--accent)' }}>equipment</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          The AI selects exercises based on what you have access to.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {EQUIPMENT.map(e => (
            <button key={e.id} className={`onboarding-choice-card onboarding-list-card ${equipment === e.id ? 'is-selected' : ''}`} onClick={() => setEquipment(e.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
              background: equipment === e.id ? 'rgba(204,255,0,0.1)' : 'var(--bg-card)',
              border: `2px solid ${equipment === e.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.2s ease',
              animationDelay: `${EQUIPMENT.findIndex((item) => item.id === e.id) * 70}ms`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{e.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{e.desc}</div>
              </div>
              {equipment === e.id && <RiCheckFill size={20} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderFocus() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Focus <span style={{ color: 'var(--accent)' }}>muscles</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          Optional — select muscles you want to prioritize. Skip if you want balanced.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FOCUS_MUSCLES.map(m => {
            const active = focusMuscles.includes(m)
            return (
              <button key={m} className={`onboarding-chip ${active ? 'is-selected' : ''}`} onClick={() => setFocusMuscles(active ? focusMuscles.filter(x => x !== m) : [...focusMuscles, m])} style={{
                padding: '10px 18px', borderRadius: 20, fontWeight: 600, fontSize: '0.85rem',
                background: active ? 'var(--accent)' : 'var(--bg-card)',
                color: active ? '#000' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
                animationDelay: `${FOCUS_MUSCLES.findIndex((item) => item === m) * 35}ms`
              }}>
                {m}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  function renderSplit() {
    const daysCount = getDaysCount(days)
    const available = getAvailableSplits(days)
    const recommendedSplit = available.find((option) => option.rec)?.id || available[0]?.id

    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Training <span style={{ color: 'var(--accent)' }}>split</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          Based on your {daysCount} training days, here’s the setup that makes the most sense.
        </p>

        {path === 'quick' && (
          <div style={{
            marginBottom: 18,
            padding: 18,
            borderRadius: 18,
            border: '1px solid rgba(204,255,0,0.15)',
            background: 'linear-gradient(160deg, rgba(204,255,0,0.08), rgba(255,255,255,0.02))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <RiSparklingFill size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--accent)' }}>
                Personalized Recommendation
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              {getSplitLabel(recommendedSplit, days)}
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
              With {days.length || 3} training days, a {getGoalLabel(goal).toLowerCase()} goal, and {getEquipmentLabel(equipment).toLowerCase()}, this gives you the cleanest balance between recovery, progression, and consistency.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {available.map(s => (
            <button key={s.id} className={`onboarding-choice-card onboarding-list-card ${split === s.id ? 'is-selected' : ''}`} onClick={() => setSplit(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', position: 'relative',
              background: split === s.id ? 'rgba(204,255,0,0.1)' : 'var(--bg-card)',
              border: `2px solid ${split === s.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14,
              cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.2s ease',
              animationDelay: `${available.findIndex((item) => item.id === s.id) * 80}ms`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.label}
                  {s.rec && <span style={{ fontSize: '0.6rem', background: 'var(--accent)', color: '#000', padding: '2px 6px', borderRadius: 20, fontWeight: 700 }}>BEST</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{s.desc}</div>
                <div style={{ fontSize: '0.72rem', color: split === s.id ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: 5, fontWeight: 600 }}>
                  {SPLIT_BADGES[s.id] || 'Solid choice'}
                </div>
              </div>
              {split === s.id && <RiCheckFill size={20} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderInjuries() {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
          Any <span style={{ color: 'var(--accent)' }}>injuries</span>?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
          The AI avoids exercises that stress problem areas. Select "No injuries" if you're healthy.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {INJURIES.map(inj => {
            const active = injuries.includes(inj.id)
            const isNone = inj.id === 'none'
            return (
              <button key={inj.id} className={`onboarding-choice-card onboarding-list-card ${active ? 'is-selected' : ''}`} onClick={() => {
                if (isNone) setInjuries(['none'])
                else setInjuries(active ? injuries.filter(x => x !== inj.id) : [...injuries.filter(x => x !== 'none'), inj.id])
              }} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                background: active ? (isNone ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--bg-card)',
                border: `2px solid ${active ? (isNone ? '#22c55e' : '#ef4444') : 'var(--border)'}`, borderRadius: 14,
                cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', transition: 'all 0.2s ease',
                animationDelay: `${INJURIES.findIndex((item) => item.id === inj.id) * 70}ms`
              }}>
                <span style={{ fontSize: '0.9rem' }}>{inj.label}</span>
                {active && <RiCheckFill size={18} style={{ marginLeft: 'auto', color: isNone ? '#22c55e' : '#ef4444' }} />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const stepLabels = path === 'advanced'
    ? ['Goal', 'Level', 'Body', 'Schedule', 'Equipment', 'Focus', 'Split', 'Injuries']
    : ['Basics', 'Setup', 'Split']

  const motivationalHint = (() => {
    if (path === 'quick') {
      if (step === 0 && goal) return goal === 'strength' ? 'Heavy iron. Good choice.' : goal === 'hypertrophy' ? 'Size mode activated.' : goal === 'athletic' ? 'Built different.' : 'Smart start.'
      if (step === 1 && selectedDays?.length >= 3) return `${selectedDays.length} days locked in. Consistency wins.`
      if (step === 2 && chosenSplit) return 'Split set. Your AI program is almost ready.'
    }
    if (path === 'advanced') {
      if (step === 0 && goal) return goal === 'strength' ? 'Strength-first. RPE 8+ incoming.' : goal === 'hypertrophy' ? 'Volume protocol unlocked.' : goal === 'athletic' ? 'Power + conditioning.' : 'Balanced approach. Smart.'
      if (step === 1 && level) return level === 'advanced' ? 'Respect. Autoregulation matters at your level.' : level === 'intermediate' ? 'Perfect growth phase. Let\'s push it.' : 'Clean start. We\'ll build the foundation right.'
      if (step === 3 && selectedDays?.length >= 4) return `${selectedDays.length} days/week. That's serious commitment.`
      if (step === 4) return 'Equipment locked. Programming adapts to what you have.'
      if (step === 6 && chosenSplit) return 'Split selected. One step from your first AI program.'
      if (step === 7) return 'Last step. Be honest — the AI adjusts around injuries.'
    }
    return null
  })()

  return (
    <div className="onboarding-page" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(circle at top, rgba(204,255,0,0.10), rgba(204,255,0,0) 28%), linear-gradient(180deg, #050505 0%, var(--bg-primary) 32%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: -180,
        right: -120,
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(204,255,0,0.16), rgba(204,255,0,0))',
        filter: 'blur(8px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent 18%)',
        pointerEvents: 'none'
      }} />

      {/* Progress bar */}
      <div style={{ padding: '20px 24px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <button onClick={prevStep} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
            <RiArrowLeftLine size={20} />
          </button>
          <div style={{ flex: 1, height: 4, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
            <div className="onboarding-progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
            {step + 1}/{totalSteps}
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {stepLabels[step] || ''}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        <div
          key={motionKey}
          className="onboarding-step-shell"
          style={{
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(18,18,18,0.92), rgba(10,10,10,0.96))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.35)',
          padding: 22,
          backdropFilter: 'blur(18px)'
        }}>
          {renderStep()}
        </div>
        <div style={{ marginTop: 16 }}>
          {renderProgramPreviewCard()}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        padding: '16px 24px',
        paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 24px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(7,7,7,0.4), rgba(7,7,7,0.92))',
        backdropFilter: 'blur(18px)',
        position: 'relative',
        zIndex: 1
      }}>
        {motivationalHint && (
          <div style={{
            textAlign: 'center',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--accent)',
            marginBottom: 10,
            animation: 'fadeIn 0.3s ease',
            letterSpacing: '0.02em',
          }}>
            {motivationalHint}
          </div>
        )}
        <button
          onClick={nextStep}
          disabled={!canProceed()}
          className={`btn btn-primary btn-full btn-lg onboarding-cta ${canProceed() ? 'is-ready' : ''}`}
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: canProceed() ? 1 : 0.4,
            minHeight: 58,
            boxShadow: canProceed() ? '0 14px 38px rgba(204,255,0,0.18)' : 'none'
          }}
        >
          {step === totalSteps - 1 ? (
            <><RiMagicFill size={18} /> Generate My Program</>
          ) : (
            <>Keep Building <RiArrowRightLine size={18} /></>
          )}
        </button>
      </div>
    </div>
  )
}
