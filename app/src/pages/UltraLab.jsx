import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buildUltraAnalyticsModel } from '../lib/ultraAnalytics'
import { generateProgramFromImages, generateProgramFromText, normalizeImportedRoutineText } from '../lib/groq'
import { weightLabel } from '../lib/units'
import PaywallGate from '../components/PaywallGate'
import ProBadge from '../components/ProBadge'
import './ultra-lab.css'
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
  { id: 'overview', label: 'Overview', icon: RiSparklingFill },
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

function inferTargetMuscles(label = '') {
  const normalized = label.toLowerCase()
  if (/rest|off|recovery/.test(normalized)) return []
  if (/push|chest|tricep|shoulder/.test(normalized)) return ['chest', 'shoulders', 'triceps']
  if (/pull|back|bicep/.test(normalized)) return ['back', 'biceps', 'rear delts']
  if (/leg|lower|quad|hamstring|glute|calf/.test(normalized)) return ['quads', 'hamstrings', 'glutes', 'calves']
  if (/core|abs/.test(normalized)) return ['core']
  if (/upper/.test(normalized)) return ['chest', 'back', 'shoulders', 'arms']
  if (/full/.test(normalized)) return ['full body']
  return []
}

function looksLikeDayHeading(line = '') {
  const value = line.trim()
  if (!value) return false
  if (/^(week|notes?|tempo|rest\s+\d)/i.test(value)) return false
  if (/^(day\s*\d+|day\s*[a-z]+)/i.test(value)) return true
  if (/^(push|pull|legs|leg day|upper|lower|full body|rest|recovery|off day|cardio|arms|chest|back|shoulders)/i.test(value)) return true
  return /:$/.test(value) && value.length <= 36
}

function mergeBrokenLines(lines = []) {
  const merged = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const shouldAttach = merged.length
      && !looksLikeDayHeading(line)
      && !/^\d+\s*[xX]/.test(line)
      && line.length <= 18
      && !/\b(rest|off|recovery)\b/i.test(line)

    if (shouldAttach) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.replace(/\s+/g, ' ').trim()
      continue
    }

    merged.push(line)
  }

  return merged
}

