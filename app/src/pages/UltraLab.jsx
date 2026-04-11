import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buildUltraAnalyticsModel } from '../lib/ultraAnalytics'
import { generateProgramFromImages, generateProgramFromText } from '../lib/groq'
import { weightLabel } from '../lib/units'
import PaywallGate from '../components/PaywallGate'
import ProBadge from '../components/ProBadge'
import {
  RiArrowLeftLine,
  RiArrowDownSLine,
  RiArrowRightLine,
  RiArrowUpSLine,
  RiCalendarCheckLine,
  RiCheckLine,
  RiClipboardLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiFileImageLine,
  RiFlashlightFill,
  RiImageAddLine,
  RiLoader4Line,
  RiResetLeftLine,
  RiSave3Line,
  RiSparklingFill,
  RiTeamLine,
  RiTextSnippet,
  RiUploadCloud2Line,
  RiBrainFill,
} from '@remixicon/react'

const TAB_OPTIONS = [
  { id: 'intelligence', label: 'Intelligence', icon: RiBrainFill },
  { id: 'import', label: 'Import Studio', icon: RiUploadCloud2Line },
  { id: 'social', label: 'Social Edge', icon: RiTeamLine },
]

const LOCKED_INTELLIGENCE_PREVIEW = [
  { title: 'Readiness Index', value: '82/100', note: 'Built from training rhythm, recovery spacing, and recent consistency.' },
  { title: 'Plateau Detector', value: 'Stable', note: 'Flags when progression is flattening before you feel it.' },
  { title: 'Next-session PR Forecast', value: '71%', note: 'Forecasts breakout sessions from readiness and recent momentum.' },
]

const LOCKED_IMPORT_STEPS = [
  'Drop routine screenshots or paste the full text plan',
  'REPMAX parses every day, every exercise, and every visible note',
  'Edit sets, reps, RPE, rest, day names, and exercise order before saving',
]

const LOCKED_SOCIAL_PREVIEW = [
  { title: 'Partner Match', value: '91%', note: 'Find the friend whose split and consistency fit yours best.' },
  { title: 'Accountability Board', value: 'Top 5', note: 'See who is actually locking in this week.' },
  { title: 'Series Planner', value: '2 Ideas', note: 'Recurring gym plans built from your current appointments.' },
]

function createEmptyExercise() {
  return {
    name: '',
    sets: 3,
    reps: 10,
    rpe: 8,
    rest_seconds: 90,
    notes: '',
  }
}

function cloneDays(days = []) {
  return (Array.isArray(days) ? days : []).map((day, dayIndex) => ({
    day_name: String(day?.day_name || `Day ${dayIndex + 1}`),
    target_muscles: Array.isArray(day?.target_muscles) ? [...day.target_muscles] : [],
    exercises: Array.isArray(day?.exercises) && day.exercises.length
      ? day.exercises.map((exercise) => ({
          name: String(exercise?.name || ''),
          sets: Number(exercise?.sets) || 3,
          reps: Number(exercise?.reps) || 10,
          rpe: Number(exercise?.rpe) || 8,
          rest_seconds: Number(exercise?.rest_seconds) || 90,
          notes: String(exercise?.notes || ''),
        }))
      : [],
  }))
}

function buildEditableProgram(program) {
  const sourceWeeks = Array.isArray(program?.weeks) && program.weeks.length
    ? program.weeks
    : [{ week_number: 1, is_deload: false, days: [] }]

  const templateDays = cloneDays(sourceWeeks[0]?.days || [])
  const weeks = Array.from({ length: Math.max(4, sourceWeeks.length) }, (_, index) => ({
    week_number: index + 1,
    is_deload: Boolean(sourceWeeks[index]?.is_deload || index === 3),
    days: cloneDays(sourceWeeks[index]?.days?.length ? sourceWeeks[index].days : templateDays),
  })).slice(0, 4)

  return {
    name: String(program?.name || 'Imported Routine'),
    split_type: String(program?.split_type || 'custom'),
    weeks,
  }
}

function mirrorTemplateAcrossWeeks(program, templateDays) {
  return {
    ...program,
    weeks: (program?.weeks || []).map((week, index) => ({
      ...week,
      week_number: index + 1,
      is_deload: Boolean(week?.is_deload || index === 3),
      days: cloneDays(templateDays),
    })),
  }
}

function summarizeProgram(program) {
  const days = program?.weeks?.[0]?.days || []
  const activeDays = days.filter((day) => day.exercises?.length > 0)
  const exerciseCount = activeDays.reduce((total, day) => total + day.exercises.length, 0)

  return {
    name: program?.name || 'No routine',
    split: String(program?.split_type || 'custom').replace(/_/g, ' '),
    dayCount: days.length,
    activeDays: activeDays.length,
    exerciseCount,
  }
}

function isRestDay(day) {
  return day?.exercises?.length === 0 || /\brest\b|\brecovery\b|\boff\b/i.test(String(day?.day_name || ''))
}

