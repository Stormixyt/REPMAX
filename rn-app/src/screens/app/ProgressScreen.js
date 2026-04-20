import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { formatVolume, formatWeight, weightLabel } from '../../lib/units'
import { Card, CardLabel, CardTitle, EmptyState, PageHeader, StatBox, SegmentedControl, SectionHeader, ProgressBar, Badge } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const TABS = ['Overview', 'PRs', 'Muscles', 'History']

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ProgressScreen() {
  const { user, profile } = useAuth()
  const { theme } = useTheme()
  const [prs, setPRs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const mounted = useRef(true)

  const unit = profile?.unit_preference || 'lbs'

  useEffect(() => {
    mounted.current = true
    loadProgress()
    return () => { mounted.current = false }
  }, [user?.id])

  async function loadProgress() {
    if (!user?.id) return
    try {
      const [prRes, workoutRes] = await Promise.all([
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }),
        supabase.from('workouts').select('*').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(60),
      ])
      if (!mounted.current) return
      setPRs(prRes.data || [])
      setWorkouts(workoutRes.data || [])
    } catch (error) {
      console.error('Progress load error:', error)
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false) }
    }
  }

  function onRefresh() { setRefreshing(true); loadProgress() }

  const derived = useMemo(() => {
    const totalVolume = workouts.reduce((s, w) => s + (Number(w.total_volume) || 0), 0)
    const totalSec = workouts.reduce((s, w) => s + (Number(w.duration_seconds) || 0), 0)
    const avgMin = workouts.length > 0 ? Math.round(totalSec / workouts.length / 60) : 0

    const bestPRs = Object.values(
      prs.reduce((acc, pr) => {
        const ex = acc[pr.exercise_name]
        if (!ex || (Number(pr.estimated_1rm) || 0) > (Number(ex.estimated_1rm) || 0)) acc[pr.exercise_name] = pr
        return acc
      }, {})
    ).sort((a, b) => (Number(b.estimated_1rm) || 0) - (Number(a.estimated_1rm) || 0))

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const heatmapDays = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (29 - i))
      const count = workouts.filter(w => w.completed_at && sameDay(new Date(w.completed_at), date)).length
      return { key: date.toISOString(), label: date.toLocaleDateString('en', { weekday: 'narrow' }), dayNum: date.getDate(), count }
    })

    const wvMap = new Map()
    workouts.forEach(w => {
      if (!w.completed_at) return
      const wk = startOfWeek(new Date(w.completed_at)).toISOString().slice(0, 10)
      wvMap.set(wk, (wvMap.get(wk) || 0) + (Number(w.total_volume) || 0))
    })
    const weeklyVolume = Array.from(wvMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([k, v]) => ({
      key: k, shortLabel: new Date(k).toLocaleDateString('en', { month: 'short', day: 'numeric' }), volume: v,
    }))

    const recentDurations = workouts.slice(0, 10).map(w => ({
      key: w.id, label: w.completed_at ? new Date(w.completed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—',
      minutes: Math.round((Number(w.duration_seconds) || 0) / 60),
    })).reverse()

    const recentWindow = new Date()
    recentWindow.setDate(recentWindow.getDate() - 28)
    const recentWorkouts = workouts.filter(w => w.completed_at && new Date(w.completed_at) > recentWindow)
    const plannedDays = (profile?.training_days || []).length || 3
    const expected = plannedDays * 4
    const consistency = expected > 0 ? Math.min(100, Math.round((recentWorkouts.length / expected) * 100)) : 0

    const muscleDistribution = workouts.reduce((acc, w) => {
      const d = String(w.day_name || '').toLowerCase()
      let k = 'Other'
      if (d.includes('push') || d.includes('chest')) k = 'Push'
      else if (d.includes('pull') || d.includes('back')) k = 'Pull'
      else if (d.includes('leg')) k = 'Legs'
      else if (d.includes('upper')) k = 'Upper'
      else if (d.includes('lower')) k = 'Lower'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    // Volume trend — compare last 2 weeks
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const weekOneVol = workouts.filter(w => w.completed_at && new Date(w.completed_at) >= twoWeeksAgo && new Date(w.completed_at) < oneWeekAgo).reduce((s, w) => s + (Number(w.total_volume) || 0), 0)
    const weekTwoVol = workouts.filter(w => w.completed_at && new Date(w.completed_at) >= oneWeekAgo).reduce((s, w) => s + (Number(w.total_volume) || 0), 0)
    const volumeTrend = weekOneVol > 0 ? Math.round(((weekTwoVol - weekOneVol) / weekOneVol) * 100) : 0

    return { totalVolume, avgMin, bestPRs, heatmapDays, weeklyVolume, recentDurations, consistency, recentCount: recentWorkouts.length, expected, muscleDistribution, volumeTrend }
  }, [prs, profile?.training_days, unit, workouts])

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Loading your progress...</Text>
      </View>
    )
  }

  const view = TABS[tabIndex].toLowerCase()

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Your Progress" subtitle="Strength, consistency, and training history." />

      {!workouts.length ? (
        <EmptyState title="No data yet" description="Finish your first workout and REPMAX will start building your trendline." icon="📊" />
      ) : (
        <>
          {/* Stat Row */}
          <View style={styles.statRow}>
            <StatBox icon="🏋️" value={String(workouts.length)} label="Workouts" trend={derived.volumeTrend !== 0 ? (derived.volumeTrend > 0 ? 'up' : 'down') : undefined} />
            <StatBox icon="📦" value={formatVolume(derived.totalVolume, unit)} label={`${weightLabel(unit)} Total`} />
            <StatBox icon="⏱" value={`${derived.avgMin}m`} label="Avg Duration" />
          </View>

          {/* Consistency */}
          <Card>
            <View style={styles.consistencyHeader}>
              <View style={{ flex: 1 }}>
                <CardLabel>CONSISTENCY</CardLabel>
                <Text style={[styles.consistencyMeta, { color: theme.text.secondary }]}>
                  {derived.recentCount} / {derived.expected} sessions · last 4 weeks
                </Text>
              </View>
              <Text style={[styles.consistencyScore, { color: derived.consistency >= 80 ? theme.accent : derived.consistency >= 50 ? theme.warning : theme.danger }]}>
                {derived.consistency}%
              </Text>
            </View>
            <ProgressBar progress={derived.consistency / 100} color={derived.consistency >= 80 ? theme.accent : derived.consistency >= 50 ? theme.warning : theme.danger} style={{ marginTop: spacing.md }} />
          </Card>

          {/* Tab Bar */}
          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <SegmentedControl options={TABS} selectedIndex={tabIndex} onChange={setTabIndex} />
          </View>

          {/* Overview Tab */}
          {view === 'overview' && (
            <>
              <SectionHeader title="LAST 30 DAYS" />
              <Card>
                <View style={styles.heatmapGrid}>
                  {derived.heatmapDays.map((day) => {
                    let bg = theme.bg.elevated
                    if (day.count === 1) bg = theme.accentGlowStrong
                    if (day.count >= 2) bg = theme.accent
                    return (
                      <View key={day.key} style={styles.heatmapCellWrap}>
                        <View style={[styles.heatmapCell, { backgroundColor: bg }]} />
                        <Text style={[styles.heatmapDayNum, { color: theme.text.tertiary }]}>{day.dayNum}</Text>
                      </View>
                    )
                  })}
                </View>
              </Card>

              <View style={styles.statRow}>
                <StatBox icon="🔥" value={`${profile?.current_streak || 0}`} label="Current Streak" />
                <StatBox icon="🏆" value={String(profile?.longest_streak || 0)} label="Best Streak" />
              </View>

              {!!derived.weeklyVolume.length && (
                <>
                  <SectionHeader title="WEEKLY VOLUME" right={<Badge label="Last 8 weeks" />} />
                  <Card>
                    <View style={styles.chart}>
                      {derived.weeklyVolume.map((item) => {
                        const max = Math.max(...derived.weeklyVolume.map(e => e.volume), 1)
                        const height = Math.max(8, (item.volume / max) * 120)
                        return (
                          <View key={item.key} style={styles.chartBarGroup}>
                            <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>{formatVolume(item.volume, unit)}</Text>
                            <View style={[styles.chartBar, { height, backgroundColor: theme.accent }]} />
                            <Text style={[styles.chartBottomLabel, { color: theme.text.tertiary }]} numberOfLines={1}>{item.shortLabel}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </Card>
                </>
              )}

              {!!derived.recentDurations.length && (
                <>
                  <SectionHeader title="DURATION TREND" />
                  <Card>
                    <View style={styles.chart}>
                      {derived.recentDurations.map((item) => {
                        const max = Math.max(...derived.recentDurations.map(e => e.minutes), 1)
                        const height = Math.max(8, (item.minutes / max) * 100)
                        return (
                          <View key={item.key} style={styles.chartBarGroup}>
                            <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>{item.minutes}</Text>
                            <View style={[styles.chartBar, { height, backgroundColor: theme.info }]} />
                            <Text style={[styles.chartBottomLabel, { color: theme.text.tertiary }]} numberOfLines={1}>{item.label}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </Card>
                </>
              )}
            </>
          )}

          {/* PRs Tab */}
          {view === 'prs' && (
            derived.bestPRs.length ? (
              <>
                <SectionHeader title={`${derived.bestPRs.length} PERSONAL RECORDS`} />
                {derived.bestPRs.map((pr) => (
                  <Card key={pr.id} style={styles.listCard}>
                    <View style={styles.rowBetween}>
                      <View style={styles.prLeft}>
                        <View style={[styles.prBadge, { backgroundColor: theme.accentGlowStrong }]}>
                          <Ionicons name="trophy" size={16} color={theme.accent} />
                        </View>
                        <View style={styles.prCopy}>
                          <Text style={[styles.listTitle, { color: theme.text.primary }]}>{pr.exercise_name}</Text>
                          <Text style={[styles.listMeta, { color: theme.text.secondary }]}>
                            {formatWeight(pr.weight, unit)} {weightLabel(unit)} × {pr.reps} reps
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rightAlign}>
                        <Text style={[styles.pr1rm, { color: theme.accent }]}>{formatWeight(pr.estimated_1rm, unit)} {weightLabel(unit)}</Text>
                        <Text style={[styles.listMeta, { color: theme.text.tertiary }]}>{pr.achieved_at ? new Date(pr.achieved_at).toLocaleDateString() : '—'}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            ) : (
              <EmptyState title="No PRs yet" description="Keep logging sessions and REPMAX will surface your best lifts here." icon="🏆" />
            )
          )}

          {/* Muscles Tab */}
          {view === 'muscles' && (
            Object.keys(derived.muscleDistribution).length ? (
              <>
                <SectionHeader title="TRAINING SPLIT BALANCE" />
                <Card>
                  {Object.entries(derived.muscleDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => {
                      const maxC = Math.max(...Object.values(derived.muscleDistribution), 1)
                      const colorMap = { Push: '#ef4444', Pull: '#3b82f6', Legs: '#22c55e', Upper: '#f59e0b', Lower: '#8b5cf6', Other: theme.text.tertiary }
                      return (
                        <View key={name} style={styles.muscleRow}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.listTitle, { color: theme.text.primary }]}>{name}</Text>
                            <Text style={[styles.listMeta, { color: theme.text.secondary }]}>{count} sessions</Text>
                          </View>
                          <ProgressBar progress={count / maxC} color={colorMap[name]} style={{ marginTop: spacing.xs }} />
                        </View>
                      )
                    })}
                </Card>
              </>
            ) : (
              <EmptyState title="No split data" description="Complete a few sessions and REPMAX will map how your training is distributed." icon="💪" />
            )
          )}

          {/* History Tab */}
          {view === 'history' && (
            <>
              <SectionHeader title={`${workouts.length} COMPLETED SESSIONS`} />
              {workouts.map((w) => (
                <Card key={w.id} style={styles.listCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listTitle, { color: theme.text.primary }]}>{w.day_name || 'Workout'}</Text>
                      <Text style={[styles.listMeta, { color: theme.text.secondary }]}>
                        {w.completed_at ? new Date(w.completed_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Completed'}
                      </Text>
                    </View>
                    <View style={styles.rightAlign}>
                      <Text style={[styles.historyVolume, { color: theme.accent }]}>{formatVolume(w.total_volume || 0, unit)} {weightLabel(unit)}</Text>
                      <Text style={[styles.listMeta, { color: theme.text.tertiary }]}>{Math.round((Number(w.duration_seconds) || 0) / 60)} min</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xxxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  consistencyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  consistencyMeta: { fontSize: fontSize.sm, lineHeight: 18, marginTop: 2 },
  consistencyScore: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heatmapCellWrap: { width: '14%', minWidth: 36, alignItems: 'center', gap: 3 },
  heatmapCell: { width: 22, height: 22, borderRadius: 6 },
  heatmapDayNum: { fontSize: 9 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  chartBarGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 150 },
  chartBar: { width: '100%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, minHeight: 8 },
  chartTopLabel: { fontSize: 10, marginBottom: spacing.xs },
  chartBottomLabel: { fontSize: 10, marginTop: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  listCard: { marginHorizontal: spacing.xl, marginBottom: spacing.sm },
  prLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  prBadge: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  prCopy: { flex: 1 },
  listTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  listMeta: { fontSize: fontSize.sm, marginTop: 2 },
  pr1rm: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
  rightAlign: { alignItems: 'flex-end' },
  muscleRow: { marginTop: spacing.md },
  historyVolume: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
})
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { formatVolume, formatWeight, weightLabel } from '../../lib/units'
import { Card, CardLabel, CardTitle, EmptyState, PageHeader, StatBox } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const TABS = ['overview', 'prs', 'muscles', 'history']

function startOfWeek(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ProgressScreen() {
  const { user, profile } = useAuth()
  const { theme } = useTheme()
  const [prs, setPRs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState('overview')
  const mounted = useRef(true)

  const unit = profile?.unit_preference || 'lbs'

  useEffect(() => {
    mounted.current = true
    loadProgress()
    return () => {
      mounted.current = false
    }
  }, [user?.id])

  async function loadProgress() {
    if (!user?.id) return

    try {
      const [prRes, workoutRes] = await Promise.all([
        supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', user.id)
          .order('achieved_at', { ascending: false }),
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(60),
      ])

      if (!mounted.current) return

      setPRs(prRes.data || [])
      setWorkouts(workoutRes.data || [])
    } catch (error) {
      console.error('Progress load error:', error)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    loadProgress()
  }

  const derived = useMemo(() => {
    const totalVolume = workouts.reduce((sum, workout) => sum + (Number(workout.total_volume) || 0), 0)
    const totalDurationSeconds = workouts.reduce((sum, workout) => sum + (Number(workout.duration_seconds) || 0), 0)
    const avgDurationMinutes = workouts.length > 0 ? Math.round(totalDurationSeconds / workouts.length / 60) : 0

    const bestPRs = Object.values(
      prs.reduce((acc, pr) => {
        const existing = acc[pr.exercise_name]
        if (!existing || (Number(pr.estimated_1rm) || 0) > (Number(existing.estimated_1rm) || 0)) {
          acc[pr.exercise_name] = pr
        }
        return acc
      }, {})
    ).sort((a, b) => (Number(b.estimated_1rm) || 0) - (Number(a.estimated_1rm) || 0))

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const heatmapDays = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (29 - index))
      const count = workouts.filter((workout) => {
        if (!workout.completed_at) return false
        return sameDay(new Date(workout.completed_at), date)
      }).length

      return {
        key: date.toISOString(),
        label: date.toLocaleDateString('en', { weekday: 'narrow' }),
        count,
      }
    })

    const weeklyVolumeMap = new Map()
    workouts.forEach((workout) => {
      if (!workout.completed_at) return
      const week = startOfWeek(new Date(workout.completed_at))
      const key = week.toISOString().slice(0, 10)
      weeklyVolumeMap.set(key, (weeklyVolumeMap.get(key) || 0) + (Number(workout.total_volume) || 0))
    })

    const weeklyVolume = Array.from(weeklyVolumeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, volume]) => ({
        key,
        shortLabel: new Date(key).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        volume,
      }))

    const recentDurations = workouts
      .slice(0, 10)
      .map((workout) => ({
        key: workout.id,
        label: workout.completed_at
          ? new Date(workout.completed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          : '—',
        minutes: Math.round((Number(workout.duration_seconds) || 0) / 60),
      }))
      .reverse()

    const recentWindow = new Date()
    recentWindow.setDate(recentWindow.getDate() - 28)
    const recentWorkouts = workouts.filter((workout) => workout.completed_at && new Date(workout.completed_at) > recentWindow)
    const plannedDays = (profile?.training_days || []).length || 3
    const expectedSessions = plannedDays * 4
    const consistencyScore = expectedSessions > 0
      ? Math.min(100, Math.round((recentWorkouts.length / expectedSessions) * 100))
      : 0

    const muscleDistribution = workouts.reduce((acc, workout) => {
      const dayName = String(workout.day_name || '').toLowerCase()
      let key = 'Other'
      if (dayName.includes('push') || dayName.includes('chest')) key = 'Push'
      else if (dayName.includes('pull') || dayName.includes('back')) key = 'Pull'
      else if (dayName.includes('leg')) key = 'Legs'
      else if (dayName.includes('upper')) key = 'Upper'
      else if (dayName.includes('lower')) key = 'Lower'

      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return {
      totalVolume,
      avgDurationMinutes,
      bestPRs,
      heatmapDays,
      weeklyVolume,
      recentDurations,
      consistencyScore,
      recentWorkoutsCount: recentWorkouts.length,
      expectedSessions,
      muscleDistribution,
    }
  }, [prs, profile?.training_days, unit, workouts])

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Loading your progress...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Your Progress" subtitle="Strength, consistency, and training history in one place." />

      {!workouts.length ? (
        <EmptyState title="No data yet" description="Finish your first workout and REPMAX will start building your trendline." icon="📊" />
      ) : (
        <>
          <View style={styles.statRow}>
            <StatBox value={String(workouts.length)} label="Workouts" />
            <StatBox value={formatVolume(derived.totalVolume, unit)} label={`${weightLabel(unit)} Total`} />
            <StatBox value={`${derived.avgDurationMinutes}m`} label="Avg Duration" />
          </View>

          <Card>
            <View style={styles.consistencyHeader}>
              <View style={styles.consistencyCopy}>
                <CardLabel>Weekly Consistency</CardLabel>
                <Text style={[styles.consistencyMeta, { color: theme.text.secondary }]}>
                  {derived.recentWorkoutsCount} / {derived.expectedSessions} planned sessions in the last 4 weeks
                </Text>
              </View>
              <Text
                style={[
                  styles.consistencyScore,
                  {
                    color: derived.consistencyScore >= 80
                      ? theme.accent
                      : derived.consistencyScore >= 50
                        ? theme.warning
                        : theme.danger,
                  },
                ]}
              >
                {derived.consistencyScore}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.bg.elevated }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${derived.consistencyScore}%`,
                    backgroundColor: derived.consistencyScore >= 80
                      ? theme.accent
                      : derived.consistencyScore >= 50
                        ? theme.warning
                        : theme.danger,
                  },
                ]}
              />
            </View>
          </Card>

          <View style={[styles.tabBar, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            {TABS.map((tab) => {
              const active = view === tab
              return (
                <TouchableOpacity
                  key={tab}
                  activeOpacity={0.85}
                  onPress={() => setView(tab)}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active ? theme.accent : 'transparent',
                      borderColor: active ? theme.accent : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.tabLabel, { color: active ? theme.text.onAccent : theme.text.secondary }]}>
                    {tab === 'prs' ? 'PRs' : tab[0].toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {view === 'overview' && (
            <>
              <Card>
                <CardLabel>Last 30 Days</CardLabel>
                <CardTitle>Activity Heatmap</CardTitle>
                <View style={styles.heatmapGrid}>
                  {derived.heatmapDays.map((day) => {
                    let backgroundColor = theme.bg.elevated
                    if (day.count === 1) backgroundColor = theme.accentGlowStrong
                    if (day.count >= 2) backgroundColor = theme.accent

                    return (
                      <View key={day.key} style={styles.heatmapCellWrap}>
                        <View style={[styles.heatmapCell, { backgroundColor }]} />
                        <Text style={[styles.heatmapLabel, { color: theme.text.tertiary }]}>{day.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </Card>

              <View style={styles.statRow}>
                <StatBox value={`${profile?.current_streak || 0}🔥`} label="Current Streak" />
                <StatBox value={String(profile?.longest_streak || 0)} label="Best Streak" />
              </View>

              {!!derived.weeklyVolume.length && (
                <Card>
                  <CardLabel>Weekly Volume</CardLabel>
                  <CardTitle>Last 8 Weeks</CardTitle>
                  <View style={styles.chart}>
                    {derived.weeklyVolume.map((item) => {
                      const max = Math.max(...derived.weeklyVolume.map((entry) => entry.volume), 1)
                      const height = Math.max(8, (item.volume / max) * 120)
                      return (
                        <View key={item.key} style={styles.chartBarGroup}>
                          <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>
                            {formatVolume(item.volume, unit)}
                          </Text>
                          <View style={[styles.chartBar, { height, backgroundColor: theme.accent }]} />
                          <Text style={[styles.chartBottomLabel, { color: theme.text.tertiary }]} numberOfLines={1}>
                            {item.shortLabel}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </Card>
              )}

              {!!derived.recentDurations.length && (
                <Card>
                  <CardLabel>Duration Trends</CardLabel>
                  <CardTitle>Recent Sessions</CardTitle>
                  <View style={styles.chart}>
                    {derived.recentDurations.map((item) => {
                      const max = Math.max(...derived.recentDurations.map((entry) => entry.minutes), 1)
                      const height = Math.max(8, (item.minutes / max) * 100)
                      return (
                        <View key={item.key} style={styles.chartBarGroup}>
                          <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>{item.minutes}</Text>
                          <View style={[styles.chartBar, { height, backgroundColor: theme.info }]} />
                          <Text style={[styles.chartBottomLabel, { color: theme.text.tertiary }]} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </Card>
              )}
            </>
          )}

          {view === 'prs' && (
            derived.bestPRs.length ? (
              derived.bestPRs.map((pr) => (
                <Card key={pr.id} style={styles.listCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.prLeft}>
                      <View style={[styles.prBadge, { backgroundColor: theme.accentGlowStrong }]}>
                        <Ionicons name="trophy" size={16} color={theme.text.onAccent} />
                      </View>
                      <View style={styles.prCopy}>
                        <Text style={[styles.listTitle, { color: theme.text.primary }]}>{pr.exercise_name}</Text>
                        <Text style={[styles.listMeta, { color: theme.text.secondary }]}>
                          {formatWeight(pr.weight, unit)} {weightLabel(unit)} × {pr.reps} reps
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rightAlign}>
                      <Text style={[styles.pr1rm, { color: theme.accent }]}>
                        {formatWeight(pr.estimated_1rm, unit)} {weightLabel(unit)}
                      </Text>
                      <Text style={[styles.listMeta, { color: theme.text.tertiary }]}>
                        {pr.achieved_at ? new Date(pr.achieved_at).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <EmptyState title="No PRs yet" description="Keep logging sessions and REPMAX will surface your best lifts here." icon="🏆" />
            )
          )}

          {view === 'muscles' && (
            Object.keys(derived.muscleDistribution).length ? (
              <Card>
                <CardLabel>Training Distribution</CardLabel>
                <CardTitle>Workout Split Balance</CardTitle>
                {Object.entries(derived.muscleDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => {
                    const maxCount = Math.max(...Object.values(derived.muscleDistribution), 1)
                    const width = `${(count / maxCount) * 100}%`
                    const colorMap = {
                      Push: '#ef4444',
                      Pull: '#3b82f6',
                      Legs: '#22c55e',
                      Upper: '#f59e0b',
                      Lower: '#8b5cf6',
                      Other: theme.text.tertiary,
                    }

                    return (
                      <View key={name} style={styles.muscleRow}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.listTitle, { color: theme.text.primary }]}>{name}</Text>
                          <Text style={[styles.listMeta, { color: theme.text.secondary }]}>{count} sessions</Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.bg.elevated }]}>
                          <View style={[styles.progressFill, { width, backgroundColor: colorMap[name] }]} />
                        </View>
                      </View>
                    )
                  })}
              </Card>
            ) : (
              <EmptyState title="No split data" description="Complete a few sessions and REPMAX will map how your training is distributed." icon="💪" />
            )
          )}

          {view === 'history' && (
            workouts.map((workout) => (
              <Card key={workout.id} style={styles.listCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.historyLeft}>
                    <Text style={[styles.listTitle, { color: theme.text.primary }]}>{workout.day_name || 'Workout'}</Text>
                    <Text style={[styles.listMeta, { color: theme.text.secondary }]}>
                      {workout.completed_at
                        ? new Date(workout.completed_at).toLocaleDateString('en', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Completed'}
                    </Text>
                  </View>
                  <View style={styles.rightAlign}>
                    <Text style={[styles.historyVolume, { color: theme.accent }]}>
                      {formatVolume(workout.total_volume || 0, unit)} {weightLabel(unit)}
                    </Text>
                    <Text style={[styles.listMeta, { color: theme.text.tertiary }]}>
                      {Math.round((Number(workout.duration_seconds) || 0) / 60)} min
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  consistencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  consistencyCopy: {
    flex: 1,
  },
  consistencyMeta: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  consistencyScore: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heatmapCellWrap: {
    width: '14%',
    minWidth: 36,
    alignItems: 'center',
    gap: 4,
  },
  heatmapCell: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  heatmapLabel: {
    fontSize: 10,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chartBarGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 150,
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    minHeight: 8,
  },
  chartTopLabel: {
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  chartBottomLabel: {
    fontSize: 10,
    marginTop: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  listCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  prLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  prBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prCopy: {
    flex: 1,
  },
  listTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  listMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  pr1rm: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  muscleRow: {
    marginTop: spacing.md,
  },
  historyLeft: {
    flex: 1,
  },
  historyVolume: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
  },
})
