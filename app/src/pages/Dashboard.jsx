import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useV2 } from '../context/V2Context'
import DashboardV2 from './DashboardV2'
import { supabase } from '../lib/supabase'
import { shareDNACard } from '../lib/shareDNA'
import { subscribeToPush, showLocalNotification } from '../lib/pushNotifications'
import { formatWeight, formatVolume, weightLabel } from '../lib/units'
import { getLearningProgress, getLearningStatus } from '../lib/learningEngine'
import { RiFlashlightFill, RiMoonClearFill, RiTrophyFill, RiMedalFill, RiArrowRightLine, RiVipCrownFill, RiNotification3Fill, RiSwordFill, RiFireFill, RiWaterFlashFill, RiRunFill, RiScalesFill, RiShareLine, RiSparklingFill, RiStarFill, RiTeamFill, RiBrainFill } from '@remixicon/react'
import ProBadge from '../components/ProBadge'


const MOTIVATIONS = [
  "No excuses, just execution.",
  "Your only limit is you.",
  "Pain is weakness leaving the body.",
  "Sweat is just fat crying.",
  "One day, or day one. You decide.",
  "Discipline outlasts motivation.",
  "Light weight, baby!",
  "Make yourself proud today."
]

const DAY_MS = 24 * 60 * 60 * 1000

