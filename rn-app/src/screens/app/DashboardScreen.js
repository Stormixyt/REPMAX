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
import { Card, HeroCard, CardLabel, StatBox, Button, Badge, IconButton, ProgressBar, SectionHeader, TierBadge, Kicker, Pill, QuickAction, RingProgress, PressableScale } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  const insets = useSafeAreaInsets()
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: theme.text.tertiary }]}>{greeting.toUpperCase()}</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text.primary }]}>{firstName}</Text>
            <TierBadge tier={tier} />
          </View>
        </View>
        <View style={styles.headerRight}>
          <PressableScale onPress={() => navigation.navigate('Notifications')} haptic="light">
            <View style={[styles.iconBtn, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
              <Ionicons name="notifications-outline" size={18} color={theme.text.secondary} />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: theme.accent, borderColor: theme.bg.primary }]}>
                  <Text style={[styles.notifBadgeText, { color: theme.text.onAccent }]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('Profile')} haptic="light">
            <View
              style={[
                styles.avatarWrap,
                { borderColor: auraInfo?.glow ? theme.accent : theme.border },
                auraInfo?.glow && { shadowColor: theme.accent, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
              ]}
            >
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
          </PressableScale>
        </View>
      </View>

      <Text style={[styles.motivation, { color: theme.text.tertiary }]}>"{motivation}"</Text>

      {/* ── Today's Workout — HERO ── */}
      <HeroCard tint={theme.accent} style={{ marginTop: spacing.lg }}>
        <View style={styles.heroTopRow}>
          <Kicker label={isRestDay ? 'Rest Day' : "Today's Training"} color={isRestDay ? theme.text.tertiary : theme.accent} />
          {!isRestDay && todayWorkout?.weekNumber && <Pill label={`Week ${todayWorkout.weekNumber}`} />}
        </View>

        {isRestDay ? (
          <View>
            <Text style={[styles.heroTitle, { color: theme.text.primary }]}>Recovery Day</Text>
            <Text style={[styles.heroSub, { color: theme.text.secondary }]}>
              Let your muscles rebuild. Mobility, sleep, and nutrition today.
            </Text>
            <View style={[styles.heroActions, { marginTop: spacing.lg }]}>
              <Button title="Recovery Hub" variant="outline" size="md" onPress={() => navigation.navigate('Recovery')} style={{ flex: 1 }} icon={<Ionicons name="moon" size={16} color={theme.accent} />} />
              <Button title="Mobility" variant="ghost" size="md" onPress={() => navigation.navigate('HomeExercises')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.heroTitle, { color: theme.text.primary }]}>{todayWorkout?.day_name || 'Workout'}</Text>
            {todayWorkout?.exercises?.length > 0 && (
              <Text style={[styles.heroSub, { color: theme.text.secondary }]}>
                {todayWorkout.exercises.length} exercises · {todayWorkout.exercises.slice(0, 3).map((e) => e.name).join(' · ')}
                {todayWorkout.exercises.length > 3 && ` +${todayWorkout.exercises.length - 3} more`}
              </Text>
            )}
            <Button
              title={startingWorkout ? '' : t('dashboard_start_workout') || 'Start Workout'}
              loading={!!startingWorkout}
              onPress={startWorkout}
              size="lg"
              haptic="medium"
              style={{ marginTop: spacing.xl }}
              icon={!startingWorkout && <Ionicons name="flash" size={18} color={theme.text.onAccent} />}
            />
          </View>
        )}
      </HeroCard>

      {/* ── Quick Stats ── */}
      <View style={styles.statRow}>
        <StatBox icon="💪" value={stats.total} label={t('dashboard_workouts') || 'Workouts'} />
        <StatBox icon="⚡" value={stats.streak} label={t('dashboard_day_streak') || 'Streak'} />
        <StatBox icon="🏋️" value={formatVolume(stats.volume, unit)} label="Volume" />
      </View>

      {/* ── Aura banner — compact, refined ── */}
      {auraLevel && auraInfo && (
        <Card style={{ padding: 0 }}>
          <View style={styles.auraRow}>
            <View style={[styles.auraEmojiShell, { backgroundColor: `${theme.accent}14`, borderColor: theme.borderAccent }]}>
              <Text style={styles.auraEmoji}>{auraInfo.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.auraTitle, { color: theme.text.primary }]}>{auraInfo.label} Aura</Text>
              <Text style={[styles.auraDesc, { color: theme.text.tertiary }]}>Streak is feeding your momentum</Text>
            </View>
            <View style={[styles.auraCount, { backgroundColor: theme.bg.elevated }]}>
              <Text style={[styles.auraCountText, { color: theme.accent }]}>🔥 {stats.streak}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>QUICK ACTIONS</Text>
      <View style={styles.quickActions}>
        <QuickAction icon="walk-outline" label="Run" onPress={() => navigation.navigate('RunTracker')} color="#00d4ff" />
        <QuickAction icon="moon-outline" label="Recovery" onPress={() => navigation.navigate('Recovery')} color="#b026ff" />
        <QuickAction icon="home-outline" label="Home" onPress={() => navigation.navigate('HomeExercises')} color="#ff9f40" />
        <QuickAction icon="sparkles-outline" label="Coach" onPress={() => navigation.navigate('Coach')} />
      </View>

      {/* ── Program Info ── */}
      {program && (
        <Card>
          <View style={styles.programHead}>
            <Kicker label="Current Program" />
            <Pill label={`Week ${program.current_week || 1}`} />
          </View>
          <Text style={[styles.programName, { color: theme.text.primary }]}>{program.name || 'Training Program'}</Text>
          <Text style={[styles.programSplit, { color: theme.text.tertiary }]}>
            {(profile?.preferred_split || 'custom').replace(/_/g, '/').toUpperCase()} split
          </Text>
        </Card>
      )}

      {/* ── Ultra Insights ── */}
      {isUltra && ultraInsights.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Kicker label="ULTRA Insights" color="#b026ff" />
            <Badge label="ULTRA" color="#b026ff" />
          </View>
          <View style={styles.insightsGrid}>
            {ultraInsights.map((insight) => (
              <View key={insight.id} style={[styles.insightCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <Text style={[styles.insightTitle, { color: theme.text.tertiary }]}>{insight.title}</Text>
                </View>
                <Text style={[styles.insightValue, { color: theme.accent }]}>{insight.value}</Text>
                <ProgressBar progress={insight.pct} height={4} style={{ marginTop: 8 }} />
                <Text style={[styles.insightNote, { color: theme.text.tertiary }]}>{insight.note}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Recent PRs ── */}
      {recentPRs.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Kicker label="Recent PRs" />
            <TouchableOpacity onPress={() => navigation.navigate('Progress')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: theme.accent }]}>See all</Text>
            </TouchableOpacity>
          </View>
          <Card style={{ padding: spacing.md }}>
            {recentPRs.slice(0, 5).map((pr, i) => (
              <View key={pr.id || i} style={[styles.prItem, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.prRank, { backgroundColor: i === 0 ? theme.accent : theme.bg.elevated }]}>
                  <Text style={[styles.prRankText, { color: i === 0 ? theme.text.onAccent : theme.text.tertiary }]}>
                    {i === 0 ? '🏆' : `#${i + 1}`}
                  </Text>
                </View>
                <View style={styles.prBody}>
                  <Text style={[styles.prName, { color: theme.text.primary }]} numberOfLines={1}>{pr.exercise_name}</Text>
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
          <View style={[styles.promoIconShell, { backgroundColor: '#00d4ff14', borderColor: '#00d4ff33' }]}>
            <Ionicons name="walk" size={20} color="#00d4ff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, { color: theme.text.primary }]}>{t('dashboard_run_beta') || 'Run Tracker'}</Text>
            <Text style={[styles.promoDesc, { color: theme.text.tertiary }]}>{t('dashboard_run_beta_desc') || 'Track distance, pace, and steps'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.text.tertiary} />
        </View>
      </Card>

      {/* ── Discord ── */}
      <Card onPress={() => Linking.openURL('https://discord.gg/repmax')}>
        <View style={styles.promoCard}>
          <View style={[styles.promoIconShell, { backgroundColor: '#5865f214', borderColor: '#5865f233' }]}>
            <Ionicons name="chatbubbles" size={20} color="#5865f2" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, { color: theme.text.primary }]}>{t('dashboard_discord_title') || 'Join the Discord'}</Text>
            <Text style={[styles.promoDesc, { color: theme.text.tertiary }]}>{t('dashboard_discord_body') || 'Training talk, PRs, and drops'}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={theme.text.tertiary} />
        </View>
      </Card>

      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  name: { fontSize: 34, fontWeight: fontWeight.black, letterSpacing: -1.2, lineHeight: 38 },
  motivation: { fontSize: 13, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, position: 'relative' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2 },
  notifBadgeText: { fontSize: 9, fontWeight: fontWeight.black },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },

  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  heroTitle: { fontSize: 26, fontWeight: fontWeight.black, letterSpacing: -0.8, lineHeight: 30 },
  heroSub: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: spacing.sm },

  auraRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  auraEmojiShell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  auraEmoji: { fontSize: 22 },
  auraTitle: { fontSize: 15, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  auraDesc: { fontSize: 12, marginTop: 2 },
  auraCount: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  auraCountText: { fontSize: 14, fontWeight: fontWeight.extrabold },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  sectionLabel: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  seeAll: { fontSize: 13, fontWeight: fontWeight.bold, letterSpacing: 0.2 },

  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  programHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  programName: { fontSize: 20, fontWeight: fontWeight.black, letterSpacing: -0.4, marginBottom: 4 },
  programSplit: { fontSize: 12, fontWeight: fontWeight.semibold, letterSpacing: 1.2 },

  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  insightCard: { flexGrow: 1, flexBasis: '47%', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  insightIcon: { fontSize: 14 },
  insightTitle: { fontSize: 10, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  insightValue: { fontSize: 22, fontWeight: fontWeight.black, letterSpacing: -0.6 },
  insightNote: { fontSize: 11, marginTop: 6 },

  prItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.md },
  prRank: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 13, fontWeight: fontWeight.black },
  prBody: { flex: 1 },
  prName: { fontSize: 14, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  prDate: { fontSize: 11, marginTop: 2 },
  prValue: { fontSize: 13, fontWeight: fontWeight.black },

  promoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promoIconShell: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  promoTitle: { fontSize: 15, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  promoDesc: { fontSize: 12, marginTop: 3, lineHeight: 16 },
})
