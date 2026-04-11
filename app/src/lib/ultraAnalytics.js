import { formatVolume, formatWeight, weightLabel } from './units'

const DAY_MS = 24 * 60 * 60 * 1000

const PATTERN_LIBRARY = {
  push: ['bench', 'press', 'dip', 'push', 'fly', 'tricep', 'chest', 'shoulder'],
  pull: ['row', 'pull', 'curl', 'lat', 'rear delt', 'trap', 'bicep'],
  lower: ['squat', 'lunge', 'deadlift', 'leg', 'calf', 'glute', 'hamstring', 'quad', 'hip thrust'],
  core: ['plank', 'crunch', 'ab', 'core', 'hollow', 'knee raise'],
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function toWorkoutCollection(workouts = []) {
  return workouts
    .map((workout) => {
      const completedAt = toTimestamp(workout?.completed_at)
      if (!completedAt) return null

      const startedAt = toTimestamp(workout?.started_at)
      const durationMinutes = startedAt
        ? Math.max(5, Math.round((completedAt - startedAt) / 60000))
        : Math.max(5, Math.round((Number(workout?.duration_seconds) || 0) / 60))

      return {
        ...workout,
        timestamp: completedAt,
        completedAt: new Date(completedAt),
        volume: Number(workout?.total_volume) || 0,
        durationMinutes,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp)
}

function inLastDays(collection, days, now) {
  return collection.filter((item) => now - item.timestamp <= days * DAY_MS)
}

function betweenDays(collection, fromDays, toDays, now) {
  return collection.filter((item) => {
    const ageInDays = (now - item.timestamp) / DAY_MS
    return ageInDays > fromDays && ageInDays <= toDays
  })
}

function average(values = []) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sum(values = []) {
  return values.reduce((total, value) => total + value, 0)
}

function compactWithUnit(valueLbs, unit = 'kg', decimals = 1) {
  const label = weightLabel(unit)
  const converted = Number(formatWeight(valueLbs, unit, decimals))

  if (!Number.isFinite(converted) || converted <= 0) {
    return `0 ${label}`
  }

  if (converted >= 1000000) {
    return `${(converted / 1000000).toFixed(1)}M ${label}`
  }

  if (converted >= 1000) {
    return `${(converted / 1000).toFixed(1)}k ${label}`
  }

  if (converted >= 100) {
    return `${Math.round(converted)} ${label}`
  }

  return `${converted.toFixed(decimals)} ${label}`
}

function formatSignedPercent(value) {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `${rounded}%`
  return '0%'
}

function getPatternForExercise(name = '') {
  const normalized = String(name).toLowerCase()

  for (const [pattern, keywords] of Object.entries(PATTERN_LIBRARY)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return pattern
    }
  }

  return 'other'
}

function deriveTargetSessions(activeProgram, profile) {
  const currentWeekIndex = Math.max(0, (activeProgram?.current_week || 1) - 1)
  const currentWeek = activeProgram?.program_data?.weeks?.[currentWeekIndex]

  if (currentWeek?.days?.length) {
    return currentWeek.days.filter((day) => {
      const name = String(day?.day_name || '').toLowerCase()
      const exercises = Array.isArray(day?.exercises) ? day.exercises : []
      return exercises.length > 0 && !/rest|off|recovery/.test(name)
    }).length
  }

  return Math.max(1, profile?.training_days?.length || 3)
}

function getConfidence(sampleSize, enough = 8, low = 4) {
  if (sampleSize >= enough) return { label: 'Established signal', tone: 'high' }
  if (sampleSize >= low) return { label: 'Low confidence', tone: 'mid' }
  return { label: 'Not enough data', tone: 'low' }
}

function createMetric({ id, title, value, note, confidence, accent = 'default' }) {
  return { id, title, value, note, confidence, accent }
}

export function buildUltraAnalyticsModel({
  profile,
  activeProgram,
  workouts = [],
  prs = [],
  sets = [],
  unit = 'kg',
}) {
  const now = Date.now()
  const normalizedWorkouts = toWorkoutCollection(workouts)
  const last7 = inLastDays(normalizedWorkouts, 7, now)
  const last14 = inLastDays(normalizedWorkouts, 14, now)
  const last28 = inLastDays(normalizedWorkouts, 28, now)
  const prev14 = betweenDays(normalizedWorkouts, 14, 28, now)
  const latestWorkout = normalizedWorkouts[0] || null
  const daysSinceLastWorkout = latestWorkout ? (now - latestWorkout.timestamp) / DAY_MS : null

  const targetSessions = deriveTargetSessions(activeProgram, profile)
  const adherenceScore = targetSessions > 0
    ? Math.round(clamp((last7.length / targetSessions) * 100, 0, 160))
    : 0

  const streak = Number(profile?.current_streak) || 0
  const recoveryShape = daysSinceLastWorkout == null ? 54 : clamp(100 - Math.abs(daysSinceLastWorkout - 1.6) * 24, 24, 98)
  const consistencyShape = clamp((last14.length / Math.max(1, targetSessions * 2)) * 100, 20, 110)
  const streakShape = clamp(30 + streak * 2.4, 30, 100)
  const readiness = Math.round(clamp((recoveryShape * 0.42) + (consistencyShape * 0.34) + (streakShape * 0.24), 22, 97))

  const last14Volume = sum(last14.map((workout) => workout.volume))
  const prev14Volume = sum(prev14.map((workout) => workout.volume))
  const volumeMomentum = prev14Volume > 0
    ? ((last14Volume - prev14Volume) / prev14Volume) * 100
    : last14Volume > 0
      ? 100
      : 0

  const lastThree = normalizedWorkouts.slice(0, 3)
  const previousThree = normalizedWorkouts.slice(3, 6)
  const lastThreeEfficiency = average(lastThree.map((workout) => workout.volume / Math.max(1, workout.durationMinutes)))
  const previousThreeEfficiency = average(previousThree.map((workout) => workout.volume / Math.max(1, workout.durationMinutes)))
  const efficiencyTrend = previousThreeEfficiency > 0
    ? ((lastThreeEfficiency - previousThreeEfficiency) / previousThreeEfficiency) * 100
    : lastThreeEfficiency > 0
      ? 100
      : 0

  const acuteLoad = sum(last7.map((workout) => workout.volume)) / 7
  const chronicLoad = sum(last28.map((workout) => workout.volume)) / 28
  const loadRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1

  let loadPressureLabel = 'Balanced'
  if (loadRatio > 1.35) loadPressureLabel = 'High'
  else if (loadRatio < 0.78) loadPressureLabel = 'Low'

  const hourBuckets = new Map([
    ['early', { label: '05:00-09:00', scores: [] }],
    ['midday', { label: '09:00-14:00', scores: [] }],
    ['afternoon', { label: '14:00-19:00', scores: [] }],
    ['night', { label: '19:00-24:00', scores: [] }],
    ['late', { label: '00:00-05:00', scores: [] }],
  ])

  normalizedWorkouts.forEach((workout) => {
    const hour = workout.completedAt.getHours()
    const score = workout.volume / Math.max(1, workout.durationMinutes)
    const bucketKey = hour >= 5 && hour < 9
      ? 'early'
      : hour >= 9 && hour < 14
        ? 'midday'
        : hour >= 14 && hour < 19
          ? 'afternoon'
          : hour >= 19 && hour < 24
            ? 'night'
            : 'late'

    hourBuckets.get(bucketKey)?.scores.push(score)
  })

  const bestWindow = Array.from(hourBuckets.values())
    .map((bucket) => ({
      ...bucket,
      averageScore: average(bucket.scores),
      sampleSize: bucket.scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)[0]

  const patternCounts = { push: 0, pull: 0, lower: 0, core: 0, other: 0 }
  sets.forEach((set) => {
    const pattern = getPatternForExercise(set?.exercise_name)
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1
  })

  const patternEntries = Object.entries(patternCounts).filter(([, count]) => count > 0)
  const dominantPattern = patternEntries.sort((a, b) => b[1] - a[1])[0]
  const weakestPattern = patternEntries.sort((a, b) => a[1] - b[1])[0]
  const balanceLabel = dominantPattern
    ? `${dominantPattern[0].charAt(0).toUpperCase() + dominantPattern[0].slice(1)} heavy`
    : 'Balanced'
  const balanceGap = dominantPattern && weakestPattern
    ? dominantPattern[1] - weakestPattern[1]
    : 0

  const recentPRs = prs
    .map((pr) => ({
      ...pr,
      timestamp: toTimestamp(pr?.achieved_at),
    }))
    .filter((pr) => pr.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)

  const lastPrAgeDays = recentPRs[0] ? (now - recentPRs[0].timestamp) / DAY_MS : null
  const plateauState = lastPrAgeDays == null
    ? 'No PR data'
    : lastPrAgeDays > 35 && Math.abs(volumeMomentum) < 8
      ? 'Plateau watch'
      : lastPrAgeDays > 21
        ? 'Slowing'
        : 'Live'

  const prForecast = Math.round(clamp(
    34
      + ((readiness - 55) * 0.55)
      + (volumeMomentum * 0.28)
      - (loadRatio > 1.35 ? 12 : 0)
      + (lastPrAgeDays != null && lastPrAgeDays < 14 ? 8 : 0),
    12,
    96,
  ))

  const exerciseROI = {}
  sets.forEach((set) => {
    const name = set?.exercise_name
    if (!name) return

    if (!exerciseROI[name]) {
      exerciseROI[name] = { sets: 0, prs: 0 }
    }

    exerciseROI[name].sets += 1
  })

  recentPRs.forEach((pr) => {
    if (!pr.exercise_name) return
    if (!exerciseROI[pr.exercise_name]) {
      exerciseROI[pr.exercise_name] = { sets: 0, prs: 0 }
    }
    exerciseROI[pr.exercise_name].prs += 1
  })

  const bestRespondingLift = Object.entries(exerciseROI)
    .map(([exercise, data]) => ({
      exercise,
      score: data.prs > 0 ? data.prs / Math.max(1, data.sets / 6) : 0,
      data,
    }))
    .sort((a, b) => b.score - a.score)[0]

  const analyticsConfidence = getConfidence(normalizedWorkouts.length, 12, 5)
  const volumeConfidence = getConfidence(last14.length + prev14.length, 10, 4)
  const efficiencyConfidence = getConfidence(lastThree.length + previousThree.length, 6, 3)
  const timingConfidence = getConfidence(bestWindow?.sampleSize || 0, 5, 3)
  const balanceConfidence = getConfidence(sets.length, 40, 16)
  const plateauConfidence = getConfidence(recentPRs.length + normalizedWorkouts.length, 10, 4)

  const nextMove = readiness >= 74
    ? 'Push a primary lift this week while your momentum is up.'
    : loadRatio > 1.35
      ? 'Hold intensity steady and protect recovery before chasing a PR.'
      : adherenceScore < 70
        ? 'Your biggest win is simply hitting the planned sessions this week.'
        : 'Keep the split clean and attack the next session with intent.'

  const heroTitle = readiness >= 78
    ? 'Your training is lining up.'
    : readiness >= 60
      ? 'You are stable, but not peaking yet.'
      : 'The data says rebuild first.'

  const heroBody = `Readiness is ${readiness}/100, adherence is ${adherenceScore}%, and load pressure is ${loadPressureLabel.toLowerCase()}. ${nextMove}`

  const metrics = [
    createMetric({
      id: 'readiness',
      title: 'Readiness Index',
      value: `${readiness}/100`,
      note: `${daysSinceLastWorkout == null ? 'No recent session timing yet.' : `Last workout ${daysSinceLastWorkout.toFixed(1)} days ago.`} Built from recovery spacing, streak pressure, and recent consistency.`,
      confidence: analyticsConfidence,
      accent: readiness >= 78 ? 'high' : readiness >= 60 ? 'mid' : 'low',
    }),
    createMetric({
      id: 'load',
      title: 'Recovery / Load Pressure',
      value: `${loadPressureLabel} · ${loadRatio.toFixed(2)}x`,
      note: `Your 7-day load is ${compactWithUnit(sum(last7.map((workout) => workout.volume)), unit)} against a 28-day baseline of ${compactWithUnit(sum(last28.map((workout) => workout.volume)) / Math.max(1, last28.length), unit)} per day.`,
      confidence: getConfidence(last28.length, 8, 4),
      accent: loadPressureLabel === 'Balanced' ? 'high' : loadPressureLabel === 'Low' ? 'mid' : 'low',
    }),
    createMetric({
      id: 'momentum',
      title: 'Volume Momentum',
      value: formatSignedPercent(volumeMomentum),
      note: `${compactWithUnit(last14Volume, unit)} in the last 14 days vs ${compactWithUnit(prev14Volume, unit)} in the 14 before that.`,
      confidence: volumeConfidence,
      accent: volumeMomentum >= 8 ? 'high' : Math.abs(volumeMomentum) < 5 ? 'mid' : 'low',
    }),
    createMetric({
      id: 'adherence',
      title: 'Plan Adherence',
      value: `${adherenceScore}%`,
      note: `${last7.length} completed sessions this week against a real target of ${targetSessions} programmed sessions.`,
      confidence: getConfidence(targetSessions + last7.length, 6, 3),
      accent: adherenceScore >= 90 ? 'high' : adherenceScore >= 65 ? 'mid' : 'low',
    }),
    createMetric({
      id: 'efficiency',
      title: 'Session Efficiency Trend',
      value: formatSignedPercent(efficiencyTrend),
      note: `Recent sessions are averaging ${compactWithUnit(lastThreeEfficiency, unit)} per minute of training output.`,
      confidence: efficiencyConfidence,
      accent: efficiencyTrend >= 6 ? 'high' : Math.abs(efficiencyTrend) < 5 ? 'mid' : 'low',
    }),
    createMetric({
      id: 'window',
      title: 'Peak Performance Window',
      value: bestWindow?.averageScore > 0 ? bestWindow.label : 'No signal',
      note: bestWindow?.averageScore > 0
        ? `Your best output has been showing up here across ${bestWindow.sampleSize} tracked sessions.`
        : 'You need more completed workouts before timing trends become trustworthy.',
      confidence: timingConfidence,
      accent: bestWindow?.averageScore > 0 ? 'high' : 'low',
    }),
    createMetric({
      id: 'balance',
      title: 'Strength Bias / Split Balance',
      value: dominantPattern ? `${balanceLabel} +${balanceGap}` : 'No signal',
      note: dominantPattern
        ? `Set distribution says ${dominantPattern[0]} work is outpacing ${weakestPattern?.[0] || 'other'} by ${balanceGap} logged sets.`
        : 'Log more completed sets to surface which pattern is dominating your split.',
      confidence: balanceConfidence,
      accent: balanceGap <= 4 ? 'high' : balanceGap <= 10 ? 'mid' : 'low',
    }),
    createMetric({
      id: 'plateau',
      title: 'Plateau Detector',
      value: plateauState,
      note: lastPrAgeDays == null
        ? 'No recent PR history yet.'
        : `Last PR was ${Math.round(lastPrAgeDays)} days ago, with momentum currently at ${formatSignedPercent(volumeMomentum)}.`,
      confidence: plateauConfidence,
      accent: plateauState === 'Live' ? 'high' : plateauState === 'Slowing' ? 'mid' : 'low',
    }),
    createMetric({
      id: 'roi',
      title: 'Exercise ROI / Best Responding Lift',
      value: bestRespondingLift?.score > 0 ? bestRespondingLift.exercise : 'No signal',
      note: bestRespondingLift?.score > 0
        ? `${bestRespondingLift.data.prs} PR spikes from ${bestRespondingLift.data.sets} tracked sets makes this your best responding lift right now.`
        : 'You need more completed sets and PR history before lift ROI becomes useful.',
      confidence: getConfidence((bestRespondingLift?.data?.sets || 0) + (bestRespondingLift?.data?.prs || 0), 12, 5),
      accent: bestRespondingLift?.score > 0 ? 'high' : 'low',
    }),
    createMetric({
      id: 'forecast',
      title: 'Next-session PR Forecast',
      value: `${prForecast}%`,
      note: `Built from readiness, recent momentum, load pressure, and PR recency. ${nextMove}`,
      confidence: analyticsConfidence,
      accent: prForecast >= 70 ? 'high' : prForecast >= 50 ? 'mid' : 'low',
    }),
  ]

  return {
    hero: {
      title: heroTitle,
      body: heroBody,
      confidence: analyticsConfidence,
      action: nextMove,
    },
    metrics,
    summary: {
      readiness,
      adherenceScore,
      loadRatio,
      volumeMomentum,
      workoutCount: normalizedWorkouts.length,
      programName: activeProgram?.name || 'No active plan',
    },
  }
}