const ULTRA_INSIGHT_ICONS = {
  readiness: RiSparklingFill,
  momentum: RiFireFill,
  adherence: RiScalesFill,
  efficiency: RiRunFill,
  window: RiMoonClearFill,
  balance: RiSwordFill,
  pr: RiStarFill,
  load: RiBrainFill,
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSignedPercent(value) {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `${rounded}%`
  return '0%'
}

function buildUltraInsights({ profile, workouts, recentPRs, unit }) {
  const now = Date.now()
  const unitName = weightLabel(unit)

  const completedWorkouts = (workouts || [])
    .map((workout) => {
      if (!workout?.completed_at) return null
      const completedAt = new Date(workout.completed_at)
      if (Number.isNaN(completedAt.getTime())) return null

      const startedAt = workout.started_at ? new Date(workout.started_at) : null
      const durationMinutes = startedAt && !Number.isNaN(startedAt.getTime())
        ? Math.max(5, (completedAt.getTime() - startedAt.getTime()) / 60000)
        : null

      return {
        completedAt,
        timestamp: completedAt.getTime(),
        volume: Number(workout.total_volume) || 0,
        durationMinutes,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp)

  const inDays = (days) => completedWorkouts.filter((w) => now - w.timestamp <= days * DAY_MS)
  const betweenDays = (fromDays, toDays) => completedWorkouts.filter((w) => {
    const ageInDays = (now - w.timestamp) / DAY_MS
    return ageInDays > fromDays && ageInDays <= toDays
  })

  const sumVolume = (rows) => rows.reduce((total, row) => total + (row.volume || 0), 0)
  const sumDuration = (rows) => rows.reduce((total, row) => total + (row.durationMinutes || 0), 0)

  const lastWorkout = completedWorkouts[0] || null
  const daysSinceLast = lastWorkout ? (now - lastWorkout.timestamp) / DAY_MS : null
  const last7 = inDays(7)
  const prev7 = betweenDays(7, 14)
  const last28 = inDays(28)

  const trainingTarget = Math.max(1, profile?.training_days?.length || 4)
  const weeklySessions = last7.length
  const weeklyAdherence = Math.round(clamp((weeklySessions / trainingTarget) * 100, 0, 180))
  const streak = Number(profile?.current_streak) || 0

  const recoveryShape = daysSinceLast == null ? 60 : clamp(100 - Math.abs(daysSinceLast - 1.5) * 22, 20, 100)
  const consistencyShape = clamp((weeklySessions / trainingTarget) * 100, 20, 120)
  const streakShape = clamp(35 + streak * 2.2, 35, 100)
  const readiness = Math.round(clamp((recoveryShape * 0.45) + (consistencyShape * 0.35) + (streakShape * 0.2), 25, 99))

  let readinessLabel = 'Rebuild'
  if (readiness >= 82) readinessLabel = 'Prime'
  else if (readiness >= 68) readinessLabel = 'Ready'
  else if (readiness >= 52) readinessLabel = 'Steady'

  const last7Volume = sumVolume(last7)
  const prev7Volume = sumVolume(prev7)
  const volumeTrend = prev7Volume > 0 ? ((last7Volume - prev7Volume) / prev7Volume) * 100 : (last7Volume > 0 ? 100 : 0)

  const totalDuration = sumDuration(last7)
  const efficiency = totalDuration > 0 ? last7Volume / totalDuration : 0

  const hourBuckets = new Map([
    ['early', { label: '05:00-09:00', volume: 0, count: 0 }],
    ['midday', { label: '09:00-14:00', volume: 0, count: 0 }],
    ['afternoon', { label: '14:00-19:00', volume: 0, count: 0 }],
    ['night', { label: '19:00-24:00', volume: 0, count: 0 }],
    ['late', { label: '00:00-05:00', volume: 0, count: 0 }],
  ])

  completedWorkouts.forEach((workout) => {
    const hour = workout.completedAt.getHours()
    const key = hour >= 5 && hour < 9
      ? 'early'
      : hour >= 9 && hour < 14
        ? 'midday'
        : hour >= 14 && hour < 19
          ? 'afternoon'
          : hour >= 19 && hour < 24
            ? 'night'
            : 'late'

    const bucket = hourBuckets.get(key)
    bucket.volume += workout.volume
    bucket.count += 1
  })

  const bestWindow = Array.from(hourBuckets.values()).sort((a, b) => {
    const aScore = a.count > 0 ? a.volume / a.count : 0
    const bScore = b.count > 0 ? b.volume / b.count : 0
    return bScore - aScore
  })[0]

  const patternScores = { push: 0, pull: 0, lower: 0 }
  ;(recentPRs || []).forEach((pr) => {
    const name = String(pr?.exercise_name || '').toLowerCase()
    if (/squat|deadlift|lunge|leg|calf|hip|quad|hamstring|glute/.test(name)) patternScores.lower += 1
    else if (/row|pull|curl|rear|lat|trap/.test(name)) patternScores.pull += 1
    else if (/bench|press|dip|tricep|chest|shoulder/.test(name)) patternScores.push += 1
  })

  const dominantPattern = Object.entries(patternScores).sort((a, b) => b[1] - a[1])[0]
  const lowerPattern = Math.min(...Object.values(patternScores))
  const patternGap = dominantPattern ? dominantPattern[1] - lowerPattern : 0
  const patternLabelMap = { push: 'Push', pull: 'Pull', lower: 'Lower Body' }

  const latestPrAge = recentPRs?.[0]?.achieved_at
    ? (now - new Date(recentPRs[0].achieved_at).getTime()) / DAY_MS
    : null

  const prProbability = Math.round(clamp(
    38
      + (volumeTrend * 0.35)
      + ((readiness - 60) * 0.55)
      + (latestPrAge != null && latestPrAge < 14 ? 10 : -2)
      - (daysSinceLast != null && daysSinceLast > 4 ? 10 : 0),
    12,
    96,
  ))

  const acuteLoad = last7Volume / 7
  const chronicLoad = last28.length > 0 ? sumVolume(last28) / 28 : 0
  const loadRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1

  let loadState = 'Balanced'
  if (loadRatio > 1.35) loadState = 'Overreach Risk'
  else if (loadRatio < 0.78) loadState = 'Undershooting'

  return [
    {
      id: 'readiness',
      title: 'Readiness Index',
      value: `${readiness}/100`,
      note: `${readinessLabel} state from recovery timing, weekly consistency, and streak pressure.`,
    },
    {
      id: 'momentum',
      title: 'Volume Momentum',
      value: formatSignedPercent(volumeTrend),
      note: `${formatVolume(last7Volume, unit)}${unitName} vs ${formatVolume(prev7Volume, unit)}${unitName} over the last 2 weeks.`,
    },
    {
      id: 'adherence',
      title: 'Plan Adherence',
      value: `${weeklyAdherence}%`,
      note: `${weeklySessions} sessions this week vs your ${trainingTarget}/week target.`,
    },
    {
      id: 'efficiency',
      title: 'Session Efficiency',
      value: efficiency > 0 ? `${formatWeight(efficiency, unit, 1)} ${unitName}/min` : 'No data',
      note: `Based on load moved per minute across your last ${Math.min(last7.length, 7)} sessions.`,
    },
    {
      id: 'window',
      title: 'Peak Performance Window',
      value: bestWindow?.count ? bestWindow.label : 'No data',
      note: bestWindow?.count
        ? 'Your highest average output appears in this training window.'
        : 'Complete more sessions to lock your strongest time window.',
    },
    {
      id: 'balance',
      title: 'Strength Bias Signal',
      value: dominantPattern && dominantPattern[1] > 0
        ? `${patternLabelMap[dominantPattern[0]]} +${patternGap}`
        : 'Neutral',
      note: dominantPattern && dominantPattern[1] > 0
        ? 'PR distribution shows where your strength curve is outpacing other patterns.'
        : 'Log a few PRs to surface your strongest movement pattern.',
    },
    {
      id: 'pr',
      title: 'Next-Session PR Chance',
      value: `${prProbability}%`,
      note: 'Forecast from momentum, readiness, and recency of PR breakthroughs.',
    },
    {
      id: 'load',
      title: 'Acute Load Ratio',
      value: `${loadRatio.toFixed(2)}x`,
      note: `${loadState} profile from your 7-day load compared to your 28-day baseline.`,
    },
  ]
}

function toWorkoutNumber(value, fallback = 0, preference = 'first') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const matches = String(value ?? '').match(/\d*\.?\d+/g)
  if (!matches?.length) return fallback

  const picked = preference === 'last' ? matches[matches.length - 1] : matches[0]
  const parsed = Number(picked)
  return Number.isFinite(parsed) ? parsed : fallback
}

function generateDailyChallenge(profile) {
  const day = new Date().getDate()
  const challenges = [
    { icon: <RiFireFill size={20} />, title: 'Complete today\'s workout', desc: 'Finish every set in your session' },
    { icon: <RiWaterFlashFill size={20} />, title: 'Drink 8 glasses of water', desc: 'Stay hydrated throughout the day' },
    { icon: <RiScalesFill size={20} />, title: `Hit ${profile?.goal === 'hypertrophy' ? '150' : '120'}g protein`, desc: 'Reach your daily protein target' },
    { icon: <RiRunFill size={20} />, title: 'Train under 50 minutes', desc: 'Tight rest times = more gains' },
    { icon: <RiTrophyFill size={20} />, title: 'Beat a previous set', desc: 'Lift heavier or more reps than last time' },
    { icon: <RiFlashlightFill size={20} />, title: 'Start within 30 minutes', desc: 'No procrastination — gym NOW' },
  ]
  return challenges[day % challenges.length]
}

function getAuraLevel(streak) {
  if (streak >= 30) return 'fire'
  if (streak >= 14) return 'high'
  if (streak >= 7) return 'medium'
  if (streak >= 3) return 'low'
  return ''
}

function isRestLikeWorkoutDay(day) {
  const name = String(day?.day_name || '').toLowerCase()
  return !Array.isArray(day?.exercises) || day.exercises.length === 0 || /\brest\b|\brecovery\b|\boff\b/.test(name)
}

function buildSetTemplatesFromExercises(exercises = []) {
  const setTemplates = []

  ;(Array.isArray(exercises) ? exercises : []).forEach((exercise) => {
    const setCount = Math.max(1, Math.round(toWorkoutNumber(exercise?.sets, 3)))
    const targetReps = Math.max(1, Math.round(toWorkoutNumber(exercise?.reps, 8, 'last')))
    const targetWeight = Math.max(0, toWorkoutNumber(exercise?.weight, 0))

    for (let index = 1; index <= setCount; index += 1) {
      setTemplates.push({
        exercise_name: exercise?.name || `Exercise ${index}`,
        set_number: index,
        target_reps: targetReps,
        target_weight: targetWeight,
        completed: false,
      })
    }
  })

  return setTemplates
}

function buildSetTemplatesFromLoggedSets(sets = []) {
  return (Array.isArray(sets) ? sets : []).map((set, index) => ({
    exercise_name: set?.exercise_name || `Exercise ${index + 1}`,
    set_number: Number(set?.set_number) || index + 1,
    target_reps: Math.max(1, Math.round(Number(set?.actual_reps ?? set?.target_reps ?? 8) || 8)),
    target_weight: Math.max(0, Number(set?.actual_weight ?? set?.target_weight ?? 0) || 0),
    completed: false,
  }))
}

export default function Dashboard() {
  const { v2 } = useV2()
  if (v2) return <DashboardV2 />
  return <DashboardLegacy />
}

function DashboardLegacy() {
  const { user, profile, isPro, isUltra, subscriptionTier } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [recentPRs, setRecentPRs] = useState([])
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [stats, setStats] = useState({ total: 0, streak: 0, volume: 0 })
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState('')
  const [dashboardToast, setDashboardToast] = useState('')
  const [motivation] = useState(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadDashboard()
    checkNotifPermission()
    return () => { mounted.current = false }
  }, [])

  async function checkNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => setShowNotifPrompt(true), 3000)
    }
  }

  async function enableNotifications() {
    setShowNotifPrompt(false)
    const sub = await subscribeToPush(user.id)
    if (sub) showLocalNotification('REPMAX', 'Notifications enabled! 💪')
  }

  function openDiscord() {
    window.open('https://discord.gg/46XgPVaccJ', '_blank', 'noopener,noreferrer')
  }

  function showDashboardToastMsg(message) {
    setDashboardToast(message)
    window.setTimeout(() => setDashboardToast(''), 3000)
  }

  async function loadDashboard() {
    try {
      const [progRes, prsRes, workoutsRes, notifsRes] = await Promise.all([
        supabase.from('programs').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(18),
        supabase.from('workouts').select('started_at, completed_at, total_volume, day_name').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', user.id).eq('read', false)
      ])

      if (progRes.data) {
        setProgram(progRes.data)
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const dayMap = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
        const shortDay = dayMap[today]
        const trainingDays = profile?.training_days || []
        const dayIndex = trainingDays.indexOf(shortDay)
        if (dayIndex !== -1 && progRes.data.program_data?.weeks) {
          const currentWeek = progRes.data.program_data.weeks[(progRes.data.current_week || 1) - 1]
          if (currentWeek?.days?.[dayIndex]) {
            setTodayWorkout({ ...currentWeek.days[dayIndex], weekNumber: progRes.data.current_week || 1 })
          }
        }
      }

      if (!mounted.current) return
      setRecentPRs(prsRes.data || [])
      setWorkoutHistory(workoutsRes.data || [])
      setUnreadNotifs(notifsRes.count || 0)

      if (workoutsRes.data) {
        const totalVol = workoutsRes.data.reduce((s, w) => s + (w.total_volume || 0), 0)
        setStats({ total: workoutsRes.data.length, streak: profile?.current_streak || 0, volume: Math.round(totalVol) })
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  async function launchWorkoutFromTemplate({ dayName, weekNumber = null, programId = null, setTemplates = [] }) {
    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        program_id: programId,
        day_name: dayName,
        week_number: weekNumber,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !workout) {
      throw error || new Error('Could not start the workout.')
    }

    if (setTemplates.length > 0) {
      const { error: setsError } = await supabase.from('sets').insert(
        setTemplates.map((set) => ({ ...set, workout_id: workout.id }))
      )

      if (setsError) throw setsError
    }

    navigate(`/workout/${workout.id}`)
  }

  async function startPlannedWorkout(day) {
    if (!day) return

    await launchWorkoutFromTemplate({
      dayName: day.day_name || 'Workout',
      weekNumber: day.weekNumber || program?.current_week || 1,
      programId: program?.id || null,
      setTemplates: buildSetTemplatesFromExercises(day.exercises),
    })
  }

  async function startWorkout() {
    if (!todayWorkout || !program) return
    setStartingWorkout('today')

    try {
      await startPlannedWorkout(todayWorkout)
    } catch (error) {
      console.error('Start workout error:', error)
      showDashboardToastMsg('Could not start today\'s workout. Please try again.')
    } finally {
      setStartingWorkout('')
    }
  }

  async function startQuickWorkout() {
    setStartingWorkout('quick')

    try {
      const { data: recentWorkout, error: recentWorkoutError } = await supabase
        .from('workouts')
        .select('id, day_name, program_id, week_number')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentWorkoutError) throw recentWorkoutError

      if (recentWorkout?.id) {
        const { data: recentSets, error: recentSetsError } = await supabase
          .from('sets')
          .select('exercise_name, set_number, actual_reps, target_reps, actual_weight, target_weight')
          .eq('workout_id', recentWorkout.id)
          .order('exercise_name')
          .order('set_number')

        if (recentSetsError) throw recentSetsError

        const setTemplates = buildSetTemplatesFromLoggedSets(recentSets)
        if (setTemplates.length > 0) {
          await launchWorkoutFromTemplate({
            dayName: recentWorkout.day_name || 'Quick Workout',
            weekNumber: program?.current_week || recentWorkout.week_number || 1,
            programId: program?.id || recentWorkout.program_id || null,
            setTemplates,
          })
          return
        }
      }

      const fallbackDay = currentWeekWorkoutDays[0]
      if (fallbackDay) {
        await startPlannedWorkout(fallbackDay)
        return
      }

      showDashboardToastMsg('Set up a program first so REPMAX can build your session.')
    } catch (error) {
      console.error('Quick workout error:', error)
      showDashboardToastMsg('Could not start a quick workout right now.')
    } finally {
      setStartingWorkout('')
    }
  }

  async function handleShareDNA() {
    setSharing(true)
    try {
      await shareDNACard(profile, stats, profile?.theme_color || 'green')
    } catch {}
    setSharing(false)
  }

  const greeting = getGreeting()
  const firstName = typeof profile?.display_name === 'string' ? profile.display_name.split(' ')[0] : 'Athlete'
  const unit = typeof profile?.unit_preference === 'string' ? profile.unit_preference : typeof profile?.units === 'string' ? profile.units : 'kg'
  const challenge = generateDailyChallenge(profile)
  const auraLevel = getAuraLevel(stats.streak)
  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = profile?.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`
  const currentWeekWorkoutDays = useMemo(() => {
    const currentWeek = program?.program_data?.weeks?.[(program?.current_week || 1) - 1]
    if (!currentWeek?.days) return []

    return currentWeek.days
      .map((day, index) => ({
        ...day,
        weekNumber: program?.current_week || 1,
        dayIndex: index,
      }))
      .filter((day) => !isRestLikeWorkoutDay(day))
  }, [program])
  const ultraLabHref = '/ultra-lab?tab=intelligence'
  const ultraLabTitle = isUltra ? 'ULTRA Lab is live inside your app now.' : 'ULTRA Lab keeps the deep analytics off your main dashboard.'
  const ultraLabBody = isUltra
    ? 'Open Intelligence for readiness and forecasting, bring outside routines through Import Studio, and use Social Edge as a real training layer.'
    : 'Preview the premium analytics, routine import, and social planning layer before you upgrade, while the main dashboard stays cleaner.'

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 200, height: 28 }} />
        </div>
        <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 12 }} />
        <div className="stat-row">
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Notification permission prompt */}
      {showNotifPrompt && (
        <div className="notif-prompt" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RiNotification3Fill size={20} color="var(--text-on-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('dashboard_notif_title')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t('dashboard_notif_body')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowNotifPrompt(false)}>Later</button>
            <button className="btn btn-sm btn-primary" onClick={enableNotifications}>Enable</button>
          </div>
        </div>
      )}

      {/* Header with Aura Avatar */}
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`aura-ring ${auraLevel}`} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={avatarUrl}
                alt="" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-card)' }}
              />
            </div>
            <div>
              <p className="page-greeting">{greeting}</p>
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {firstName} {isPro && <ProBadge size="md" tier={subscriptionTier} />}
              </h1>
            </div>
          </div>
          <button className="notif-badge" onClick={() => navigate('/notifications')}>
            <RiNotification3Fill size={20} />
            {unreadNotifs > 0 && <span className="notif-count">{unreadNotifs}</span>}
          </button>
        </div>
        <div style={{ marginTop: 8, fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          "{motivation}"
        </div>
      </div>

      {/* Daily Challenge — free/PRO users */}
      {!isUltra && (
        <div className="challenge-card">
          <div className="challenge-icon">{challenge.icon}</div>
          <div className="challenge-text">
            <div className="challenge-title">{challenge.title}</div>
            <div className="challenge-desc">{challenge.desc}</div>
            <div className="challenge-progress">
              <div className="challenge-progress-fill" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ ULTRA AUTOPILOT — Today's Play ═══ */}
      {isUltra && (() => {
        const insights = buildUltraInsights({ profile, workouts: workoutHistory, recentPRs, unit })
        const readinessInsight = insights.find(i => i.id === 'readiness')
        const readinessVal = parseInt(readinessInsight?.value) || 50
        const loadInsight = insights.find(i => i.id === 'load')

        const trainAction = todayWorkout
          ? { label: todayWorkout.day_name, sub: `${todayWorkout.exercises?.length || 0} exercises · Week ${todayWorkout.weekNumber}` }
          : { label: 'Rest or freestyle', sub: readinessVal >= 70 ? 'Readiness is high — train if you want' : 'Recovery day recommended' }

        const proteinTarget = profile?.goal === 'hypertrophy' ? 160 : profile?.goal === 'strength' ? 180 : 140
        const calorieTarget = profile?.goal === 'hypertrophy' ? 2800 : 2200

        const recoverSignal = readinessVal >= 80 ? '🟢 Prime — go hard'
          : readinessVal >= 60 ? '🟡 Steady — normal intensity'
          : '🔴 Rebuild — lighter volume today'

        const topFriend = null // friends loaded on Social page, not Dashboard

        return (
          <div className="card autopilot-card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(204,255,0,0.04), rgba(0,212,255,0.02)), var(--bg-card)', border: '1px solid rgba(204,255,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <RiSparklingFill size={16} color="var(--accent)" />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>Today's Play</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Autopilot</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Train */}
              <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.08)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>🏋️ Train</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3 }}>{trainAction.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{trainAction.sub}</div>
              </div>

              {/* Eat */}
              <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.06)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#00d4ff', textTransform: 'uppercase', marginBottom: 4 }}>🍗 Eat</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3 }}>{proteinTarget}g protein</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{todayWorkout ? `~${calorieTarget} kcal` : `~${calorieTarget - 300} kcal rest day`}</div>
              </div>

              {/* Recover */}
              <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>💤 Recover</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{recoverSignal}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Readiness {readinessVal}/100</div>
              </div>

              {/* Social */}
              <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/social')}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>👥 Social</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{topFriend ? `Nudge ${topFriend.display_name?.split(' ')[0]}` : 'Find a gym partner'}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{topFriend ? 'Tap to message' : 'Add friends'}</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══ PLATEAU DOCTOR — Stall Detector ═══ */}
      {isUltra && recentPRs.length > 0 && (() => {
        const now = Date.now()
        const DAY = 86400000
        const exerciseLastPR = {}
        recentPRs.forEach(pr => {
          const name = pr.exercise_name
          if (!exerciseLastPR[name]) {
            exerciseLastPR[name] = { age: (now - new Date(pr.achieved_at).getTime()) / DAY, weight: pr.weight, reps: pr.reps }
          }
        })

        const stalled = Object.entries(exerciseLastPR)
          .filter(([, data]) => data.age >= 14)
          .sort((a, b) => b[1].age - a[1].age)
          .slice(0, 3)

        if (stalled.length === 0) return null

        const readinessInsight = buildUltraInsights({ profile, workouts: workoutHistory, recentPRs, unit }).find(i => i.id === 'readiness')
        const readiness = parseInt(readinessInsight?.value) || 50

        return (
          <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,100,100,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: '1.1rem' }}>🩺</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff6b6b' }}>Plateau Doctor</span>
            </div>
            {stalled.map(([name, data]) => {
              const cause = readiness < 55 ? 'Under-recovery likely'
                : data.age > 28 ? 'Exercise may need rotation'
                : 'Volume or progression mismatch'
              return (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      Stalled {Math.round(data.age)}d · {cause}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ff6b6b', fontWeight: 700 }}>
                    {data.weight}{unit}×{data.reps}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {todayWorkout ? (
        <div className="card card-accent" style={{ marginBottom: 16, marginTop: 14 }}>
          <div className="card-label">{t('dashboard_today_workout')}</div>
          <div className="card-title">{String(todayWorkout.day_name)}</div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.length || 0} exercises · Week {todayWorkout.weekNumber}
            {Array.isArray(todayWorkout.target_muscles) && ` · ${todayWorkout.target_muscles.join(', ')}`}
          </div>
          <div style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.slice(0, 3).map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{String(ex.name)}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>{Number(ex.sets) || 0}×{Number(ex.reps) || 0}</span>
              </div>
            ))}
            {todayWorkout.exercises?.length > 3 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingTop: 8 }}>+{todayWorkout.exercises.length - 3} more exercises</p>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={startWorkout} disabled={startingWorkout !== ''}>
            <RiFlashlightFill size={18} /> {startingWorkout === 'today' ? 'Starting workout…' : t('dashboard_start_workout')}
          </button>
        </div>
      ) : (
        <div className="card dashboard-train-anyway-card" style={{ marginTop: 14, marginBottom: 16 }}>
          <div className="card-label">READY WHEN YOU ARE</div>
          <h3 style={{ margin: '4px 0 8px', fontSize: '1.18rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Train anyway, or keep today as recovery.
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
            If you feel like lifting today, REPMAX should get out of your way. Start a quick session instantly or run one of your planned days anyway.
          </p>
          <div className="dashboard-train-anyway-actions">
            <button className="btn btn-primary" onClick={startQuickWorkout} disabled={startingWorkout !== ''}>
              {startingWorkout === 'quick' ? 'Starting quick session…' : 'Train anyway'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPlanPicker(true)} disabled={startingWorkout !== '' || currentWeekWorkoutDays.length === 0}>
              Run a planned day
            </button>
          </div>
          <button className="dashboard-recovery-link" type="button" onClick={() => navigate('/recovery')}>
            Recovery Hub still lives here if you want the easier day <RiArrowRightLine size={16} />
          </button>
        </div>
      )}

      {/* PRO Promotion — Always visible for free users */}
      {!isPro && (
        <div className="pro-banner" onClick={() => navigate('/subscribe')}>
          <div className="pro-banner-glow" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 32 }}><RiVipCrownFill size={28} color="#ffd700" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>Upgrade to PRO</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI Coach · Custom Themes · Unlimited Friends</div>
            </div>
            <RiArrowRightLine size={20} style={{ color: '#ffd700' }} />
          </div>
        </div>
      )}

      {isPro && !isUltra && (
        <div className="premium-mode-shell">
          <div className="premium-mode-kicker">PRO MODE</div>
          <div className="premium-mode-title">Your interface is tuned for the paid tier now.</div>
          <p className="premium-mode-body">
            Cleaner glass panels, deeper tracking, smarter AI flows, and a faster path into custom programs and social tools.
          </p>
        </div>
      )}

      <div className="dashboard-boost-grid">
        <button type="button" className="dashboard-boost-card dashboard-boost-card-discord" onClick={openDiscord}>
          <div className="dashboard-boost-kicker">COMMUNITY</div>
          <div className="dashboard-boost-title">{t('dashboard_discord_title')}</div>
          <div className="dashboard-boost-body">{t('dashboard_discord_body')}</div>
          <div className="dashboard-boost-footer">
            <span className="dashboard-boost-chip"><RiTeamFill size={15} /> Discord</span>
            <span className="dashboard-boost-link">{t('dashboard_discord_cta')} <RiArrowRightLine size={16} /></span>
          </div>
        </button>

        <button type="button" className="dashboard-boost-card dashboard-boost-card-run" onClick={() => navigate('/run')}>
          <div className="dashboard-boost-kicker">OUTDOOR</div>
          <div className="dashboard-boost-title">{t('dashboard_run_beta')}</div>
          <div className="dashboard-boost-body">{t('dashboard_run_beta_desc')}</div>
          <div className="dashboard-boost-footer">
            <span className="dashboard-boost-chip"><RiRunFill size={15} /> Beta</span>
            <span className="dashboard-boost-link">{t('dashboard_run_cta')} <RiArrowRightLine size={16} /></span>
          </div>
        </button>
      </div>

      <section className={`ultra-lab-spotlight ${isUltra ? 'live' : 'locked'}`} onClick={() => navigate(ultraLabHref)}>
        <div className="ultra-lab-spotlight-copy">
          <div className="ultra-lab-spotlight-kicker">{isUltra ? 'ULTRA LAB' : 'ULTRA PREVIEW'}</div>
          <h3 className="ultra-lab-spotlight-title">{ultraLabTitle}</h3>
          <p className="ultra-lab-spotlight-body">{ultraLabBody}</p>
          <div className="ultra-lab-spotlight-tags">
            <span>Intelligence</span>
            <span>Import Studio</span>
            <span>Social Edge</span>
          </div>
        </div>
        <div className="ultra-lab-spotlight-cta">
          <div className="ultra-lab-spotlight-chip">{isUltra ? 'Open now' : 'Preview'}</div>
          <RiArrowRightLine size={18} />
        </div>
      </section>

      <section
        className={`ultra-lab-spotlight communities-spotlight ${isUltra ? 'live' : 'locked'}`}
        onClick={() => navigate('/communities')}
      >
        <div className="ultra-lab-spotlight-copy">
          <div className="ultra-lab-spotlight-kicker">{isUltra ? 'COMMUNITIES · LIVE' : 'COMMUNITIES · ULTRA'}</div>
          <h3 className="ultra-lab-spotlight-title">
            {isUltra ? 'Your crews are waiting.' : 'Crews, PR walls, challenges — ULTRA only.'}
          </h3>
          <p className="ultra-lab-spotlight-body">
            {isUltra
              ? 'See who holds the crown in your city, your gym, and your split this week.'
              : 'City crews, shared PR walls, stake challenges, and the elite streak board all live here.'}
          </p>
          <div className="ultra-lab-spotlight-tags">
            <span>Crews</span>
            <span>PR Wall</span>
            <span>Challenges</span>
            <span>Streaks</span>
          </div>
        </div>
        <div className="ultra-lab-spotlight-cta">
          <div className="ultra-lab-spotlight-chip">{isUltra ? 'Enter' : 'Preview'}</div>
          <RiArrowRightLine size={18} />
        </div>
      </section>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{Number(stats.total) || 0}</div>
          <div className="stat-desc">{t('dashboard_workouts')}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{Number(stats.streak) || 0}</div>
          <div className="stat-desc">{t('dashboard_day_streak')}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{Number(stats.volume) > 1000 ? `${(Number(stats.volume) / 1000).toFixed(1)}k` : (Number(stats.volume) || 0)}</div>
          <div className="stat-desc">{unit} Lifted</div>
        </div>
      </div>

      {/* Shareable Workout DNA Card */}
      <div className="dna-card" style={{ marginTop: 16 }}>
        <div className="dna-header">
          <div className={`aura-ring ${auraLevel}`} style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}`} alt="" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="dna-name">{profile?.display_name || 'Athlete'}</div>
            {isPro && <div className="dna-badge">{isUltra ? 'ULTRA' : 'PRO'}</div>}
          </div>
          <button
            onClick={handleShareDNA}
            disabled={sharing}
            className="dna-share-btn"
          >
            {sharing ? <span className="spinner-sm" /> : <><RiShareLine size={16} /> Share</>}
          </button>
        </div>
        <div className="dna-stats">
          <div className="dna-stat">
            <div className="dna-stat-value">{Number(stats.total) || 0}</div>
            <div className="dna-stat-label">Sessions</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{Number(stats.streak) || 0}</div>
            <div className="dna-stat-label">Streak</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{typeof profile?.preferred_split === 'string' ? profile.preferred_split.replace('_', '/').toUpperCase() : '—'}</div>
            <div className="dna-stat-label">Split</div>
          </div>
        </div>
        <div className="dna-watermark">REPMAX</div>
      </div>

      {/* Current Program */}
      {program && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">{t('dashboard_current_program')}</div>
          <div className="card-title">{String(program.name || 'Custom Program')}</div>
          <div className="card-subtitle">Week {program.current_week || 1} of {program.total_weeks || 4} · {typeof program.split_type === 'string' ? program.split_type.replace('_', '/').toUpperCase() : 'CUSTOM'}</div>
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${((program.current_week || 1) / (program.total_weeks || 4)) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 className="section-title"><RiTrophyFill size={16} /> {t('dashboard_recent_prs')}</h3>
          {recentPRs.slice(0, 3).map(pr => (
            <div key={pr.id} className="pr-item">
              <div className="pr-badge"><RiMedalFill size={18} /></div>
              <div className="pr-info">
                <div className="pr-exercise">{String(pr.exercise_name)}</div>
                <div className="pr-details">{Number(pr.weight) || 0} {unit} × {Number(pr.reps) || 0} reps</div>
              </div>
              <div className="pr-date">{new Date(pr.achieved_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {showPlanPicker && (
        <div className="modal-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) setShowPlanPicker(false)
        }}>
          <div className="modal" style={{ textAlign: 'left', maxWidth: 420 }}>
            <div className="modal-title" style={{ marginBottom: 6 }}>Run a planned day anyway</div>
            <div className="modal-subtitle" style={{ marginBottom: 18 }}>
              Pick any training day from your active week and REPMAX will open it right away.
            </div>

            {currentWeekWorkoutDays.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentWeekWorkoutDays.map((day) => (
                  <button
                    key={`${day.day_name}-${day.dayIndex}`}
                    className="dashboard-plan-option"
                    onClick={async () => {
                      setShowPlanPicker(false)
                      setStartingWorkout(`planned-${day.dayIndex}`)
                      try {
                        await startPlannedWorkout(day)
                      } catch (error) {
                        console.error('Planned workout launch error:', error)
                        showDashboardToastMsg('Could not open that planned day right now.')
                      } finally {
                        setStartingWorkout('')
                      }
                    }}
                  >
                    <div>
                      <div className="dashboard-plan-option-title">{day.day_name || `Day ${day.dayIndex + 1}`}</div>
                      <div className="dashboard-plan-option-copy">
                        {day.exercises?.length || 0} exercises
                        {Array.isArray(day.target_muscles) && day.target_muscles.length > 0 ? ` · ${day.target_muscles.join(', ')}` : ''}
                      </div>
                    </div>
                    <RiArrowRightLine size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="dashboard-plan-empty">
                No training days are ready in your active plan yet.
              </div>
            )}

            <button className="btn btn-secondary btn-full" style={{ marginTop: 16 }} onClick={() => setShowPlanPicker(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {dashboardToast && <div className="toast">{dashboardToast}</div>}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