function createEmptyDay(dayIndex) {
  return {
    day_name: `Day ${dayIndex + 1}`,
    target_muscles: [],
    exercises: [createEmptyExercise()],
  }
}

function moveItem(list, fromIndex, direction) {
  const nextIndex = fromIndex + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list

  const clone = [...list]
  const [item] = clone.splice(fromIndex, 1)
  clone.splice(nextIndex, 0, item)
  return clone
}

function countTrainingDays(trainingDays = []) {
  return Array.isArray(trainingDays) ? trainingDays.length : 0
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getProfileMatchScore(profile, friend) {
  const sameGoal = profile?.goal && friend?.goal && profile.goal === friend.goal ? 24 : 8
  const sameSplit = profile?.preferred_split && friend?.preferred_split && profile.preferred_split === friend.preferred_split ? 24 : 10
  const dayGap = Math.abs(countTrainingDays(profile?.training_days) - countTrainingDays(friend?.training_days))
  const dayScore = Math.max(6, 20 - dayGap * 4)
  const streakGap = Math.abs((profile?.current_streak || 0) - (friend?.current_streak || 0))
  const streakScore = Math.max(6, 16 - streakGap * 2)
  const trainingBase = Math.min(16, Math.round((Number(friend?.total_workouts) || 0) / 12))

  return clamp(Math.round(sameGoal + sameSplit + dayScore + streakScore + trainingBase), 28, 98)
}

function getCounterpartForAppointment(appointment, userId) {
  return appointment?.creator_id === userId ? appointment?.guest : appointment?.creator
}

function buildSocialEdgeModel({ profile, friends = [], appointments = [], userId }) {
  const compatibility = friends
    .map((friend) => ({
      ...friend,
      score: getProfileMatchScore(profile, friend),
    }))
    .sort((a, b) => b.score - a.score)

  const accountabilityBoard = [...friends]
    .sort((a, b) => {
      const streakDiff = (Number(b?.current_streak) || 0) - (Number(a?.current_streak) || 0)
      if (streakDiff !== 0) return streakDiff
      return (Number(b?.total_workouts) || 0) - (Number(a?.total_workouts) || 0)
    })
    .slice(0, 5)

  const upcomingAppointments = appointments
    .filter((appointment) => appointment?.scheduled_at && new Date(appointment.scheduled_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const recurringSeries = Object.values(upcomingAppointments.reduce((acc, appointment) => {
    const counterpart = getCounterpartForAppointment(appointment, userId)
    const counterpartId = counterpart?.id || 'unknown'
    const key = `${counterpartId}:${appointment.gym_name || 'gym'}`
    if (!acc[key]) {
      acc[key] = {
        counterpart,
        gym_name: appointment.gym_name,
        count: 0,
        nextDate: appointment.scheduled_at,
      }
    }

    acc[key].count += 1
    if (new Date(appointment.scheduled_at).getTime() < new Date(acc[key].nextDate).getTime()) {
      acc[key].nextDate = appointment.scheduled_at
    }

    return acc
  }, {}))
    .filter((series) => series.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const alreadyScheduledIds = new Set(upcomingAppointments.map((appointment) => getCounterpartForAppointment(appointment, userId)?.id).filter(Boolean))

  const nudges = compatibility
    .filter((friend) => !alreadyScheduledIds.has(friend.id))
    .sort((a, b) => {
      const aSignal = (Number(a?.current_streak) || 0) <= 2 ? 1 : 0
      const bSignal = (Number(b?.current_streak) || 0) <= 2 ? 1 : 0
      if (bSignal !== aSignal) return bSignal - aSignal
      return a.score - b.score
    })
    .slice(0, 3)

  const planner = compatibility
    .filter((friend) => !alreadyScheduledIds.has(friend.id))
    .slice(0, 3)
    .map((friend) => ({
      ...friend,
      planLabel: friend.score >= 86
        ? 'Same split, same pace'
        : friend.score >= 72
          ? 'Strong overlap for a weekly lock-in'
          : 'Good social accountability fit',
    }))

  return {
    compatibility,
    accountabilityBoard,
    recurringSeries,
    nudges,
    planner,
  }
}

function formatDateTime(value) {
  if (!value) return 'No date'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function validateProgram(program) {
  const templateDays = program?.weeks?.[0]?.days || []
  const trainingDays = templateDays.filter((day) => day.exercises?.length > 0)

  if (!trainingDays.length) {
    return 'Add at least one training day before saving the routine.'
  }

  for (const day of templateDays) {
    if (!day.day_name?.trim()) {
      return 'Every imported day needs a name.'
    }

    for (const exercise of day.exercises || []) {
      if (!exercise.name?.trim()) {
        return `Finish the exercise names in ${day.day_name}.`
      }
    }
  }

  return null
}

function getConfidenceClass(confidence) {
  if (confidence?.tone === 'high') return 'high'
  if (confidence?.tone === 'mid') return 'mid'
  return 'low'
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UltraLab() {
  const { user, profile, isUltra, subscriptionTier } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [activeProgram, setActiveProgram] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [recentPRs, setRecentPRs] = useState([])
  const [recentSets, setRecentSets] = useState([])
  const [friends, setFriends] = useState([])
  const [appointments, setAppointments] = useState([])
  const [importMode, setImportMode] = useState('images')
  const [imageFiles, setImageFiles] = useState([])
  const [routineText, setRoutineText] = useState('')
  const [parsedProgram, setParsedProgram] = useState(null)
  const [parsedSource, setParsedSource] = useState(null)
  const [processingImport, setProcessingImport] = useState(false)
  const [savingImport, setSavingImport] = useState(false)
  const [lastExtractedText, setLastExtractedText] = useState('')

  const activeTab = TAB_OPTIONS.some((tab) => tab.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'intelligence'

  const unit = profile?.unit_preference || profile?.units || 'kg'

  function showToast(message) {
    setToast(message)
    window.clearTimeout(window.__repmaxUltraToastTimer)
    window.__repmaxUltraToastTimer = window.setTimeout(() => setToast(''), 3000)
  }

  const loadUltraLab = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    try {
      const [programRes, workoutsRes, prsRes, friendsRes] = await Promise.all([
        supabase
          .from('programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('workouts')
          .select('id, day_name, started_at, completed_at, total_volume, duration_seconds')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(60),
        supabase
          .from('personal_records')
          .select('id, exercise_name, weight, reps, estimated_1rm, achieved_at')
          .eq('user_id', user.id)
          .order('achieved_at', { ascending: false })
          .limit(30),
        supabase
          .from('friendships')
          .select(`
            id,
            user_id,
            friend_id,
            status,
            friend:friend_id(id, display_name, username, goal, preferred_split, training_days, current_streak, total_workouts, subscription_tier, avatar_seed, image_url),
            requester:user_id(id, display_name, username, goal, preferred_split, training_days, current_streak, total_workouts, subscription_tier, avatar_seed, image_url)
          `)
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted'),
      ])

      const workoutRows = workoutsRes.data || []
      const workoutIds = workoutRows.map((workout) => workout.id).filter(Boolean)

      const setsRes = workoutIds.length
        ? await supabase
            .from('sets')
            .select('workout_id, exercise_name, actual_weight, target_weight, actual_reps, target_reps, completed')
            .in('workout_id', workoutIds)
        : { data: [] }

      let appointmentsRows = []
      try {
        const appointmentsRes = await supabase
          .from('gym_appointments')
          .select('id, creator_id, guest_id, gym_name, scheduled_at, status, guest:guest_id(id, display_name, avatar_seed, image_url), creator:creator_id(id, display_name, avatar_seed, image_url)')
          .or(`creator_id.eq.${user.id},guest_id.eq.${user.id}`)
          .in('status', ['pending', 'accepted'])
          .order('scheduled_at', { ascending: true })
        appointmentsRows = appointmentsRes.data || []
      } catch {
        appointmentsRows = []
      }

      const mappedFriends = (friendsRes.data || [])
        .map((row) => (row.user_id === user.id ? row.friend : row.requester))
        .filter(Boolean)

      setActiveProgram(programRes.data || null)
      setWorkouts(workoutRows)
      setRecentPRs(prsRes.data || [])
      setRecentSets((setsRes.data || []).map((set) => ({
        ...set,
        actual_weight: set.actual_weight ?? set.target_weight ?? 0,
        actual_reps: set.actual_reps ?? set.target_reps ?? 0,
      })))
      setFriends(mappedFriends)
      setAppointments(appointmentsRows)
    } catch (error) {
      console.error('ULTRA Lab load error:', error)
      showToast('Could not load ULTRA Lab yet')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadUltraLab()
  }, [loadUltraLab])

  useEffect(() => {
    if (!TAB_OPTIONS.some((tab) => tab.id === searchParams.get('tab'))) {
      setSearchParams({ tab: 'intelligence' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const analyticsModel = useMemo(() => buildUltraAnalyticsModel({
    profile,
    activeProgram,
    workouts,
    prs: recentPRs,
    sets: recentSets,
    unit,
  }), [profile, activeProgram, workouts, recentPRs, recentSets, unit])

  const socialEdge = useMemo(() => buildSocialEdgeModel({
    profile,
    friends,
    appointments,
    userId: user?.id,
  }), [profile, friends, appointments, user?.id])

  const currentSummary = useMemo(() => summarizeProgram(activeProgram?.program_data ? {
    ...activeProgram,
    weeks: activeProgram.program_data.weeks,
  } : null), [activeProgram])

  const importedSummary = useMemo(() => summarizeProgram(parsedProgram), [parsedProgram])

  function openTab(tab) {
    setSearchParams({ tab })
  }

  async function handleImageFilesChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setImageFiles(files)
  }

  async function runImageImport() {
    if (!imageFiles.length) {
      showToast('Choose one or more routine screenshots first.')
      return
    }

    setProcessingImport(true)
    try {
      const base64Images = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)))
      const result = await generateProgramFromImages(base64Images)

      if (!result?.success || !result.program) {
        throw new Error(result?.error?.message || 'Image import failed')
      }

      setParsedProgram(buildEditableProgram(result.program))
      setParsedSource('images')
      setLastExtractedText(result.extractedText || '')
      showToast('Routine parsed. Review it before saving.')
    } catch (error) {
      console.error('Image import failed:', error)
      showToast('Could not parse that routine yet.')
    } finally {
      setProcessingImport(false)
    }
  }

  async function runTextImport() {
    if (!routineText.trim()) {
      showToast('Paste the routine text first.')
      return
    }

    setProcessingImport(true)
    try {
      const result = await generateProgramFromText(routineText)
      if (!result?.success || !result.program) {
        throw new Error(result?.error?.message || 'Text import failed')
      }

      setParsedProgram(buildEditableProgram(result.program))
      setParsedSource('text')
      setLastExtractedText(routineText)
      showToast('Routine parsed. Review it before saving.')
    } catch (error) {
      console.error('Text import failed:', error)
      showToast('Could not turn that text into a routine yet.')
    } finally {
      setProcessingImport(false)
    }
  }

  function updateTemplateDays(updater) {
    setParsedProgram((current) => {
      if (!current?.weeks?.length) return current

      const templateDays = cloneDays(current.weeks[0].days || [])
      const nextDays = updater(templateDays)
      return mirrorTemplateAcrossWeeks(current, nextDays)
    })
  }

  function updateDay(dayIndex, updater) {
    updateTemplateDays((days) => days.map((day, index) => (
      index === dayIndex ? updater({ ...day, exercises: cloneDays([day])[0].exercises }) : day
    )))
  }

  function addImportedDay() {
    updateTemplateDays((days) => [...days, createEmptyDay(days.length)])
  }

  function removeImportedDay(dayIndex) {
    updateTemplateDays((days) => days.filter((_, index) => index !== dayIndex))
  }

  function renameDay(dayIndex, value) {
    updateDay(dayIndex, (day) => ({ ...day, day_name: value }))
  }

  function toggleRestDay(dayIndex) {
    updateDay(dayIndex, (day) => {
      if (isRestDay(day)) {
        return {
          ...day,
          day_name: /^rest/i.test(day.day_name) ? `Day ${dayIndex + 1}` : day.day_name,
          exercises: day.exercises?.length ? day.exercises : [createEmptyExercise()],
        }
      }

      return {
        ...day,
        day_name: 'Rest Day',
        exercises: [],
      }
    })
  }

  function updateExercise(dayIndex, exerciseIndex, field, value) {
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: (day.exercises || []).map((exercise, index) => {
        if (index !== exerciseIndex) return exercise

        if (field === 'name' || field === 'notes') {
          return { ...exercise, [field]: value }
        }

        const numeric = Number(value)
        return { ...exercise, [field]: Number.isFinite(numeric) ? numeric : exercise[field] }
      }),
    }))
  }

  function addExercise(dayIndex) {
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: [...(day.exercises || []), createEmptyExercise()],
    }))
  }

  function removeExercise(dayIndex, exerciseIndex) {
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: (day.exercises || []).filter((_, index) => index !== exerciseIndex),
    }))
  }

  function moveExercise(dayIndex, exerciseIndex, direction) {
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: moveItem(day.exercises || [], exerciseIndex, direction),
    }))
  }

  function resetImportEditor() {
    setParsedProgram(null)
    setParsedSource(null)
    setLastExtractedText('')
    setImageFiles([])
    setRoutineText('')
  }

  async function saveImportedProgram() {
    if (!parsedProgram || !user?.id) return

    const validationError = validateProgram(parsedProgram)
    if (validationError) {
      showToast(validationError)
      return
    }

    setSavingImport(true)

    try {
      const nextProgram = buildEditableProgram(parsedProgram)
      const insertPayload = {
        user_id: user.id,
        name: nextProgram.name || 'Imported Routine',
        split_type: nextProgram.split_type || 'custom',
        total_weeks: nextProgram.weeks?.length || 4,
        current_week: 1,
        program_data: nextProgram,
        active: false,
      }

      const { data: insertedProgram, error: insertError } = await supabase
        .from('programs')
        .insert(insertPayload)
        .select('*')
        .single()

      if (insertError) throw insertError

      const { error: deactivateError } = await supabase
        .from('programs')
        .update({ active: false })
        .eq('user_id', user.id)
        .eq('active', true)
        .neq('id', insertedProgram.id)

      if (deactivateError) throw deactivateError

      const { data: activatedProgram, error: activateError } = await supabase
        .from('programs')
        .update({ active: true })
        .eq('id', insertedProgram.id)
        .eq('user_id', user.id)
        .select('*')
        .single()

      if (activateError) throw activateError

      setActiveProgram(activatedProgram)
      setParsedProgram(null)
      setParsedSource(null)
      showToast('Imported routine saved to your active plan.')
      openTab('intelligence')
    } catch (error) {
      console.error('Saving imported program failed:', error)
      showToast('Could not save the imported routine yet.')
    } finally {
      setSavingImport(false)
    }
  }

  const intelligencePreview = (
    <div className="ultra-preview-grid">
      <section className="ultra-hero-card ultra-hero-card-preview">
        <div className="ultra-hero-kicker">ULTRA LAB</div>
        <h2 className="ultra-hero-title">AI coaching becomes visible here.</h2>
        <p className="ultra-hero-copy">
          Intelligence turns your workouts, recovery spacing, and plan adherence into clear next moves instead of noisy numbers.
        </p>
      </section>
      <div className="ultra-metric-grid">
        {LOCKED_INTELLIGENCE_PREVIEW.map((metric) => (
          <article key={metric.title} className="ultra-metric-card preview">
            <div className="ultra-metric-title">{metric.title}</div>
            <div className="ultra-metric-value">{metric.value}</div>
            <p className="ultra-metric-note">{metric.note}</p>
          </article>
        ))}
      </div>
    </div>
  )

  const importPreview = (
    <div className="ultra-preview-grid">
      <section className="ultra-hero-card ultra-hero-card-preview">
        <div className="ultra-hero-kicker">IMPORT STUDIO</div>
        <h2 className="ultra-hero-title">Bring outside routines into REPMAX properly.</h2>
        <p className="ultra-hero-copy">
          ULTRA gives you the full parse, compare, edit, and apply flow instead of throwing the routine into onboarding and hoping it sticks.
        </p>
      </section>
      <div className="ultra-preview-list">
        {LOCKED_IMPORT_STEPS.map((step) => (
          <div key={step} className="ultra-preview-row">
            <span className="ultra-preview-bullet"><RiCheckLine size={14} /></span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const socialPreview = (
    <div className="ultra-preview-grid">
      <section className="ultra-hero-card ultra-hero-card-preview">
        <div className="ultra-hero-kicker">SOCIAL EDGE</div>
        <h2 className="ultra-hero-title">See who helps you lock in, not just who is online.</h2>
        <p className="ultra-hero-copy">
          ULTRA scores compatibility, recurring training series, and who needs a nudge so the social layer becomes useful instead of decorative.
        </p>
      </section>
      <div className="ultra-metric-grid">
        {LOCKED_SOCIAL_PREVIEW.map((card) => (
          <article key={card.title} className="ultra-metric-card preview">
            <div className="ultra-metric-title">{card.title}</div>
            <div className="ultra-metric-value">{card.value}</div>
            <p className="ultra-metric-note">{card.note}</p>
          </article>
        ))}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <RiArrowLeftLine size={20} /> Back
        </button>
        <div className="page-header">
          <h1 className="page-title">ULTRA <span className="accent">Lab</span></h1>
        </div>
        <div className="skeleton" style={{ height: 180, borderRadius: 22, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 240, borderRadius: 22 }} />
      </div>
    )
  }

  return (
    <div className="page ultra-lab-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={20} /> Back
      </button>

      <div className="page-header ultra-lab-header">
        <div>
          <div className="ultra-lab-kicker">REPMAX ULTRA</div>
          <h1 className="page-title">ULTRA <span className="accent">Lab</span></h1>
          <p className="ultra-lab-subtitle">
            Intelligence, Import Studio, and Social Edge now live in one place so the main app can stay sharp.
          </p>
        </div>
        {subscriptionTier !== 'free' && <ProBadge size="md" tier={subscriptionTier} />}
      </div>

      <section className="ultra-entry-card">
        <div className="ultra-entry-copy">
          <div className="ultra-entry-kicker">Performance luxury</div>
          <div className="ultra-entry-title">
            {isUltra ? 'You have the full ULTRA stack unlocked.' : 'You are previewing the ULTRA stack.'}
          </div>
          <p className="ultra-entry-body">
            {isUltra
              ? `Your analytics are tuned to ${weightLabel(unit)}, your import flow stays server-side, and your social layer prioritizes accountability over noise.`
              : 'The tabs below stay visible so you can see what ULTRA adds before you upgrade. Nothing breaks or disappears anymore.'}
          </p>
        </div>
        {!isUltra && (
          <button className="btn btn-primary" onClick={() => navigate('/subscribe')}>
            <RiSparklingFill size={18} />
            Unlock ULTRA
          </button>
        )}
      </section>

      <div className="ultra-tab-bar">
        {TAB_OPTIONS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`ultra-tab-btn ${active ? 'active' : ''}`}
              onClick={() => openTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'intelligence' && (
        isUltra ? (
          <div className="ultra-page-stack">
            <section className="ultra-hero-card">
              <div className="ultra-hero-kicker">INTELLIGENCE</div>
              <h2 className="ultra-hero-title">{analyticsModel.hero.title}</h2>
              <p className="ultra-hero-copy">{analyticsModel.hero.body}</p>
              <div className="ultra-hero-footer">
                <span className={`ultra-confidence-pill ${getConfidenceClass(analyticsModel.hero.confidence)}`}>
                  {analyticsModel.hero.confidence.label}
                </span>
                <span className="ultra-hero-action">{analyticsModel.hero.action}</span>
              </div>
            </section>

            <div className="ultra-metric-grid">
              {analyticsModel.metrics.map((metric) => (
                <article key={metric.id} className={`ultra-metric-card accent-${metric.accent}`}>
                  <div className="ultra-metric-top">
                    <div className="ultra-metric-title">{metric.title}</div>
                    <span className={`ultra-confidence-pill ${getConfidenceClass(metric.confidence)}`}>
                      {metric.confidence.label}
                    </span>
                  </div>
                  <div className="ultra-metric-value">{metric.value}</div>
                  <p className="ultra-metric-note">{metric.note}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <PaywallGate
            feature="ULTRA Intelligence"
            requiredTier="ultra"
            description="Upgrade to ULTRA for the full readiness model, plateau detection, exercise ROI, and session forecasting."
          >
            {intelligencePreview}
          </PaywallGate>
        )
      )}

      {activeTab === 'import' && (
        isUltra ? (
          <div className="ultra-page-stack">
            <section className="ultra-hero-card">
              <div className="ultra-hero-kicker">IMPORT STUDIO</div>
              <h2 className="ultra-hero-title">Bring outside routines into REPMAX without losing the details.</h2>
              <p className="ultra-hero-copy">
                Upload screenshots or paste the full routine text. REPMAX parses it through the server-side AI proxy, then lets you clean it up before it touches your active plan.
              </p>
              <div className="ultra-hero-footer">
                <span className="ultra-hero-action">Edits mirror across all 4 weeks by default so the imported plan stays clean.</span>
              </div>
            </section>

            <section className="ultra-import-shell">
              <div className="ultra-import-mode-row">
                <button
                  type="button"
                  className={`ultra-import-mode ${importMode === 'images' ? 'active' : ''}`}
                  onClick={() => setImportMode('images')}
                >
                  <RiFileImageLine size={17} />
                  Screenshots
                </button>
                <button
                  type="button"
                  className={`ultra-import-mode ${importMode === 'text' ? 'active' : ''}`}
                  onClick={() => setImportMode('text')}
                >
                  <RiTextSnippet size={17} />
                  Paste text
                </button>
              </div>

              {importMode === 'images' ? (
                <div className="ultra-import-panel">
                  <label className="ultra-upload-dropzone">
                    <input type="file" accept="image/*" multiple onChange={handleImageFilesChange} />
                    <RiImageAddLine size={20} />
                    <div className="ultra-upload-title">Drop routine screenshots here</div>
                    <div className="ultra-upload-copy">PNG, JPG, HEIC. Upload multiple images if the routine spans several pages.</div>
                  </label>

                  {imageFiles.length > 0 && (
                    <div className="ultra-file-list">
                      {imageFiles.map((file) => (
                        <div key={`${file.name}-${file.size}`} className="ultra-file-pill">
                          <RiFileImageLine size={14} />
                          <span>{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="btn btn-primary" onClick={runImageImport} disabled={processingImport}>
                    {processingImport ? <RiLoader4Line size={18} className="spin" /> : <RiSparklingFill size={18} />}
                    Parse screenshots
                  </button>
                </div>
              ) : (
                <div className="ultra-import-panel">
                  <textarea
                    className="input ultra-routine-textarea"
                    value={routineText}
                    onChange={(event) => setRoutineText(event.target.value)}
                    placeholder={`Day 1 - Push\n- Bench Press — 4 x 8\n- Incline Dumbbell Press — 3 x 10\n\nDay 2 - Pull\n- Barbell Row — 4 x 8`}
                  />
                  <button className="btn btn-primary" onClick={runTextImport} disabled={processingImport}>
                    {processingImport ? <RiLoader4Line size={18} className="spin" /> : <RiClipboardLine size={18} />}
                    Parse routine text
                  </button>
                </div>
              )}
            </section>

            {parsedProgram && (
              <>
                <section className="ultra-compare-grid">
                  <article className="ultra-compare-card">
                    <div className="ultra-compare-kicker">Current active plan</div>
                    <div className="ultra-compare-title">{currentSummary.name}</div>
                    <div className="ultra-compare-meta">{currentSummary.activeDays} training days · {currentSummary.exerciseCount} exercises</div>
                    <div className="ultra-compare-detail">{currentSummary.split}</div>
                  </article>
                  <article className="ultra-compare-card imported">
                    <div className="ultra-compare-kicker">Imported preview</div>
                    <div className="ultra-compare-title">{importedSummary.name}</div>
                    <div className="ultra-compare-meta">{importedSummary.activeDays} training days · {importedSummary.exerciseCount} exercises</div>
                    <div className="ultra-compare-detail">{importedSummary.split}</div>
                  </article>
                </section>

                {lastExtractedText && (
                  <section className="ultra-source-card">
                    <div className="ultra-source-kicker">Parsed source</div>
                    <div className="ultra-source-copy">{parsedSource === 'images' ? 'This is the text the AI saw before it built the routine.' : 'This is the text version you imported.'}</div>
                    <pre className="ultra-source-text">{lastExtractedText}</pre>
                  </section>
                )}

                <section className="ultra-editor-shell">
                  <div className="ultra-editor-header">
                    <div>
                      <div className="ultra-editor-kicker">Manual edit</div>
                      <div className="ultra-editor-title">Review every day before it becomes active.</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={resetImportEditor}>
                      <RiResetLeftLine size={16} />
                      Reset
                    </button>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Routine name</label>
                    <input
                      className="input"
                      value={parsedProgram.name}
                      onChange={(event) => setParsedProgram((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div className="ultra-editor-days">
                    {(parsedProgram.weeks?.[0]?.days || []).map((day, dayIndex) => (
                      <article key={`${day.day_name}-${dayIndex}`} className="ultra-day-card">
                        <div className="ultra-day-header">
                          <div className="ultra-day-main">
                            <input
                              className="input ultra-day-name"
                              value={day.day_name}
                              onChange={(event) => renameDay(dayIndex, event.target.value)}
                            />
                            <span className={`ultra-day-state ${isRestDay(day) ? 'rest' : 'live'}`}>
                              {isRestDay(day) ? 'Rest day' : `${day.exercises.length} exercises`}
                            </span>
                          </div>
                          <div className="ultra-day-actions">
                            <button type="button" className="icon-btn" onClick={() => toggleRestDay(dayIndex)} title="Toggle rest day">
                              <RiCalendarCheckLine size={16} />
                            </button>
                            <button type="button" className="icon-btn" onClick={() => removeImportedDay(dayIndex)} title="Remove day">
                              <RiDeleteBin6Line size={16} />
                            </button>
                          </div>
                        </div>

                        {!isRestDay(day) && (
                          <>
                            <div className="ultra-exercise-list">
                              {day.exercises.map((exercise, exerciseIndex) => (
                                <div key={`${exerciseIndex}-${exercise.name}`} className="ultra-exercise-card">
                                  <div className="ultra-exercise-toolbar">
                                    <input
                                      className="input ultra-exercise-name"
                                      value={exercise.name}
                                      onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'name', event.target.value)}
                                      placeholder="Exercise name"
                                    />
                                    <div className="ultra-exercise-actions">
                                      <button type="button" className="icon-btn" onClick={() => moveExercise(dayIndex, exerciseIndex, -1)} title="Move up">
                                        <RiArrowUpSLine size={16} />
                                      </button>
                                      <button type="button" className="icon-btn" onClick={() => moveExercise(dayIndex, exerciseIndex, 1)} title="Move down">
                                        <RiArrowDownSLine size={16} />
                                      </button>
                                      <button type="button" className="icon-btn" onClick={() => removeExercise(dayIndex, exerciseIndex)} title="Remove exercise">
                                        <RiCloseLine size={16} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="ultra-exercise-grid">
                                    <label className="ultra-micro-field">
                                      <span>Sets</span>
                                      <input className="input" type="number" min="1" value={exercise.sets} onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'sets', event.target.value)} />
                                    </label>
                                    <label className="ultra-micro-field">
                                      <span>Reps</span>
                                      <input className="input" type="number" min="1" value={exercise.reps} onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'reps', event.target.value)} />
                                    </label>
                                    <label className="ultra-micro-field">
                                      <span>RPE</span>
                                      <input className="input" type="number" min="1" max="10" step="0.5" value={exercise.rpe} onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'rpe', event.target.value)} />
                                    </label>
                                    <label className="ultra-micro-field">
                                      <span>Rest</span>
                                      <input className="input" type="number" min="0" step="15" value={exercise.rest_seconds} onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'rest_seconds', event.target.value)} />
                                    </label>
                                  </div>

                                  <textarea
                                    className="input ultra-exercise-notes"
                                    value={exercise.notes}
                                    onChange={(event) => updateExercise(dayIndex, exerciseIndex, 'notes', event.target.value)}
                                    placeholder="Notes, tempo, or cues"
                                  />
                                </div>
                              ))}
                            </div>

                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addExercise(dayIndex)}>
                              <RiCheckLine size={16} />
                              Add exercise
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                  </div>

                  <button type="button" className="btn btn-secondary btn-sm" onClick={addImportedDay}>
                    <RiArrowRightLine size={16} />
                    Add day
                  </button>

                  <div className="ultra-save-row">
                    <div className="ultra-save-copy">
                      Saving this routine archives the previous active plan by setting it inactive and makes this one your live program.
                    </div>
                    <button className="btn btn-primary" onClick={saveImportedProgram} disabled={savingImport}>
                      {savingImport ? <RiLoader4Line size={18} className="spin" /> : <RiSave3Line size={18} />}
                      Save as active routine
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        ) : (
          <PaywallGate
            feature="Import Studio"
            requiredTier="ultra"
            title="Unlock Import Studio"
            description="Upgrade to ULTRA to upload custom routines, edit every day before saving, and replace your active plan cleanly."
          >
            {importPreview}
          </PaywallGate>
        )
      )}

      {activeTab === 'social' && (
        isUltra ? (
          <div className="ultra-page-stack">
            <section className="ultra-hero-card">
              <div className="ultra-hero-kicker">SOCIAL EDGE</div>
              <h2 className="ultra-hero-title">Use the social layer like a training system.</h2>
              <p className="ultra-hero-copy">
                Compatibility, accountability, and session planning live here so your social graph actually helps you train.
              </p>
              <div className="ultra-hero-footer">
                <span className="ultra-hero-action">{friends.length ? `${friends.length} active friend signals loaded` : 'Connect more training partners to unlock better suggestions.'}</span>
              </div>
            </section>

            <section className="ultra-social-grid">
              <article className="ultra-social-card">
                <div className="ultra-social-title">Best training partner fits</div>
                {socialEdge.compatibility.length ? (
                  socialEdge.compatibility.slice(0, 3).map((friend) => (
                    <div key={friend.id} className="ultra-social-row">
                      <div>
                        <div className="ultra-social-name">{friend.display_name || friend.username || 'Friend'}</div>
                        <div className="ultra-social-copy">{friend.goal || 'Goal not set'} · {friend.preferred_split?.replace(/_/g, ' ') || 'Flexible split'}</div>
                      </div>
                      <div className="ultra-social-score">{friend.score}%</div>
                    </div>
                  ))
                ) : (
                  <p className="ultra-empty-copy">Add a few friends to surface compatibility matches.</p>
                )}
              </article>

              <article className="ultra-social-card">
                <div className="ultra-social-title">Accountability board</div>
                {socialEdge.accountabilityBoard.length ? (
                  socialEdge.accountabilityBoard.map((friend, index) => (
                    <div key={friend.id} className="ultra-social-row">
                      <div>
                        <div className="ultra-social-name">#{index + 1} {friend.display_name || friend.username || 'Friend'}</div>
                        <div className="ultra-social-copy">{friend.total_workouts || 0} total workouts</div>
                      </div>
                      <div className="ultra-social-score">{friend.current_streak || 0}d</div>
                    </div>
                  ))
                ) : (
                  <p className="ultra-empty-copy">No board yet. Friends start appearing here once you connect.</p>
                )}
              </article>

              <article className="ultra-social-card">
                <div className="ultra-social-title">Lock-in series summary</div>
                {socialEdge.recurringSeries.length ? (
                  socialEdge.recurringSeries.map((series) => (
                    <div key={`${series.counterpart?.id}-${series.gym_name}`} className="ultra-social-row">
                      <div>
                        <div className="ultra-social-name">{series.counterpart?.display_name || 'Training partner'}</div>
                        <div className="ultra-social-copy">{series.gym_name || 'Gym'} · next {formatDateTime(series.nextDate)}</div>
                      </div>
                      <div className="ultra-social-score">{series.count}x</div>
                    </div>
                  ))
                ) : (
                  <p className="ultra-empty-copy">Recurring appointment series will show up here once you lock in more than one session with the same person.</p>
                )}
              </article>

              <article className="ultra-social-card">
                <div className="ultra-social-title">Who needs a push this week</div>
                {socialEdge.nudges.length ? (
                  socialEdge.nudges.map((friend) => (
                    <div key={friend.id} className="ultra-social-row">
                      <div>
                        <div className="ultra-social-name">{friend.display_name || friend.username || 'Friend'}</div>
                        <div className="ultra-social-copy">{friend.current_streak || 0} day streak · no upcoming lock-in yet</div>
                      </div>
                      <div className="ultra-social-score"><RiFlashlightFill size={16} /></div>
                    </div>
                  ))
                ) : (
                  <p className="ultra-empty-copy">Your crew is already booked or streaking. Nice.</p>
                )}
              </article>

              <article className="ultra-social-card">
                <div className="ultra-social-title">Session planner</div>
                {socialEdge.planner.length ? (
                  socialEdge.planner.map((friend) => (
                    <div key={friend.id} className="ultra-social-row">
                      <div>
                        <div className="ultra-social-name">{friend.display_name || friend.username || 'Friend'}</div>
                        <div className="ultra-social-copy">{friend.planLabel}</div>
                      </div>
                      <div className="ultra-social-score">{friend.score}%</div>
                    </div>
                  ))
                ) : (
                  <p className="ultra-empty-copy">No new pairing ideas yet. Add more friends or clear more appointment history.</p>
                )}
              </article>
            </section>
          </div>
        ) : (
          <PaywallGate
            feature="Social Edge"
            requiredTier="ultra"
            description="Upgrade to ULTRA for training-partner scoring, accountability boards, recurring series summaries, and session planner suggestions."
          >
            {socialPreview}
          </PaywallGate>
        )
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
