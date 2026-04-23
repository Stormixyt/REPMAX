import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'
import { shareDNACard } from '../lib/shareDNA'
import { subscribeToPush, showLocalNotification } from '../lib/pushNotifications'
import { formatVolume, weightLabel } from '../lib/units'
import {
  RiFlashlightFill, RiTrophyFill, RiMedalFill, RiArrowRightLine, RiVipCrownFill,
  RiFireFill, RiRunFill, RiShareLine, RiSparklingFill, RiTeamFill, RiBrainFill,
  RiPulseLine, RiMoonClearFill, RiHeartPulseFill
} from '@remixicon/react'
import ProBadge from '../components/ProBadge'
import {
  Page, Card, CardEyebrow, CardTitle, CardSubtitle,
  Button, Badge, Avatar, ProgressBar, Ring,
  Stat, StatGrid, Skeleton, EmptyState, SectionHeader, Sheet, Chip
} from '../components/ui'

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function toWorkoutNumber(value, fallback = 0, preference = 'first') {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const matches = String(value ?? '').match(/\d*\.?\d+/g)
  if (!matches?.length) return fallback
  const picked = preference === 'last' ? matches[matches.length - 1] : matches[0]
  const parsed = Number(picked)
  return Number.isFinite(parsed) ? parsed : fallback
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

function computeReadiness({ profile, workouts }) {
  const now = Date.now()
  const completed = (workouts || [])
    .filter(w => w?.completed_at)
    .map(w => ({ t: new Date(w.completed_at).getTime(), volume: Number(w.total_volume) || 0 }))
    .sort((a, b) => b.t - a.t)

  const last = completed[0]
  const daysSince = last ? (now - last.t) / DAY_MS : null
  const last7 = completed.filter(w => now - w.t <= 7 * DAY_MS)

  const target = Math.max(1, profile?.training_days?.length || 4)
  const streak = Number(profile?.current_streak) || 0

  const recoveryShape = daysSince == null ? 60 : clamp(100 - Math.abs(daysSince - 1.5) * 22, 20, 100)
  const consistencyShape = clamp((last7.length / target) * 100, 20, 120)
  const streakShape = clamp(35 + streak * 2.2, 35, 100)
  const readiness = Math.round(clamp((recoveryShape * 0.45) + (consistencyShape * 0.35) + (streakShape * 0.2), 25, 99))

  let label = 'Rebuild'
  if (readiness >= 82) label = 'Prime'
  else if (readiness >= 68) label = 'Ready'
  else if (readiness >= 52) label = 'Steady'

  return { readiness, label, last7: last7.length, target }
}

export default function DashboardV2() {
  const { user, profile, isPro, isUltra, subscriptionTier } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [recentPRs, setRecentPRs] = useState([])
  const [workoutHistory, setWorkoutHistory] = useState([])
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
      setTimeout(() => setShowNotifPrompt(true), 3500)
    }
  }

  async function enableNotifications() {
    setShowNotifPrompt(false)
    const sub = await subscribeToPush(user.id)
    if (sub) showLocalNotification('REPMAX', 'Notifications enabled')
  }

  function showDashboardToastMsg(message) {
    setDashboardToast(message)
    window.setTimeout(() => setDashboardToast(''), 3000)
  }

  async function loadDashboard() {
    try {
      const [progRes, prsRes, workoutsRes] = await Promise.all([
        supabase.from('programs').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(18),
        supabase.from('workouts').select('started_at, completed_at, total_volume, day_name').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
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

    if (error || !workout) throw error || new Error('Could not start the workout.')

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
      showDashboardToastMsg('Could not start today\'s workout. Try again.')
    } finally {
      setStartingWorkout('')
    }
  }

  async function startQuickWorkout() {
    setStartingWorkout('quick')
    try {
      const { data: recentWorkout, error: e1 } = await supabase
        .from('workouts').select('id, day_name, program_id, week_number')
        .eq('user_id', user.id).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(1).maybeSingle()
      if (e1) throw e1

      if (recentWorkout?.id) {
        const { data: recentSets, error: e2 } = await supabase
          .from('sets')
          .select('exercise_name, set_number, actual_reps, target_reps, actual_weight, target_weight')
          .eq('workout_id', recentWorkout.id)
          .order('exercise_name').order('set_number')
        if (e2) throw e2
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
      if (fallbackDay) { await startPlannedWorkout(fallbackDay); return }

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
    try { await shareDNACard(profile, stats, profile?.theme_color || 'green') } catch {}
    setSharing(false)
  }

  const greeting = getGreeting()
  const firstName = typeof profile?.display_name === 'string' ? profile.display_name.split(' ')[0] : 'Athlete'
  const unit = typeof profile?.unit_preference === 'string' ? profile.unit_preference : typeof profile?.units === 'string' ? profile.units : 'kg'
  const unitName = weightLabel(unit)
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
      .filter((day) => Array.isArray(day?.exercises) && day.exercises.length > 0 && !/\brest\b|\brecovery\b|\boff\b/.test(String(day?.day_name || '').toLowerCase()))
  }, [program])

  const { readiness, label: readinessLabel, last7: weeklyDone, target: weeklyTarget } = useMemo(
    () => computeReadiness({ profile, workouts: workoutHistory }),
    [profile, workoutHistory]
  )

  if (loading) {
    return (
      <Page>
        <Skeleton height={80} style={{ marginBottom: 16 }} />
        <Skeleton height={180} style={{ borderRadius: 20, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <Skeleton height={88} />
          <Skeleton height={88} />
          <Skeleton height={88} />
        </div>
        <Skeleton height={120} />
      </Page>
    )
  }

  return (
    <Page>
      {/* Hero — greeting + avatar */}
      <Card className="v2-hero" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Avatar size="lg" className="v2-avatar--ring">
              <img src={avatarUrl} alt="" />
            </Avatar>
            {stats.streak > 0 && (
              <div style={{
                position: 'absolute', bottom: -4, right: -4,
                background: 'var(--bg-card)', border: '2px solid var(--bg)',
                borderRadius: 999, padding: '2px 6px', fontSize: 'var(--v2-fs-12)', fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 2
              }}>
                <RiFireFill size={11} style={{ color: '#ff7a00' }} />
                {stats.streak}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v2-hero__kicker">{greeting}</div>
            <div className="v2-hero__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {firstName}
              {isPro && <ProBadge size="md" tier={subscriptionTier} />}
            </div>
            <div className="v2-hero__sub" style={{ fontStyle: 'italic', marginTop: 6 }}>
              "{motivation}"
            </div>
          </div>
        </div>
      </Card>

      {showNotifPrompt && (
        <Card style={{ marginBottom: 16, borderColor: 'var(--border-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--accent)', color: 'var(--text-on-accent)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <RiHeartPulseFill size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <CardTitle>{t('dashboard_notif_title') || 'Stay consistent'}</CardTitle>
              <CardSubtitle>{t('dashboard_notif_body') || 'Get reminders for your sessions'}</CardSubtitle>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button variant="secondary" size="sm" block onClick={() => setShowNotifPrompt(false)}>Later</Button>
            <Button variant="primary" size="sm" block onClick={enableNotifications}>Enable</Button>
          </div>
        </Card>
      )}

      {/* Today's workout card */}
      {todayWorkout ? (
        <Card className="v2-card--accent" style={{ marginBottom: 16 }}>
          <CardEyebrow>{t('dashboard_today_workout') || "Today's workout"}</CardEyebrow>
          <CardTitle style={{ fontSize: 'var(--v2-fs-24)' }}>{String(todayWorkout.day_name)}</CardTitle>
          <CardSubtitle style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.length || 0} exercises · Week {todayWorkout.weekNumber}
            {Array.isArray(todayWorkout.target_muscles) && ` · ${todayWorkout.target_muscles.join(', ')}`}
          </CardSubtitle>
          <div style={{
            background: 'var(--v2-surface-1)',
            borderRadius: 'var(--v2-r-md)',
            padding: '6px 0',
            marginBottom: 16,
            border: '1px solid var(--v2-border-hair)'
          }}>
            {todayWorkout.exercises?.slice(0, 3).map((ex, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                borderTop: i > 0 ? '1px solid var(--v2-border-hair)' : 'none',
                fontSize: 'var(--v2-fs-14)'
              }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{String(ex.name)}</span>
                <span style={{
                  color: 'var(--accent)', fontWeight: 800,
                  fontFamily: 'var(--font-display)', fontSize: 'var(--v2-fs-13)',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {Number(ex.sets) || 0}×{Number(ex.reps) || 0}
                </span>
              </div>
            ))}
            {todayWorkout.exercises?.length > 3 && (
              <div style={{ padding: '8px 14px', fontSize: 'var(--v2-fs-12)', color: 'var(--text-tertiary)' }}>
                +{todayWorkout.exercises.length - 3} more
              </div>
            )}
          </div>
          <Button variant="primary" size="lg" block onClick={startWorkout} disabled={startingWorkout !== ''}>
            <RiFlashlightFill size={18} />
            {startingWorkout === 'today' ? 'Starting…' : (t('dashboard_start_workout') || 'Start workout')}
          </Button>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <CardEyebrow>Ready when you are</CardEyebrow>
          <CardTitle>Train anyway, or keep today as recovery.</CardTitle>
          <CardSubtitle style={{ marginBottom: 14 }}>
            If you feel like lifting today, REPMAX gets out of your way. Start a quick session instantly or run a planned day.
          </CardSubtitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={startQuickWorkout} disabled={startingWorkout !== ''}>
              {startingWorkout === 'quick' ? 'Starting…' : 'Train anyway'}
            </Button>
            <Button variant="secondary" onClick={() => setShowPlanPicker(true)} disabled={startingWorkout !== '' || currentWeekWorkoutDays.length === 0}>
              Run a planned day
            </Button>
            <Button variant="ghost" onClick={() => navigate('/recovery')}>
              <RiMoonClearFill size={16} /> Recovery
            </Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <StatGrid cols={3} style={{ marginBottom: 16 }}>
        <Stat label="Sessions" value={Number(stats.total) || 0} />
        <Stat label="Streak" value={`${Number(stats.streak) || 0}d`} />
        <Stat
          label={`${unitName} lifted`}
          value={Number(stats.volume) > 1000 ? `${(Number(stats.volume) / 1000).toFixed(1)}k` : (Number(stats.volume) || 0)}
        />
      </StatGrid>

      {/* Readiness ring row — visible for everyone, shows progression toward weekly target */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring size={88} thickness={8} value={readiness} color="var(--accent)">
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)' }}>
              <div style={{ fontSize: 'var(--v2-fs-18)', fontWeight: 800 }}>{readiness}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>READY</div>
            </div>
          </Ring>
          <div style={{ flex: 1 }}>
            <CardEyebrow>Readiness</CardEyebrow>
            <CardTitle style={{ fontSize: 'var(--v2-fs-18)' }}>{readinessLabel}</CardTitle>
            <CardSubtitle>
              {weeklyDone}/{weeklyTarget} sessions this week
            </CardSubtitle>
            <div style={{ marginTop: 10 }}>
              <ProgressBar value={Math.min(100, (weeklyDone / Math.max(1, weeklyTarget)) * 100)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Program progress */}
      {program && (
        <Card style={{ marginBottom: 16 }}>
          <CardEyebrow>{t('dashboard_current_program') || 'Current program'}</CardEyebrow>
          <CardTitle>{String(program.name || 'Custom Program')}</CardTitle>
          <CardSubtitle>
            Week {program.current_week || 1} of {program.total_weeks || 4} ·{' '}
            {typeof program.split_type === 'string' ? program.split_type.replace('_', '/').toUpperCase() : 'CUSTOM'}
          </CardSubtitle>
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={((program.current_week || 1) / (program.total_weeks || 4)) * 100} />
          </div>
        </Card>
      )}

      {/* PR rail */}
      {recentPRs.length > 0 && (
        <>
          <SectionHeader
            title="Recent PRs"
            eyebrow={<><RiTrophyFill size={11} /> Wall of proof</>}
            action={
              <button
                type="button"
                className="v2-section-head__action"
                onClick={() => navigate('/progress')}
              >
                View all
              </button>
            }
          />
          <div
            className="scroll-x"
            data-no-swipe
            style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              padding: '4px 2px 10px', marginBottom: 8,
              scrollSnapType: 'x mandatory'
            }}
          >
            {recentPRs.slice(0, 10).map(pr => (
              <div
                key={pr.id}
                className="v2-card v2-card--pad-sm"
                style={{
                  minWidth: 180, flexShrink: 0,
                  scrollSnapAlign: 'start',
                  background: 'linear-gradient(160deg, rgba(204,255,0,0.05), rgba(255,255,255,0)), var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'var(--accent-glow)', color: 'var(--accent)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <RiMedalFill size={14} />
                  </div>
                  <Badge variant="accent">PR</Badge>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--v2-fs-14)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(pr.exercise_name)}
                </div>
                <div style={{ fontSize: 'var(--v2-fs-12)', color: 'var(--text-secondary)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {Number(pr.weight) || 0} {unit} × {Number(pr.reps) || 0}
                </div>
                <div style={{ fontSize: 'var(--v2-fs-12)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {new Date(pr.achieved_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upgrade card for free users */}
      {!isPro && (
        <Card
          className="v2-card--interactive"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,42,133,0.06)), var(--bg-card)',
            borderColor: 'rgba(255,215,0,0.18)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/subscribe')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,215,0,0.12)', color: '#ffd700',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <RiVipCrownFill size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <CardTitle>Upgrade to PRO</CardTitle>
              <CardSubtitle>AI Coach · Custom themes · Unlimited friends</CardSubtitle>
            </div>
            <RiArrowRightLine size={20} style={{ color: '#ffd700' }} />
          </div>
        </Card>
      )}

      {/* ULTRA spotlight */}
      <Card
        className="v2-card--interactive"
        style={{
          marginBottom: 16,
          background: 'var(--v2-gradient-ultra)',
          borderColor: 'transparent',
          color: '#fff',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/ultra-lab?tab=intelligence')}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <RiSparklingFill size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--v2-fs-18)' }}>
              {isUltra ? 'ULTRA Lab is live.' : 'Preview the ULTRA Lab.'}
            </div>
            <div style={{ fontSize: 'var(--v2-fs-13)', opacity: 0.85, marginTop: 4 }}>
              {isUltra
                ? 'Intelligence, Import Studio, and Social Edge all inside your app.'
                : 'Deep analytics, routine import, and social planning layer.'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Badge style={{ background: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>Intelligence</Badge>
              <Badge style={{ background: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>Import</Badge>
              <Badge style={{ background: 'rgba(0,0,0,0.22)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>Social Edge</Badge>
            </div>
          </div>
          <RiArrowRightLine size={20} />
        </div>
      </Card>

      {/* Boost row — Communities + Run */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Card className="v2-card--interactive" onClick={() => navigate('/communities')} style={{ cursor: 'pointer' }}>
          <CardEyebrow><RiTeamFill size={11} /> Crews</CardEyebrow>
          <CardTitle style={{ fontSize: 'var(--v2-fs-16)' }}>{t('dashboard_discord_title') || 'Join the community'}</CardTitle>
          <CardSubtitle style={{ fontSize: 'var(--v2-fs-12)' }}>PR walls, challenges, streaks.</CardSubtitle>
        </Card>
        <Card className="v2-card--interactive" onClick={() => navigate('/run')} style={{ cursor: 'pointer' }}>
          <CardEyebrow><RiRunFill size={11} /> Outdoor</CardEyebrow>
          <CardTitle style={{ fontSize: 'var(--v2-fs-16)' }}>{t('dashboard_run_beta') || 'Run tracker'}</CardTitle>
          <CardSubtitle style={{ fontSize: 'var(--v2-fs-12)' }}>{t('dashboard_run_beta_desc') || 'Outdoor sessions and pace.'}</CardSubtitle>
        </Card>
      </div>

      {/* DNA share card */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar size="lg"><img src={avatarUrl} alt="" /></Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CardTitle style={{ fontSize: 'var(--v2-fs-16)' }}>{profile?.display_name || 'Athlete'}</CardTitle>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {isPro && <Badge variant={isUltra ? 'ultra' : 'accent'}>{isUltra ? 'ULTRA' : 'PRO'}</Badge>}
              <Badge>DNA Card</Badge>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleShareDNA} disabled={sharing}>
            <RiShareLine size={14} /> {sharing ? 'Sharing…' : 'Share'}
          </Button>
        </div>
        <StatGrid cols={3}>
          <Stat label="Sessions" value={Number(stats.total) || 0} />
          <Stat label="Streak" value={`${Number(stats.streak) || 0}d`} />
          <Stat label="Split" value={typeof profile?.preferred_split === 'string' ? profile.preferred_split.replace('_', '/').toUpperCase() : '—'} />
        </StatGrid>
      </Card>

      {/* Plan picker sheet */}
      <Sheet open={showPlanPicker} onClose={() => setShowPlanPicker(false)} title="Run a planned day">
        {currentWeekWorkoutDays.length > 0 ? (
          <div className="v2-stack v2-stack-2">
            {currentWeekWorkoutDays.map((day) => (
              <button
                type="button"
                key={`${day.day_name}-${day.dayIndex}`}
                className="v2-list-row"
                onClick={async () => {
                  setShowPlanPicker(false)
                  setStartingWorkout(`planned-${day.dayIndex}`)
                  try { await startPlannedWorkout(day) }
                  catch (e) { console.error(e); showDashboardToastMsg('Could not open that planned day.') }
                  finally { setStartingWorkout('') }
                }}
                style={{ border: '1px solid var(--v2-border-hair)', borderRadius: 'var(--v2-r-md)' }}
              >
                <div className="v2-list-row__icon"><RiPulseLine size={18} /></div>
                <div className="v2-list-row__body">
                  <div className="v2-list-row__title">{day.day_name || `Day ${day.dayIndex + 1}`}</div>
                  <div className="v2-list-row__subtitle">
                    {day.exercises?.length || 0} exercises
                    {Array.isArray(day.target_muscles) && day.target_muscles.length > 0 ? ` · ${day.target_muscles.join(', ')}` : ''}
                  </div>
                </div>
                <RiArrowRightLine size={18} className="v2-list-row__trailing" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No planned days yet"
            body="Set up a program and REPMAX will list your week here."
          />
        )}
      </Sheet>

      {dashboardToast && <div className="v2-toast">{dashboardToast}</div>}
    </Page>
  )
}
