import { useState, useEffect, useMemo, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl, Image, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Card, CardLabel, StatBox, Button, Badge, IconButton, ProgressBar, SectionHeader, TierBadge } from '../../components/ui'
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
  "The grind doesn't stop.",
  "Earn your rest day.",
]

const AURA_CONFIG = {
  fire:   { emoji: '🔥', label: 'On Fire', glow: 'rgba(255, 100, 0, 0.35)' },
  high:   { emoji: '⚡', label: 'High Energy', glow: 'rgba(204, 255, 0, 0.25)' },
  medium: { emoji: '💪', label: 'Building', glow: 'rgba(204, 255, 0, 0.12)' },
  low:    { emoji: '🌱', label: 'Growing', glow: null },
}

const DAY_MS = 24 * 60 * 60 * 1000

function clamp(v, min, max) { return Math.min(Math.max(v, min), max) }

function formatSignedPercent(value) {
  const r = Math.round(value)
  return r > 0 ? `+${r}%` : r < 0 ? `${r}%` : '0%'
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
    { id: 'readiness', icon: '🧠', title: 'Readiness', value: `${readiness}`, note: readinessLabel, pct: readiness / 100 },
    { id: 'momentum', icon: '📈', title: 'Momentum', value: formatSignedPercent(volumeTrend), note: `${last7.length} sessions`, pct: clamp(volumeTrend / 100 + 0.5, 0, 1) },
    { id: 'adherence', icon: '🎯', title: 'Adherence', value: `${weeklyAdherence}%`, note: `${weeklySessions}/${trainingTarget}`, pct: weeklyAdherence / 100 },
    { id: 'efficiency', icon: '⚡', title: 'Efficiency', value: efficiency > 0 ? `${formatWeight(efficiency, unit, 0)}` : '—', note: efficiency > 0 ? `${unitName}/min` : 'No data', pct: clamp(efficiency / 100, 0, 1) },
    { id: 'pr', icon: '🏆', title: 'PR Chance', value: `${prProbability}%`, note: 'Next session', pct: prProbability / 100 },
    { id: 'load', icon: '⚖️', title: 'Load Ratio', value: `${loadRatio.toFixed(2)}x`, note: loadState, pct: clamp(loadRatio / 2, 0, 1) },
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
  const [unreadCount, setUnreadCount] = useState(0)
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
      const [progRes, prsRes, workoutsRes, notifRes] = await Promise.all([
        supabase.from('programs').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(18),
        supabase.from('workouts').select('started_at, completed_at, total_volume, day_name').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
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
      setUnreadCount(notifRes.count || 0)

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
  const auraInfo = AURA_CONFIG[auraLevel]
  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = profile?.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`
  const tier = isUltra ? 'ultra' : isPro ? 'pro' : 'free'

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
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: theme.text.tertiary }]}>{greeting},</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text.primary }]}>{firstName}</Text>
            <TierBadge tier={tier} />
          </View>
          <Text style={[styles.motivation, { color: theme.text.tertiary }]}>"{motivation}"</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
            style={[styles.notifBtn, { backgroundColor: theme.bg.elevated }]}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.text.secondary} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: theme.accent }]}>
                <Text style={[styles.notifBadgeText, { color: theme.text.onAccent }]}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
            <View style={[styles.avatarWrap, { borderColor: auraInfo?.glow ? theme.accent : theme.border }, auraInfo?.glow && { shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }]}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Aura Banner ── */}
      {auraLevel && auraInfo && (
        <View style={[styles.auraBanner, { backgroundColor: theme.bg.card, borderColor: theme.borderAccent }]}>
          <Text style={styles.auraEmoji}>{auraInfo.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.auraTitle, { color: theme.accent }]}>{auraInfo.label} Aura</Text>
            <Text style={[styles.auraDesc, { color: theme.text.tertiary }]}>{stats.streak} day streak</Text>
          </View>
          <Text style={[styles.auraStreak, { color: theme.accent }]}>🔥 {stats.streak}</Text>
        </View>
      )}

      {/* ── Quick Stats ── */}
      <View style={styles.statRow}>
        <StatBox icon="💪" value={stats.total} label={t('dashboard_workouts')} />
        <StatBox icon="⚡" value={stats.streak} label={t('dashboard_day_streak')} />
        <StatBox icon="🏋️" value={formatVolume(stats.volume, unit)} label="Volume" />
      </View>

      {/* ── Today's Workout ── */}
      <Card glow={!isRestDay} accent={!isRestDay}>
        <CardLabel accent={!isRestDay}>{isRestDay ? '😴 REST DAY' : '🎯 TODAY\'S WORKOUT'}</CardLabel>
        {isRestDay ? (
          <View>
            <Text style={[styles.restDayText, { color: theme.text.secondary }]}>
              Recovery day — let your muscles rebuild and grow stronger.
            </Text>
            <View style={styles.restActions}>
              <Button title="Recovery Hub" variant="outline" size="sm" onPress={() => navigation.navigate('Recovery')} style={{ flex: 1 }} />
              <Button title="Home Exercises" variant="ghost" size="sm" onPress={() => navigation.navigate('HomeExercises')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.workoutTitle, { color: theme.text.primary }]}>{todayWorkout?.day_name || 'Workout'}</Text>
            {todayWorkout?.exercises?.length > 0 && (
              <View style={styles.exercisePreview}>
                {todayWorkout.exercises.slice(0, 5).map((e, i) => (
                  <View key={i} style={[styles.exercisePill, { backgroundColor: theme.bg.elevated }]}>
                    <Text style={[styles.exercisePillText, { color: theme.text.secondary }]}>{e.name}</Text>
                  </View>
                ))}
                {todayWorkout.exercises.length > 5 && (
                  <View style={[styles.exercisePill, { backgroundColor: theme.bg.elevated }]}>
                    <Text style={[styles.exercisePillText, { color: theme.text.tertiary }]}>+{todayWorkout.exercises.length - 5}</Text>
                  </View>
                )}
              </View>
            )}
            <Button
              title={startingWorkout ? '' : t('dashboard_start_workout')}
              loading={!!startingWorkout}
              onPress={startWorkout}
              size="lg"
              style={{ marginTop: spacing.lg }}
              icon={!startingWorkout && <Ionicons name="flash" size={18} color={theme.text.onAccent} />}
            />
          </View>
        )}
      </Card>

      {/* ── Quick Actions ── */}
      <View style={styles.quickActions}>
        {[
          { icon: '🏃', label: 'Run', screen: 'RunTracker' },
          { icon: '🧘', label: 'Recovery', screen: 'Recovery' },
          { icon: '🏠', label: 'Home', screen: 'HomeExercises' },
          { icon: '🤖', label: 'AI Coach', screen: 'Coach' },
        ].map((a) => (
          <TouchableOpacity key={a.screen} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.7} style={[styles.quickAction, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            <Text style={styles.quickActionIcon}>{a.icon}</Text>
            <Text style={[styles.quickActionLabel, { color: theme.text.secondary }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Program Info ── */}
      {program && (
        <Card>
          <CardLabel>📋 CURRENT PROGRAM</CardLabel>
          <Text style={[styles.programName, { color: theme.text.primary }]}>{program.name || 'Training Program'}</Text>
          <View style={styles.programMeta}>
            <Badge label={`Week ${program.current_week || 1}`} />
            <Text style={[styles.programSplit, { color: theme.text.tertiary }]}>
              {profile?.preferred_split?.replace('_', '/') || 'Custom'} split
            </Text>
          </View>
        </Card>
      )}

      {/* ── Ultra Insights ── */}
      {isUltra && ultraInsights.length > 0 && (
        <>
          <SectionHeader title="ULTRA INSIGHTS" right={<Badge label="ULTRA" color="#b026ff" />} />
          <View style={styles.insightsGrid}>
            {ultraInsights.map((insight) => (
              <View key={insight.id} style={[styles.insightCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <Text style={[styles.insightTitle, { color: theme.text.tertiary }]}>{insight.title}</Text>
                </View>
                <Text style={[styles.insightValue, { color: theme.accent }]}>{insight.value}</Text>
                <ProgressBar progress={insight.pct} height={3} style={{ marginTop: 6 }} />
                <Text style={[styles.insightNote, { color: theme.text.tertiary }]}>{insight.note}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Recent PRs ── */}
      {recentPRs.length > 0 && (
        <>
          <SectionHeader title="RECENT PRs" right={<TouchableOpacity onPress={() => navigation.navigate('Progress')}><Text style={{ color: theme.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>See all</Text></TouchableOpacity>} />
          <Card>
            {recentPRs.slice(0, 5).map((pr, i) => (
              <View key={pr.id || i} style={[styles.prItem, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.prRank, { backgroundColor: i === 0 ? theme.accent : theme.bg.elevated }]}>
                  <Text style={[styles.prRankText, { color: i === 0 ? theme.text.onAccent : theme.text.tertiary }]}>
                    {i === 0 ? '🏆' : `#${i + 1}`}
                  </Text>
                </View>
                <View style={styles.prBody}>
                  <Text style={[styles.prName, { color: theme.text.primary }]}>{pr.exercise_name}</Text>
                  <Text style={[styles.prDate, { color: theme.text.tertiary }]}>
                    {pr.achieved_at ? new Date(pr.achieved_at).toLocaleDateString() : ''}
                  </Text>
                </View>
                <Text style={[styles.prValue, { color: theme.accent }]}>
                  {formatWeight(pr.weight, unit)}{weightLabel(unit)} × {pr.reps}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* ── Run Tracker ── */}
      <Card onPress={() => navigation.navigate('RunTracker')}>
        <View style={styles.promoCard}>
          <Text style={styles.promoEmoji}>🏃‍♂️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, { color: theme.text.primary }]}>{t('dashboard_run_beta')}</Text>
            <Text style={[styles.promoDesc, { color: theme.text.tertiary }]}>{t('dashboard_run_beta_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
        </View>
      </Card>

      {/* ── Discord ── */}
      <Card onPress={() => Linking.openURL('https://discord.gg/repmax')}>
        <View style={styles.promoCard}>
          <Text style={styles.promoEmoji}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, { color: theme.text.primary }]}>{t('dashboard_discord_title')}</Text>
            <Text style={[styles.promoDesc, { color: theme.text.tertiary }]}>{t('dashboard_discord_body')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
        </View>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  greeting: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 0.3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  name: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8 },
  motivation: { fontSize: fontSize.xs, marginTop: 6, fontStyle: 'italic', lineHeight: 16 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  notifBadgeText: { fontSize: 10, fontWeight: fontWeight.black },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  auraBanner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.md, gap: spacing.sm },
  auraEmoji: { fontSize: 24 },
  auraTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  auraDesc: { fontSize: fontSize.xs, marginTop: 1 },
  auraStreak: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  restDayText: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.sm },
  restActions: { flexDirection: 'row', gap: spacing.sm },
  workoutTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  exercisePreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  exercisePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  exercisePillText: { fontSize: 12, fontWeight: fontWeight.medium },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickAction: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  quickActionIcon: { fontSize: 22, marginBottom: 4 },
  quickActionLabel: { fontSize: 11, fontWeight: fontWeight.semibold },
  programName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  programSplit: { fontSize: fontSize.sm },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  insightCard: { width: '47.5%', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  insightIcon: { fontSize: 14 },
  insightTitle: { fontSize: 10, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black, letterSpacing: -0.5 },
  insightNote: { fontSize: 10, marginTop: 4 },
  prItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: spacing.sm },
  prRank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 12, fontWeight: fontWeight.bold },
  prBody: { flex: 1 },
  prName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  prDate: { fontSize: 10, marginTop: 1 },
  prValue: { fontSize: fontSize.sm, fontWeight: fontWeight.black },
  promoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promoEmoji: { fontSize: 28 },
  promoTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  promoDesc: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
})
