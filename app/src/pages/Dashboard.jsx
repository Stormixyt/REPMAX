import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
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

export default function Dashboard() {
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
    window.open('https://discord.gg/repmax', '_blank', 'noopener,noreferrer')
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

  async function startWorkout() {
    if (!todayWorkout || !program) return
    const { data: workout, error } = await supabase.from('workouts').insert({ user_id: user.id, program_id: program.id, day_name: todayWorkout.day_name, week_number: todayWorkout.weekNumber, started_at: new Date().toISOString() }).select().single()
    if (!error && workout) {
      const setInserts = []
      todayWorkout.exercises?.forEach(ex => {
        const setCount = Math.max(1, Math.round(toWorkoutNumber(ex.sets, 3)))
        const targetReps = Math.max(1, Math.round(toWorkoutNumber(ex.reps, 8, 'last')))
        const targetWeight = Math.max(0, toWorkoutNumber(ex.weight, 0))

        for (let i = 1; i <= setCount; i++) {
          setInserts.push({ workout_id: workout.id, exercise_name: ex.name, set_number: i, target_reps: targetReps, target_weight: targetWeight, completed: false })
        }
      })
      if (setInserts.length > 0) await supabase.from('sets').insert(setInserts)
      navigate(`/workout/${workout.id}`)
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
  const firstName = profile?.display_name?.split(' ')[0] || 'Athlete'
  const unit = profile?.unit_preference || profile?.units || 'kg'
  const challenge = generateDailyChallenge(profile)
  const auraLevel = getAuraLevel(stats.streak)
  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = profile?.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`
  const ultraInsights = useMemo(() => buildUltraInsights({
    profile,
    workouts: workoutHistory,
    recentPRs,
    unit,
  }), [profile, workoutHistory, recentPRs, unit])

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

      {/* Daily Challenge */}
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

      {isUltra && (
        <section className="ultra-intelligence-shell">
          <div className="ultra-intelligence-header">
            <div>
              <div className="ultra-intelligence-kicker">ULTRA ANALYTICS</div>
              <h3 className="ultra-intelligence-title">Personalized Intelligence Layer</h3>
            </div>
            <div className="ultra-intelligence-chip">Live model</div>
          </div>

          <div className="ultra-intelligence-grid">
            {ultraInsights.map((insight) => {
              const Icon = ULTRA_INSIGHT_ICONS[insight.id] || RiBrainFill
              return (
                <article key={insight.id} className="ultra-insight-card">
                  <div className="ultra-insight-top">
                    <span className="ultra-insight-icon"><Icon size={15} /></span>
                    <span className="ultra-insight-name">{insight.title}</span>
                  </div>
                  <div className="ultra-insight-value">{insight.value}</div>
                  <p className="ultra-insight-note">{insight.note}</p>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* Today's Workout */}
      {todayWorkout ? (
        <div className="card card-accent" style={{ marginBottom: 16, marginTop: !isPro ? 12 : 0 }}>
          <div className="card-label">{t('dashboard_today_workout')}</div>
          <div className="card-title">{todayWorkout.day_name}</div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.length || 0} exercises · Week {todayWorkout.weekNumber}
            {todayWorkout.target_muscles && ` · ${todayWorkout.target_muscles.join(', ')}`}
          </div>
          <div style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.slice(0, 3).map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{ex.name}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>{ex.sets}×{ex.reps}</span>
              </div>
            ))}
            {todayWorkout.exercises?.length > 3 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingTop: 8 }}>+{todayWorkout.exercises.length - 3} more exercises</p>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={startWorkout}>
            <RiFlashlightFill size={18} /> {t('dashboard_start_workout')}
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: !isPro ? 12 : 0, marginBottom: 16, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onClick={() => navigate('/recovery')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-label" style={{ margin: 0, color: 'var(--text-tertiary)' }}>{t('dashboard_rest_day')}</div>
              <h3 style={{ margin: '4px 0 0', fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)' }}>{t('dashboard_recovery_hub')}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stretches, hydration & sleep</p>
            </div>
            <div style={{ background: 'var(--accent-glow)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RiArrowRightLine size={20} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-desc">{t('dashboard_workouts')}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.streak}</div>
          <div className="stat-desc">{t('dashboard_day_streak')}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.volume > 1000 ? `${(stats.volume / 1000).toFixed(1)}k` : stats.volume}</div>
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
            <div className="dna-stat-value">{stats.total}</div>
            <div className="dna-stat-label">Sessions</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{stats.streak}</div>
            <div className="dna-stat-label">Streak</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{profile?.preferred_split?.replace('_', '/').toUpperCase() || '—'}</div>
            <div className="dna-stat-label">Split</div>
          </div>
        </div>
        <div className="dna-watermark">REPMAX</div>
      </div>

      {/* Current Program */}
      {program && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">{t('dashboard_current_program')}</div>
          <div className="card-title">{program.name}</div>
          <div className="card-subtitle">Week {program.current_week || 1} of {program.total_weeks || 4} · {program.split_type?.replace('_', '/').toUpperCase()}</div>
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
                <div className="pr-exercise">{pr.exercise_name}</div>
                <div className="pr-details">{pr.weight} {unit} × {pr.reps} reps</div>
              </div>
              <div className="pr-date">{new Date(pr.achieved_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
