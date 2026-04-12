import { formatWeight, weightLabel } from './units'

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

function compactWeightWithUnit(valueLbs, unit = 'kg', decimals = 1) {
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

function compactWeight(valueLbs, unit = 'kg', decimals = 1) {
  return compactWeightWithUnit(valueLbs, unit, decimals).replace(` ${weightLabel(unit)}`, '')
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

function createCard({ id, title, value, note, confidence, tone = 'default', spark = null }) {
  return { id, title, value, note, confidence, tone, spark }
}

function formatSessionGap(daysSinceLastWorkout) {
  if (daysSinceLastWorkout == null) return 'No recent session timing yet.'
  if (daysSinceLastWorkout < 1) return 'You trained inside the last 24 hours.'
  return `Last workout ${daysSinceLastWorkout.toFixed(1)} days ago.`
}

function getTrendDescriptor(currentCount, previousCount, positiveLabel = 'Momentum rising') {
  if (currentCount < 2 && previousCount < 2) return 'Not enough data'
  if (previousCount < 2 && currentCount >= 2) return 'New baseline'
  if (currentCount < 2) return 'Rebuild cadence'
  return positiveLabel
}

function buildWindowBuckets(normalizedWorkouts) {
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

  return Array.from(hourBuckets.values())
    .map((bucket) => ({
      ...bucket,
      averageScore: average(bucket.scores),
      sampleSize: bucket.scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
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

  const veryLowData = normalizedWorkouts.length < 3
  const lowData = normalizedWorkouts.length < 6

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

  const timingBuckets = buildWindowBuckets(normalizedWorkouts)
  const bestWindow = timingBuckets[0]

  const patternCounts = { push: 0, pull: 0, lower: 0, core: 0, other: 0 }
  sets.forEach((set) => {
    const pattern = getPatternForExercise(set?.exercise_name)
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1
  })

  const patternEntries = Object.entries(patternCounts).filter(([, count]) => count > 0)
  const dominantPattern = [...patternEntries].sort((a, b) => b[1] - a[1])[0]
  const weakestPattern = [...patternEntries].sort((a, b) => a[1] - b[1])[0]
  const balanceGap = dominantPattern && weakestPattern ? dominantPattern[1] - weakestPattern[1] : 0
  const balanceLabel = dominantPattern
    ? `${dominantPattern[0].charAt(0).toUpperCase() + dominantPattern[0].slice(1)} heavy`
    : 'Balanced'

  const recentPRs = prs
    .map((pr) => ({
      ...pr,
      timestamp: toTimestamp(pr?.achieved_at),
    }))
    .filter((pr) => pr.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)

  const lastPrAgeDays = recentPRs[0] ? (now - recentPRs[0].timestamp) / DAY_MS : null
  const plateauState = lastPrAgeDays == null
    ? 'No signal'
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
    if (!exerciseROI[name]) exerciseROI[name] = { sets: 0, prs: 0 }
    exerciseROI[name].sets += 1
  })

  recentPRs.forEach((pr) => {
    if (!pr.exercise_name) return
    if (!exerciseROI[pr.exercise_name]) exerciseROI[pr.exercise_name] = { sets: 0, prs: 0 }
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
  const loadConfidence = getConfidence(last28.length, 8, 4)
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

  const heroTitle = veryLowData
    ? 'ULTRA is still learning your pattern.'
    : readiness >= 78
      ? 'Your training is lining up.'
      : readiness >= 60
        ? 'You are stable, but not peaking yet.'
        : 'The data says rebuild first.'

  const readinessLabel = veryLowData ? 'Building signal' : `${readiness}/100`
  const readinessNote = veryLowData
    ? 'Log a few more completed sessions so readiness can move from placeholders into real signal.'
    : `${formatSessionGap(daysSinceLastWorkout)} Built from recovery spacing, streak pressure, and recent consistency.`

  const momentumValue = last14.length < 2 && prev14.length < 2
    ? 'Not enough data'
    : prev14.length < 2 && last14.length >= 2
      ? 'New baseline'
      : formatSignedPercent(volumeMomentum)
  const momentumNote = prev14.length < 2
    ? `${compactWeightWithUnit(last14Volume, unit)} logged in the current 14-day window. One more cycle will unlock a clean before-vs-after comparison.`
    : `${compactWeightWithUnit(last14Volume, unit)} in the last 14 days vs ${compactWeightWithUnit(prev14Volume, unit)} in the 14 before that.`

  const efficiencyValue = previousThree.length < 2
    ? getTrendDescriptor(lastThree.length, previousThree.length, 'Early trend')
    : formatSignedPercent(efficiencyTrend)
  const efficiencyNote = lastThree.length
    ? `Recent sessions are averaging ${compactWeightWithUnit(lastThreeEfficiency, unit)} per minute of training output.`
    : 'Complete a few full sessions to unlock real efficiency trends.'

  const windowValue = (bestWindow?.sampleSize || 0) < 3
    ? 'Building signal'
    : bestWindow.label
  const windowNote = (bestWindow?.sampleSize || 0) < 3
    ? 'Training times are still too light to claim a real peak window yet.'
    : `Your best output has been showing up here across ${bestWindow.sampleSize} tracked sessions.`

  const loadValue = last28.length < 3
    ? 'Early signal'
    : `${loadPressureLabel} · ${loadRatio.toFixed(2)}x`
  const loadNote = last28.length < 3
    ? `${compactWeightWithUnit(sum(last7.map((workout) => workout.volume)), unit)} logged in the last 7 days. Keep training and the load model will stabilize.`
    : `Your 7-day load is ${compactWeightWithUnit(sum(last7.map((workout) => workout.volume)), unit)} against a 28-day baseline of ${compactWeightWithUnit(sum(last28.map((workout) => workout.volume)) / Math.max(1, last28.length), unit)} per day.`

  const biasValue = dominantPattern
    ? `${balanceLabel}${balanceGap > 0 ? ` +${balanceGap}` : ''}`
    : 'No signal'
  const biasNote = dominantPattern
    ? `Set distribution says ${dominantPattern[0]} work is outpacing ${weakestPattern?.[0] || 'other'} by ${balanceGap} logged sets.`
    : 'Log more completed sets to surface which pattern is dominating your split.'

  const plateauValue = veryLowData ? 'Building signal' : plateauState
  const plateauNote = lastPrAgeDays == null
    ? 'No recent PR history yet.'
    : `Last PR was ${Math.round(lastPrAgeDays)} days ago, with momentum currently at ${momentumValue.toLowerCase?.() || momentumValue}.`

  const forecastValue = veryLowData ? 'Early read' : `${prForecast}%`
  const forecastNote = veryLowData
    ? 'Forecasting opens up once REPMAX sees more completed sessions and at least one rhythm cycle.'
    : `Built from readiness, recent momentum, load pressure, and PR recency. ${nextMove}`

  const roiValue = bestRespondingLift?.score > 0 ? bestRespondingLift.exercise : 'No signal'
  const roiNote = bestRespondingLift?.score > 0
    ? `${bestRespondingLift.data.prs} PR spikes from ${bestRespondingLift.data.sets} tracked sets makes this your best responding lift right now.`
    : 'You need more completed sets and PR history before lift ROI becomes useful.'

  const adherenceTone = adherenceScore >= 90 ? 'high' : adherenceScore >= 65 ? 'mid' : 'low'
  const loadTone = loadPressureLabel === 'Balanced' ? 'high' : loadPressureLabel === 'Low' ? 'mid' : 'low'
  const readinessTone = readiness >= 78 ? 'high' : readiness >= 60 ? 'mid' : 'low'
  const momentumTone = volumeMomentum >= 8 ? 'high' : Math.abs(volumeMomentum) < 5 ? 'mid' : 'low'
  const efficiencyTone = efficiencyTrend >= 6 ? 'high' : Math.abs(efficiencyTrend) < 5 ? 'mid' : 'low'
  const forecastTone = prForecast >= 70 ? 'high' : prForecast >= 50 ? 'mid' : 'low'
  const balanceTone = balanceGap <= 4 ? 'high' : balanceGap <= 10 ? 'mid' : 'low'

  return {
    summary: {
      workoutCount: normalizedWorkouts.length,
      programName: activeProgram?.name || 'No active plan',
      targetSessions,
      last7Count: last7.length,
      last14Count: last14.length,
    },
    overview: {
      title: heroTitle,
      body: veryLowData
        ? 'ULTRA will turn your workouts into real signal once you log a few more completed sessions. The shell is ready; the data is still filling in.'
        : `Readiness is ${readiness}/100, adherence is ${adherenceScore}%, and load pressure is ${loadPressureLabel.toLowerCase()}.`,
      nextMove,
      readiness: {
        score: readiness,
        display: readinessLabel,
        note: readinessNote,
        confidence: analyticsConfidence,
        tone: readinessTone,
        ringProgress: veryLowData ? 42 : readiness,
      },
      quickSignals: [
        {
          id: 'plan',
          label: 'Current plan',
          value: activeProgram?.name || 'No live plan',
          note: `${last7.length}/${targetSessions} sessions this week`,
          tone: adherenceTone,
        },
        {
          id: 'load',
          label: 'Load pressure',
          value: loadValue,
          note: loadPressureLabel === 'Balanced' ? 'Recovery is tracking clean.' : 'Pressure needs watching.',
          tone: loadTone,
        },
        {
          id: 'window',
          label: 'Peak window',
          value: windowValue,
          note: bestWindow?.sampleSize ? `${bestWindow.sampleSize} tracked sessions` : 'No timing signal yet',
          tone: timingConfidence.tone === 'high' ? 'high' : 'mid',
        },
      ],
    },
    charts: {
      adherence: {
        label: 'Plan adherence',
        value: `${adherenceScore}%`,
        completed: last7.length,
        target: targetSessions,
        ratio: clamp(adherenceScore, 0, 100),
        tone: adherenceTone,
        note: `${last7.length} completed sessions this week against a real target of ${targetSessions} programmed sessions.`,
      },
      load: {
        label: 'Recovery / load pressure',
        value: loadValue,
        ratio: clamp((loadRatio / 1.6) * 100, 18, 100),
        tone: loadTone,
        note: loadNote,
        sevenDay: compactWeight(sum(last7.map((workout) => workout.volume)), unit),
        baseline: compactWeight(sum(last28.map((workout) => workout.volume)) / Math.max(1, last28.length), unit),
      },
      efficiency: {
        label: 'Session efficiency',
        value: efficiencyValue,
        tone: efficiencyTone,
        note: efficiencyNote,
        current: compactWeight(lastThreeEfficiency, unit),
        previous: compactWeight(previousThreeEfficiency, unit),
      },
    },
    sections: [
      {
        id: 'recovery',
        title: 'Recovery & Readiness',
        cards: [
          createCard({
            id: 'readiness',
            title: 'Readiness index',
            value: readinessLabel,
            note: readinessNote,
            confidence: analyticsConfidence,
            tone: readinessTone,
            spark: readiness,
          }),
          createCard({
            id: 'load',
            title: 'Recovery / load pressure',
            value: loadValue,
            note: loadNote,
            confidence: loadConfidence,
            tone: loadTone,
            spark: clamp((loadRatio / 1.5) * 100, 12, 100),
          }),
          createCard({
            id: 'window',
            title: 'Peak performance window',
            value: windowValue,
            note: windowNote,
            confidence: timingConfidence,
            tone: (bestWindow?.sampleSize || 0) >= 3 ? 'high' : 'mid',
          }),
        ],
      },
      {
        id: 'performance',
        title: 'Performance Pattern',
        cards: [
          createCard({
            id: 'momentum',
            title: 'Volume momentum',
            value: momentumValue,
            note: momentumNote,
            confidence: volumeConfidence,
            tone: momentumTone,
          }),
          createCard({
            id: 'efficiency',
            title: 'Session efficiency trend',
            value: efficiencyValue,
            note: efficiencyNote,
            confidence: efficiencyConfidence,
            tone: efficiencyTone,
          }),
          createCard({
            id: 'bias',
            title: 'Strength bias / split balance',
            value: biasValue,
            note: biasNote,
            confidence: balanceConfidence,
            tone: balanceTone,
          }),
        ],
      },
      {
        id: 'forecast',
        title: 'Forecast & Opportunity',
        cards: [
          createCard({
            id: 'plateau',
            title: 'Plateau detector',
            value: plateauValue,
            note: plateauNote,
            confidence: plateauConfidence,
            tone: plateauState === 'Live' ? 'high' : plateauState === 'Slowing' ? 'mid' : 'low',
          }),
          createCard({
            id: 'roi',
            title: 'Exercise ROI',
            value: roiValue,
            note: roiNote,
            confidence: getConfidence((bestRespondingLift?.data?.sets || 0) + (bestRespondingLift?.data?.prs || 0), 12, 5),
            tone: bestRespondingLift?.score > 0 ? 'high' : 'low',
          }),
          createCard({
            id: 'forecast',
            title: 'Next-session PR forecast',
            value: forecastValue,
            note: forecastNote,
            confidence: analyticsConfidence,
            tone: forecastTone,
          }),
        ],
      },
    ],
  }
}