function parseExerciseLine(line = '') {
  const cleaned = line
    .replace(/^[\-\*\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const match = cleaned.match(/(.+?)(?:\s*[—-]\s*|\s+)(\d+)\s*[xX]\s*(\d+)(?:\s*@?\s*RPE\s*([0-9.]+))?(?:.*?(\d{2,3})\s*(?:s|sec|seconds))?/i)

  if (match) {
    return {
      name: match[1].trim(),
      sets: Number(match[2]) || 3,
      reps: Number(match[3]) || 10,
      rpe: Number(match[4]) || 8,
      rest_seconds: Number(match[5]) || 90,
      notes: '',
    }
  }

  return {
    ...createEmptyExercise(),
    name: cleaned,
  }
}

function seedProgramFromText(rawText = '') {
  const lines = mergeBrokenLines(normalizeImportedRoutineText(rawText).split(/\r?\n/))
  const days = []
  let currentDay = null

  const pushCurrentDay = () => {
    if (!currentDay) return
    if (!currentDay.exercises.length && !isRestDay(currentDay)) {
      currentDay.exercises = [createEmptyExercise()]
    }
    days.push(currentDay)
  }

  lines.forEach((line) => {
    if (looksLikeDayHeading(line)) {
      pushCurrentDay()
      currentDay = {
        day_name: line.replace(/:$/, '').trim(),
        target_muscles: inferTargetMuscles(line),
        exercises: [],
      }
      return
    }

    if (!currentDay) {
      currentDay = {
        day_name: 'Day 1',
        target_muscles: [],
        exercises: [],
      }
    }

    currentDay.exercises.push(parseExerciseLine(line))
  })

  pushCurrentDay()

  return buildEditableProgram({
    name: 'Imported Routine Draft',
    split_type: 'custom',
    weeks: [{
      week_number: 1,
      is_deload: false,
      days: days.length ? days : [createEmptyDay(0)],
    }],
  })
}

function confidenceToneLabel(tone = 'low') {
  if (tone === 'high') return 'strong'
  if (tone === 'mid') return 'building'
  return 'early'
}

function getImportErrorHint(message = '') {
  const normalized = String(message || '').toLowerCase()

  if (/too many requests|rate limit|thrott/i.test(normalized)) {
    return 'The vision request got rate-limited upstream. Give it a minute, then retry or paste the routine as text.'
  }

  if (/timed out|timeout/i.test(normalized)) {
    return 'The screenshots took too long to process. Try fewer images, tighter crops, or the text import path.'
  }

  if (/signed in|session token|unauthorized|missing session/i.test(normalized)) {
    return 'Your app session needs refreshing before the import can call the AI parser again.'
  }

  if (/payload too large|too large/i.test(normalized)) {
    return 'Those screenshots are too heavy for one pass. Try fewer images or lower-resolution crops.'
  }

  return 'The parser could not turn this into a clean routine yet, but you can continue manually from the cleaned source below.'
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
  const [importDiagnostics, setImportDiagnostics] = useState(null)
  const [expandedDays, setExpandedDays] = useState({})

  const activeTab = TAB_OPTIONS.some((tab) => tab.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview'

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
      setSearchParams({ tab: 'overview' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!parsedProgram?.weeks?.[0]?.days?.length) return
    const nextExpanded = {}
    parsedProgram.weeks[0].days.forEach((_, index) => {
      nextExpanded[index] = index === 0
    })
    setExpandedDays(nextExpanded)
  }, [parsedProgram?.weeks?.[0]?.days?.length])

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

  const importSteps = useMemo(() => {
    const reviewReady = Boolean(parsedProgram)
    const saveReady = reviewReady && !savingImport
    return [
      { id: 'source', label: 'Choose source', state: importMode ? 'complete' : 'current' },
      { id: 'parse', label: 'Parse', state: processingImport ? 'current' : (reviewReady || importDiagnostics ? 'complete' : 'idle') },
      { id: 'review', label: 'Review', state: reviewReady ? 'current' : 'idle' },
      { id: 'save', label: 'Save live plan', state: savingImport ? 'current' : (saveReady ? 'ready' : 'idle') },
    ]
  }, [importMode, processingImport, parsedProgram, importDiagnostics, savingImport])

  const overviewCards = useMemo(() => {
    const intelligencePreview = isUltra
      ? analyticsModel.sections[0]?.cards?.slice(0, 2).map((item) => ({
          label: item.title,
          value: item.value,
          note: item.note,
        })) || []
      : LOCKED_INTELLIGENCE_PREVIEW.map((item) => ({ label: item.title, value: item.value, note: item.note }))

    const importPreview = isUltra
      ? [
          {
            label: 'Workflow',
            value: parsedProgram ? 'Review ready' : 'Parse cleanly',
            note: parsedProgram ? 'Your imported draft is ready for review.' : 'Source, parse, review, and save now live in one flow.',
          },
          {
            label: 'Privacy',
            value: 'Server-side',
            note: 'Import parsing stays behind the AI proxy before it touches your active plan.',
          },
        ]
      : LOCKED_IMPORT_STEPS.map((step, index) => ({ label: `Step ${index + 1}`, value: 'Ready', note: step }))

    const socialPreview = isUltra
      ? [
          {
            label: 'Partner fit',
            value: socialEdge.compatibility[0] ? `${socialEdge.compatibility[0].score}%` : 'Waiting',
            note: socialEdge.compatibility[0]
              ? `${socialEdge.compatibility[0].display_name || socialEdge.compatibility[0].username || 'Friend'} is your top current match.`
              : 'Add more active friends to unlock the best suggestions.',
          },
          {
            label: 'Accountability',
            value: socialEdge.accountabilityBoard.length ? `${socialEdge.accountabilityBoard.length} loaded` : 'No board yet',
            note: socialEdge.accountabilityBoard.length
              ? 'Your current crew is ranked by streak and training volume.'
              : 'The board appears once your social graph fills in.',
          },
        ]
      : LOCKED_SOCIAL_PREVIEW.map((item) => ({ label: item.title, value: item.value, note: item.note }))

    return [
      {
        id: 'intelligence',
        title: 'Intelligence',
        kicker: 'Adaptive pattern recognition',
        description: 'Turn readiness, load pressure, adherence, and timing into something you can act on in seconds.',
        icon: RiBrainFill,
        preview: intelligencePreview,
      },
      {
        id: 'import',
        title: 'Import Studio',
        kicker: 'Outside routine cleanup',
        description: 'Bring screenshots or pasted plans into REPMAX with a proper review and save flow instead of a messy text dump.',
        icon: RiUploadCloud2Line,
        preview: importPreview,
      },
      {
        id: 'social',
        title: 'Social Edge',
        kicker: 'Accountability over noise',
        description: 'Find the people, sessions, and nudges that actually make your training more consistent.',
        icon: RiTeamLine,
        preview: socialPreview,
      },
    ]
  }, [analyticsModel.sections, isUltra, parsedProgram, socialEdge.accountabilityBoard.length, socialEdge.compatibility])

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
    setImportDiagnostics(null)
    try {
      const base64Images = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)))
      const result = await generateProgramFromImages(base64Images)

      if (!result?.success || !result.program) {
        const importError = new Error(result?.error?.message || 'Image import failed')
        importError.extractedText = result?.extractedText || ''
        throw importError
      }

      setParsedProgram(buildEditableProgram(result.program))
      setParsedSource('images')
      setLastExtractedText(result.extractedText || '')
      setImportDiagnostics(null)
      showToast('Routine parsed. Review it before saving.')
    } catch (error) {
      console.error('Image import failed:', error)
      const cleanedText = normalizeImportedRoutineText(error?.extractedText || '')
      setLastExtractedText(cleanedText)
      setImportDiagnostics({
        source: 'images',
        cleanedText,
        error: error.message || 'Could not parse that routine yet.',
        hint: getImportErrorHint(error.message),
        canContinue: Boolean(cleanedText.trim()),
      })
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

    const cleanedText = normalizeImportedRoutineText(routineText)
    setProcessingImport(true)
    setImportDiagnostics(null)
    try {
      const result = await generateProgramFromText(routineText)
      if (!result?.success || !result.program) {
        throw new Error(result?.error?.message || 'Text import failed')
      }

      setParsedProgram(buildEditableProgram(result.program))
      setParsedSource('text')
      setLastExtractedText(result.cleanedText || cleanedText)
      setImportDiagnostics(null)
      showToast('Routine parsed. Review it before saving.')
    } catch (error) {
      console.error('Text import failed:', error)
      setLastExtractedText(cleanedText)
      setImportDiagnostics({
        source: 'text',
        cleanedText,
        error: error.message || 'Could not turn that text into a routine yet.',
        hint: getImportErrorHint(error.message),
        canContinue: Boolean(cleanedText.trim()),
      })
      showToast('Could not turn that text into a routine yet.')
    } finally {
      setProcessingImport(false)
    }
  }

  function continueImportManually() {
    const seededProgram = seedProgramFromText(importDiagnostics?.cleanedText || routineText || lastExtractedText)
    setParsedProgram(seededProgram)
    setParsedSource('manual')
    setImportDiagnostics(null)
    showToast('Manual draft seeded. Tighten it up before saving.')
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
    setExpandedDays((current) => ({ ...current, [Object.keys(current).length]: true }))
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
    setExpandedDays((current) => ({ ...current, [dayIndex]: true }))
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
    setImportDiagnostics(null)
    setImageFiles([])
    setRoutineText('')
  }

  function toggleDayExpanded(dayIndex) {
    setExpandedDays((current) => ({ ...current, [dayIndex]: !current[dayIndex] }))
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
      setImportDiagnostics(null)
      setLastExtractedText('')
      showToast('Imported routine saved to your active plan.')
      openTab('overview')
    } catch (error) {
      console.error('Saving imported program failed:', error)
      showToast('Could not save the imported routine yet.')
    } finally {
      setSavingImport(false)
    }
  }

  const intelligencePreview = (
    <div className="ultra-preview-shell">
      <section className="ultra-preview-hero">
        <div className="ultra-preview-kicker">ULTRA INTELLIGENCE</div>
        <h2>See your training state instead of reading a text dump.</h2>
        <p>Readiness, adherence, load pressure, and forecast signals stay grouped and visual so the next move is obvious.</p>
      </section>
      <div className="ultra-preview-grid">
        {LOCKED_INTELLIGENCE_PREVIEW.map((metric) => (
          <article key={metric.title} className="ultra-preview-card">
            <div className="ultra-preview-label">{metric.title}</div>
            <div className="ultra-preview-value">{metric.value}</div>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>
    </div>
  )

  const importPreview = (
    <div className="ultra-preview-shell">
      <section className="ultra-preview-hero">
        <div className="ultra-preview-kicker">IMPORT STUDIO</div>
        <h2>Bring outside routines into REPMAX properly.</h2>
        <p>ULTRA gives you the full parse, review, edit, and apply flow instead of throwing the routine into onboarding and hoping it sticks.</p>
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
    <div className="ultra-preview-shell">
      <section className="ultra-preview-hero">
        <div className="ultra-preview-kicker">SOCIAL EDGE</div>
        <h2>See who helps you lock in, not just who is online.</h2>
        <p>Compatibility, accountability, recurring sessions, and training nudges all live in one premium surface.</p>
      </section>
      <div className="ultra-preview-grid">
        {LOCKED_SOCIAL_PREVIEW.map((card) => (
          <article key={card.title} className="ultra-preview-card">
            <div className="ultra-preview-label">{card.title}</div>
            <div className="ultra-preview-value">{card.value}</div>
            <p>{card.note}</p>
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

      <section className="ultra-command-card">
        <div className="ultra-command-ring" style={{ '--ultra-progress': `${analyticsModel.overview.readiness.ringProgress}%` }}>
          <div className="ultra-command-ring-inner">
            <div className="ultra-command-ring-label">Readiness</div>
            <div className="ultra-command-ring-value">{analyticsModel.overview.readiness.display}</div>
          </div>
        </div>
        <div className="ultra-command-copy">
          <div className="ultra-command-kicker">Behavior-aware training intelligence</div>
          <h2>{analyticsModel.overview.title}</h2>
          <p>{analyticsModel.overview.body}</p>
          <div className="ultra-command-next">
            <span>Next move</span>
            <strong>{analyticsModel.overview.nextMove}</strong>
          </div>
          {!isUltra && (
            <button className="btn btn-primary ultra-lock-cta" onClick={() => navigate('/subscribe')}>
              <RiSparklingFill size={18} />
              Unlock ULTRA
            </button>
          )}
        </div>
      </section>

      <div className="ultra-quick-signal-row">
        {analyticsModel.overview.quickSignals.map((signal) => (
          <article key={signal.id} className={`ultra-quick-signal tone-${signal.tone}`}>
            <div className="ultra-quick-label">{signal.label}</div>
            <div className="ultra-quick-value">{signal.value}</div>
            <div className="ultra-quick-note">{signal.note}</div>
          </article>
        ))}
      </div>

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

      {activeTab === 'overview' && (
        <div className="ultra-overview-grid">
          {overviewCards.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.id} className={`ultra-feature-card feature-${card.id}`}>
                <div className="ultra-feature-top">
                  <div className="ultra-feature-icon"><Icon size={18} /></div>
                  <button type="button" className="ultra-open-link" onClick={() => openTab(card.id)}>
                    Open <RiArrowRightLine size={16} />
                  </button>
                </div>
                <div className="ultra-feature-kicker">{card.kicker}</div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <div className="ultra-feature-preview-list">
                  {card.preview.map((item) => (
                    <div key={`${card.id}-${item.label}`} className="ultra-feature-preview">
                      <div className="ultra-feature-preview-head">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                      <div className="ultra-feature-preview-note">{item.note}</div>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {activeTab === 'intelligence' && (
        isUltra ? (
          <div className="ultra-page-stack">
            <section className="ultra-intelligence-shell">
              <div className="ultra-section-head">
                <div>
                  <div className="ultra-section-kicker">INTELLIGENCE</div>
                  <h2>Training-state overview</h2>
                </div>
                <span className={`ultra-confidence-pill ${getConfidenceClass(analyticsModel.overview.readiness.confidence)}`}>
                  {analyticsModel.overview.readiness.confidence.label}
                </span>
              </div>

              <div className="ultra-chart-grid">
                <article className={`ultra-chart-card tone-${analyticsModel.charts.adherence.tone}`}>
                  <div className="ultra-chart-label">{analyticsModel.charts.adherence.label}</div>
                  <div className="ultra-chart-value">{analyticsModel.charts.adherence.value}</div>
                  <div className="ultra-progress-track">
                    <div className="ultra-progress-fill" style={{ width: `${analyticsModel.charts.adherence.ratio}%` }} />
                  </div>
                  <p>{analyticsModel.charts.adherence.note}</p>
                </article>

                <article className={`ultra-chart-card tone-${analyticsModel.charts.load.tone}`}>
                  <div className="ultra-chart-label">{analyticsModel.charts.load.label}</div>
                  <div className="ultra-chart-value">{analyticsModel.charts.load.value}</div>
                  <div className="ultra-compare-bars">
                    <div className="ultra-compare-bar">
                      <span>7D load</span>
                      <strong>{analyticsModel.charts.load.sevenDay} {weightLabel(unit)}</strong>
                    </div>
                    <div className="ultra-compare-bar">
                      <span>28D avg/day</span>
                      <strong>{analyticsModel.charts.load.baseline} {weightLabel(unit)}</strong>
                    </div>
                  </div>
                  <p>{analyticsModel.charts.load.note}</p>
                </article>

                <article className={`ultra-chart-card tone-${analyticsModel.charts.efficiency.tone}`}>
                  <div className="ultra-chart-label">{analyticsModel.charts.efficiency.label}</div>
                  <div className="ultra-chart-value">{analyticsModel.charts.efficiency.value}</div>
                  <div className="ultra-compare-bars">
                    <div className="ultra-compare-bar">
                      <span>Current</span>
                      <strong>{analyticsModel.charts.efficiency.current} {weightLabel(unit)}/min</strong>
                    </div>
                    <div className="ultra-compare-bar">
                      <span>Previous</span>
                      <strong>{analyticsModel.charts.efficiency.previous} {weightLabel(unit)}/min</strong>
                    </div>
                  </div>
                  <p>{analyticsModel.charts.efficiency.note}</p>
                </article>
              </div>
            </section>

            {analyticsModel.sections.map((section) => (
              <section key={section.id} className="ultra-section-panel">
                <div className="ultra-section-head">
                  <div>
                    <div className="ultra-section-kicker">{section.title.toUpperCase()}</div>
                    <h3>{section.title}</h3>
                  </div>
                </div>
                <div className="ultra-metric-grid">
                  {section.cards.map((metric) => (
                    <article key={metric.id} className={`ultra-metric-card tone-${metric.tone}`}>
                      <div className="ultra-metric-top">
                        <div className="ultra-metric-title">{metric.title}</div>
                        <span className={`ultra-confidence-pill ${getConfidenceClass(metric.confidence)}`}>
                          {confidenceToneLabel(metric.confidence.tone)}
                        </span>
                      </div>
                      <div className="ultra-metric-value">{metric.value}</div>
                      {metric.spark != null && (
                        <div className="ultra-spark-track">
                          <div className="ultra-spark-fill" style={{ width: `${metric.spark}%` }} />
                        </div>
                      )}
                      <p className="ultra-metric-note">{metric.note}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
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
            <section className="ultra-import-hero">
              <div className="ultra-section-kicker">IMPORT STUDIO</div>
              <h2>Outside routines, cleaned before they touch your live plan.</h2>
              <p>
                Upload screenshots or paste full routine text. REPMAX parses it through the server-side AI proxy, then lets you review and fix the structure before it becomes your active program.
              </p>
              <div className="ultra-step-row">
                {importSteps.map((step) => (
                  <div key={step.id} className={`ultra-step-pill state-${step.state}`}>
                    {step.label}
                  </div>
                ))}
              </div>
              {parsedSource && (
                <div className="ultra-source-chip">
                  Source: {parsedSource === 'images' ? 'Screenshots' : parsedSource === 'text' ? 'Pasted text' : 'Manual cleanup'}
                </div>
              )}
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

            {(importDiagnostics || lastExtractedText) && (
              <section className={`ultra-diagnostics-card ${importDiagnostics ? 'has-error' : ''}`}>
                <div className="ultra-section-head">
                  <div>
                    <div className="ultra-section-kicker">PARSE DIAGNOSTICS</div>
                    <h3>{importDiagnostics ? 'The parse needs help.' : 'Parsed source snapshot'}</h3>
                  </div>
                  {importDiagnostics && (
                    <span className="ultra-diagnostic-badge">Needs cleanup</span>
                  )}
                </div>
                <p className="ultra-diagnostics-copy">
                  {importDiagnostics
                    ? importDiagnostics.error
                    : 'This is the cleaned routine text the import flow is currently working from.'}
                </p>
                {importDiagnostics?.hint && (
                  <p className="ultra-diagnostics-copy ultra-diagnostics-hint">{importDiagnostics.hint}</p>
                )}
                {lastExtractedText && (
                  <pre className="ultra-source-text">{lastExtractedText}</pre>
                )}
                {importDiagnostics?.canContinue && (
                  <div className="ultra-diagnostics-actions">
                    <button className="btn btn-secondary btn-sm" onClick={continueImportManually}>
                      <RiClipboardLine size={16} />
                      Continue manually
                    </button>
                  </div>
                )}
              </section>
            )}

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

                <section className="ultra-editor-shell">
                  <div className="ultra-section-head">
                    <div>
                      <div className="ultra-section-kicker">MANUAL REVIEW</div>
                      <h3>Review every day before it becomes active.</h3>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={resetImportEditor}>
                      <RiResetLeftLine size={16} />
                      Reset
                    </button>
                  </div>

                  <div className="input-group ultra-name-field" style={{ marginBottom: 0 }}>
                    <label className="input-label">Routine name</label>
                    <input
                      className="input"
                      value={parsedProgram.name}
                      onChange={(event) => setParsedProgram((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div className="ultra-editor-days">
                    {(parsedProgram.weeks?.[0]?.days || []).map((day, dayIndex) => {
                      const expanded = expandedDays[dayIndex]
                      return (
                        <article key={`${day.day_name}-${dayIndex}`} className={`ultra-day-card ${expanded ? 'expanded' : ''}`}>
                          <button type="button" className="ultra-day-header" onClick={() => toggleDayExpanded(dayIndex)}>
                            <div className="ultra-day-main">
                              <div className="ultra-day-topline">
                                <span className="ultra-day-index">Day {dayIndex + 1}</span>
                                <span className={`ultra-day-state ${isRestDay(day) ? 'rest' : 'live'}`}>
                                  {isRestDay(day) ? 'Rest day' : `${day.exercises.length} exercises`}
                                </span>
                              </div>
                              <div className="ultra-day-title">{day.day_name || `Day ${dayIndex + 1}`}</div>
                            </div>
                            {expanded ? <RiArrowUpSLine size={18} /> : <RiArrowDownSLine size={18} />}
                          </button>

                          {expanded && (
                            <div className="ultra-day-body">
                              <div className="ultra-day-toolbar">
                                <input
                                  className="input ultra-day-name"
                                  value={day.day_name}
                                  onChange={(event) => renameDay(dayIndex, event.target.value)}
                                />
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
                            </div>
                          )}
                        </article>
                      )
                    })}
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
            <section className="ultra-social-shell">
              <div className="ultra-section-head">
                <div>
                  <div className="ultra-section-kicker">SOCIAL EDGE</div>
                  <h2>Use the social layer like a training system.</h2>
                </div>
              </div>
              <p className="ultra-social-intro">
                Compatibility, accountability, and session planning live here so your social graph actually helps you train.
              </p>

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

      {toast && <div className="ultra-floating-toast">{toast}</div>}
    </div>
  )
}
