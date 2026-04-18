import { useState, useEffect, useMemo, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl, Image, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Card, CardTitle, CardLabel, StatBox, Button, Badge } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'
import { formatWeight, formatVolume, weightLabel } from '../../lib/units'

const MOTIVATIONS = [
  "No excuses, just execution.",
  "Your only limit is you.",
  "Pain is weakness leaving the body.",
  "Sweat is just fat crying.",
  "One day, or day one. You decide.",
  "Discipline outlasts motivation.",
  "Light weight, baby!",
  "Make yourself proud today.",
]

const DAY_MS = 24 * 60 * 60 * 1000

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSignedPercent(value) {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `${rounded}%`
  return '0%'
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Night owl'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Night owl'
}

function getAuraLevel(streak) {
  if (streak >= 30) return 'fire'
  if (streak >= 14) return 'high'
  if (streak >= 7) return 'medium'
  if (streak >= 3) return 'low'
  return ''
}

function toWorkoutNumber(value, fallback = 0, preference = 'first') {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const matches = String(value ?? '').match(/\d*\.?\d+/g)
  if (!matches?.length) return fallback
  const picked = preference === 'last' ? matches[matches.length - 1] : matches[0]
  const parsed = Number(picked)
  return Number.isFinite(parsed) ? parsed : fallback
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
    for (let index = 1; index <= setCount; index++) {
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

function buildUltraInsights({ profile, workouts, recentPRs, unit }) {
  const now = Date.now()
  const unitName = weightLabel(unit)
  const completedWorkouts = (workouts || [])
    .map((w) => {
      if (!w?.completed_at) return null
      const completedAt = new Date(w.completed_at)
      if (isNaN(completedAt.getTime())) return null
      const startedAt = w.started_at ? new Date(w.started_at) : null
      const durationMinutes = startedAt && !isNaN(startedAt.getTime()) ? Math.max(5, (completedAt.getTime() - startedAt.getTime()) / 60000) : null
      return { completedAt, timestamp: completedAt.getTime(), volume: Number(w.total_volume) || 0, durationMinutes }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp)

  const inDays = (d) => completedWorkouts.filter((w) => now - w.timestamp <= d * DAY_MS)
  const betweenDays = (from, to) => completedWorkouts.filter((w) => { const age = (now - w.timestamp) / DAY_MS; return age > from && age <= to })
  const sumVolume = (rows) => rows.reduce((t, r) => t + (r.volume || 0), 0)
  const sumDuration = (rows) => rows.reduce((t, r) => t + (r.durationMinutes || 0), 0)

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

  const prProbability = Math.round(clamp(38 + (volumeTrend * 0.35) + ((readiness - 60) * 0.55), 12, 96))
  const acuteLoad = last7Volume / 7
  const chronicLoad = last28.length > 0 ? sumVolume(last28) / 28 : 0
  const loadRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1
  let loadState = 'Balanced'
  if (loadRatio > 1.35) loadState = 'Overreach Risk'
  else if (loadRatio < 0.78) loadState = 'Undershooting'

  return [
    { id: 'readiness', title: 'Readiness Index', value: `${readiness}/100`, note: `${readinessLabel} state` },
    { id: 'momentum', title: 'Volume Momentum', value: formatSignedPercent(volumeTrend), note: `${last7.length} sessions this week` },
    { id: 'adherence', title: 'Plan Adherence', value: `${weeklyAdherence}%`, note: `${weeklySessions}/${trainingTarget} sessions` },
    { id: 'efficiency', title: 'Session Efficiency', value: efficiency > 0 ? `${formatWeight(efficiency, unit, 1)} ${unitName}/min` : 'No data', note: '' },
    { id: 'pr', title: 'PR Chance', value: `${prProbability}%`, note: 'Next session forecast' },
    { id: 'load', title: 'Load Ratio', value: `${loadRatio.toFixed(2)}x`, note: loadState },
  ]
}

export default function DashboardScreen() {
  const { user, profile, isPro, isUltra } = useAuth()
  const { t } = useLanguage()
  const { theme } = useTheme()
  const navigation = useNavigation()
  const [program, setProgram] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [recentPRs, setRecentPRs] = useState([])
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [stats, setStats] = useState({ total: 0, streak: 0, volume: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [startingWorkout, setStartingWorkout] = useState('')
  const [motivation] = useState(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadDashboard()
    return () => { mounted.current = false }
  }, [])

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

  async function onRefresh() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  async function startWorkout() {
    if (!todayWorkout || !program) return
    setStartingWorkout('today')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    try {
      const { data: workout, error } = await supabase
        .from('workouts')
        .insert({ user_id: user.id, program_id: program?.id, day_name: todayWorkout.day_name || 'Workout', week_number: todayWorkout.weekNumber || 1, started_at: new Date().toISOString() })
        .select().single()
      if (error || !workout) throw error || new Error('Could not start workout')
      const setTemplates = buildSetTemplatesFromExercises(todayWorkout.exercises)
      if (setTemplates.length > 0) {
        await supabase.from('sets').insert(setTemplates.map((s) => ({ ...s, workout_id: workout.id })))
      }
      navigation.navigate('Workout', { workoutId: workout.id })
    } catch (err) {
      console.error('Start workout error:', err)
    } finally {
      setStartingWorkout('')
    }
  }

  const greeting = getGreeting()
  const firstName = typeof profile?.display_name === 'string' ? profile.display_name.split(' ')[0] : 'Athlete'
  const unit = profile?.unit_preference || profile?.units || 'kg'
  const auraLevel = getAuraLevel(stats.streak)
  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = profile?.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`

  const ultraInsights = useMemo(() => {
    if (!isUltra) return []
    return buildUltraInsights({ profile, workouts: workoutHistory, recentPRs, unit })
  }, [isUltra, workoutHistory, recentPRs, profile, unit])

  const isRestDay = !todayWorkout || isRestLikeWorkoutDay(todayWorkout)

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: theme.text.secondary }]}>{greeting},</Text>
          <Text style={[styles.name, { color: theme.text.primary }]}>{firstName}</Text>
          <Text style={[styles.motivation, { color: theme.text.tertiary }]}>{motivation}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
          <View style={[styles.avatarWrap, { borderColor: auraLevel ? theme.accent : theme.border }]}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statRow}>
        <StatBox value={stats.total} label={t('dashboard_workouts')} />
        <StatBox value={stats.streak} label={t('dashboard_day_streak')} />
        <StatBox value={formatVolume(stats.volume, unit)} label="Volume" />
      </View>

      {/* Today's Workout Card */}
      <Card>
        <CardLabel>{isRestDay ? t('dashboard_rest_day') : t('dashboard_today_workout')}</CardLabel>
        {isRestDay ? (
          <View>
            <Text style={[styles.restDayText, { color: theme.text.secondary }]}>
              Recovery day. Let your muscles rebuild.
            </Text>
            <Button title={t('dashboard_recovery_hub')} variant="secondary" size="sm" onPress={() => navigation.navigate('Recovery')} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <View>
            <Text style={[styles.workoutTitle, { color: theme.text.primary }]}>{todayWorkout?.day_name || 'Workout'}</Text>
            {todayWorkout?.exercises?.length > 0 && (
              <Text style={[styles.exerciseList, { color: theme.text.tertiary }]}>
                {todayWorkout.exercises.slice(0, 4).map(e => e.name).join(' · ')}
                {todayWorkout.exercises.length > 4 ? ` +${todayWorkout.exercises.length - 4} more` : ''}
              </Text>
            )}
            <Button
              title={startingWorkout ? '' : t('dashboard_start_workout')}
              loading={!!startingWorkout}
              onPress={startWorkout}
              size="lg"
              style={{ marginTop: 16 }}
              icon={<Ionicons name="flash" size={18} color={theme.text.onAccent} />}
            />
          </View>
        )}
      </Card>

      {/* Program Info */}
      {program && (
        <Card>
          <CardLabel>{t('dashboard_current_program')}</CardLabel>
          <Text style={[styles.programName, { color: theme.text.primary }]}>{program.name || 'Training Program'}</Text>
          <Text style={[styles.programMeta, { color: theme.text.tertiary }]}>
            Week {program.current_week || 1} · {profile?.preferred_split?.replace('_', '/') || 'Custom'}
          </Text>
        </Card>
      )}

      {/* Ultra Insights */}
      {isUltra && ultraInsights.length > 0 && (
        <Card>
          <CardLabel>ULTRA INSIGHTS</CardLabel>
          <View style={styles.insightsGrid}>
            {ultraInsights.map((insight) => (
              <View key={insight.id} style={[styles.insightItem, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}>
                <Text style={[styles.insightValue, { color: theme.accent }]}>{insight.value}</Text>
                <Text style={[styles.insightTitle, { color: theme.text.secondary }]}>{insight.title}</Text>
                {insight.note ? <Text style={[styles.insightNote, { color: theme.text.tertiary }]}>{insight.note}</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <Card>
          <CardLabel>{t('dashboard_recent_prs')}</CardLabel>
          {recentPRs.slice(0, 5).map((pr, i) => (
            <View key={pr.id || i} style={[styles.prItem, i > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
              <View style={styles.prLeft}>
                <Ionicons name="trophy" size={16} color={theme.accent} />
                <Text style={[styles.prName, { color: theme.text.primary }]}>{pr.exercise_name}</Text>
              </View>
              <Text style={[styles.prValue, { color: theme.accent }]}>
                {formatWeight(pr.weight, unit)} {weightLabel(unit)} x {pr.reps}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Run Tracker Beta */}
      <Card>
        <CardLabel>{t('dashboard_run_beta')}</CardLabel>
        <Text style={[styles.cardDesc, { color: theme.text.secondary }]}>{t('dashboard_run_beta_desc')}</Text>
        <Button title={t('dashboard_run_cta')} variant="secondary" size="sm" onPress={() => navigation.navigate('RunTracker')} style={{ marginTop: 12 }} />
      </Card>

      {/* Discord Card */}
      <Card>
        <CardLabel>{t('dashboard_discord_title')}</CardLabel>
        <Text style={[styles.cardDesc, { color: theme.text.secondary }]}>{t('dashboard_discord_body')}</Text>
        <Button title={t('dashboard_discord_cta')} variant="secondary" size="sm" onPress={() => Linking.openURL('https://discord.gg/repmax')} style={{ marginTop: 12 }} />
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  headerLeft: { flex: 1 },
  greeting: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.black, letterSpacing: -0.5, marginTop: 2 },
  motivation: { fontSize: fontSize.xs, marginTop: 4, fontStyle: 'italic' },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  restDayText: { fontSize: fontSize.sm, lineHeight: 20 },
  workoutTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  exerciseList: { fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
  programName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  programMeta: { fontSize: fontSize.sm, marginTop: 2 },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  insightItem: { width: '48%', borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  insightValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  insightTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
  insightNote: { fontSize: 10, marginTop: 2 },
  prItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  prLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  prName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  prValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  cardDesc: { fontSize: fontSize.sm, lineHeight: 20 },
})
