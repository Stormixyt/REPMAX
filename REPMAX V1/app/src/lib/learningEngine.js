// REPMAX Adaptive Learning Engine
// Tracks user behavior during workouts and auto-updates their profile preferences
// This runs after each completed workout for users who chose "Quick Start" onboarding

import { supabase } from './supabase'

export async function analyzeWorkoutForLearning(userId, workoutData) {
  if (!userId || !workoutData) return

  try {
    // Get current profile
    const { data: profile } = await supabase
      .from('profiles').select('learned_preferences, workouts_since_last_learn, onboarding_type')
      .eq('id', userId).single()

    if (!profile) return

    const prefs = profile.learned_preferences || {}
    const count = (profile.workouts_since_last_learn || 0) + 1

    // Track exercise preferences
    const exerciseNames = (workoutData.exercises || []).map(e => e.name?.toLowerCase()).filter(Boolean)
    const repRanges = (workoutData.exercises || []).flatMap(e =>
      (e.sets || []).map(s => s.reps).filter(r => r > 0)
    )
    const restTimes = (workoutData.exercises || []).flatMap(e =>
      (e.sets || []).map(s => s.rest_seconds).filter(r => r > 0)
    )
    const weights = (workoutData.exercises || []).flatMap(e =>
      (e.sets || []).map(s => s.weight).filter(w => w > 0)
    )

    // Accumulate learned data
    const exerciseHistory = prefs.exercise_history || []
    exerciseHistory.push(...exerciseNames)
    // Keep only last 200 to prevent bloat
    const trimmedHistory = exerciseHistory.slice(-200)

    // Calculate averages
    const avgReps = repRanges.length > 0 ? Math.round(repRanges.reduce((a, b) => a + b, 0) / repRanges.length) : null
    const avgRest = restTimes.length > 0 ? Math.round(restTimes.reduce((a, b) => a + b, 0) / restTimes.length) : null
    const avgWeight = weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : null

    // Detect patterns after 5+ workouts
    const workoutsAnalyzed = (prefs.workouts_analyzed || 0) + 1
    let inferredGoal = prefs.inferred_goal
    let inferredLevel = prefs.inferred_level

    if (workoutsAnalyzed >= 5) {
      // Infer goal from rep ranges
      if (avgReps) {
        if (avgReps <= 5) inferredGoal = 'strength'
        else if (avgReps <= 12) inferredGoal = 'hypertrophy'
        else inferredGoal = 'general'
      }

      // Infer level from weight progression
      if (avgWeight) {
        if (avgWeight > 100) inferredLevel = 'advanced'
        else if (avgWeight > 50) inferredLevel = 'intermediate'
        else inferredLevel = 'beginner'
      }
    }

    // Find most-used exercises (top 10)
    const exerciseFreq = {}
    trimmedHistory.forEach(name => { exerciseFreq[name] = (exerciseFreq[name] || 0) + 1 })
    const favoriteExercises = Object.entries(exerciseFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name]) => name)

    // Detect which muscle groups they train most
    const muscleMapping = {
      'bench press': 'chest', 'incline press': 'chest', 'chest fly': 'chest', 'push-up': 'chest',
      'squat': 'quads', 'leg press': 'quads', 'lunges': 'quads',
      'deadlift': 'hamstrings', 'rdl': 'hamstrings', 'leg curl': 'hamstrings',
      'pull-up': 'back', 'row': 'back', 'lat pulldown': 'back',
      'overhead press': 'shoulders', 'lateral raise': 'shoulders',
      'curl': 'biceps', 'tricep': 'triceps'
    }

    const muscleHits = {}
    trimmedHistory.forEach(name => {
      for (const [keyword, muscle] of Object.entries(muscleMapping)) {
        if (name.includes(keyword)) {
          muscleHits[muscle] = (muscleHits[muscle] || 0) + 1
          break
        }
      }
    })

    const topMuscles = Object.entries(muscleHits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([muscle]) => muscle)

    const updatedPrefs = {
      learning_active: true,
      workouts_analyzed: workoutsAnalyzed,
      exercise_history: trimmedHistory,
      favorite_exercises: favoriteExercises,
      avg_rep_range: avgReps,
      avg_rest_seconds: avgRest,
      avg_weight: avgWeight,
      inferred_goal: inferredGoal,
      inferred_level: inferredLevel,
      top_muscles: topMuscles,
      last_analyzed_at: new Date().toISOString()
    }

    await supabase.from('profiles').update({
      learned_preferences: updatedPrefs,
      workouts_since_last_learn: count
    }).eq('id', userId)

    return updatedPrefs
  } catch (err) {
    console.warn('[REPMAX] Learning engine error:', err)
  }
}

// Returns a learning progress percentage (0-100)
export function getLearningProgress(profile) {
  if (!profile?.learned_preferences?.learning_active) return null
  const analyzed = profile.learned_preferences.workouts_analyzed || 0
  // Consider "fully learned" after 20 workouts
  return Math.min(100, Math.round((analyzed / 20) * 100))
}

// Returns human-readable learning status
export function getLearningStatus(profile) {
  const progress = getLearningProgress(profile)
  if (progress === null) return null
  if (progress < 25) return { text: 'Getting to know you...', emoji: '🌱', color: '#22c55e' }
  if (progress < 50) return { text: 'Learning your style...', emoji: '📊', color: '#3b82f6' }
  if (progress < 75) return { text: 'Understanding patterns...', emoji: '🧠', color: '#8b5cf6' }
  if (progress < 100) return { text: 'Almost there...', emoji: '🔥', color: '#f59e0b' }
  return { text: 'Fully adapted to you', emoji: '✅', color: 'var(--accent)' }
}
