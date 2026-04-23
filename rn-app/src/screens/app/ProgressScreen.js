import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { formatVolume, formatWeight, weightLabel } from '../../lib/units'
import { Card, HeroCard, CardLabel, CardTitle, EmptyState, PageHeader, StatBox, SegmentedControl, SectionHeader, ProgressBar, Badge, Kicker, Pill, RingProgress } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
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
  const insets = useSafeAreaInsets()
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

  const consistencyColor = derived.consistency >= 80 ? theme.accent : derived.consistency >= 50 ? theme.warning : theme.danger

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.pageKicker, { color: theme.text.tertiary }]}>PROGRESS</Text>
          <Text style={[styles.pageName, { color: theme.text.primary }]}>Trends &amp; PRs</Text>
        </View>
      </View>

      {!workouts.length ? (
        <EmptyState title="No data yet" description="Finish your first workout and REPMAX will start building your trendline." icon="📊" />
      ) : (
        <>
          {/* Consistency hero ring */}
          <HeroCard tint={consistencyColor} style={{ marginHorizontal: spacing.xl }}>
            <View style={styles.consistencyHeroRow}>
              <RingProgress
                progress={derived.consistency / 100}
                size={120}
                strokeWidth={10}
                color={consistencyColor}
              >
                <Text style={[styles.ringValue, { color: theme.text.primary }]}>{derived.consistency}%</Text>
                <Text style={[styles.ringLabel, { color: theme.text.tertiary }]}>CONSISTENCY</Text>
              </RingProgress>
              <View style={{ flex: 1, gap: 6 }}>
                <Kicker label="Last 4 Weeks" color={consistencyColor} />
                <Text style={[styles.consistencyMeta, { color: theme.text.primary }]}>
                  {derived.recentCount}<Text style={{ color: theme.text.tertiary }}> / {derived.expected}</Text>
                </Text>
                <Text style={[styles.consistencySub, { color: theme.text.secondary }]}>
                  sessions completed against your target.
                </Text>
              </View>
            </View>
          </HeroCard>

          {/* Stat Row */}
          <View style={styles.statRow}>
            <StatBox icon="🏋️" value={String(workouts.length)} label="Workouts" />
            <StatBox icon="📦" value={formatVolume(derived.totalVolume, unit)} label={`${weightLabel(unit)} Total`} />
            <StatBox icon="⏱" value={`${derived.avgMin}m`} label="Avg Duration" />
          </View>

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
                  <SectionHeader title="WEEKLY VOLUME" right={<Pill label="Last 8 weeks" />} />
                  <Card style={styles.chartCard}>
                    <View style={styles.chart}>
                      {derived.weeklyVolume.map((item) => {
                        const max = Math.max(...derived.weeklyVolume.map(e => e.volume), 1)
                        const height = Math.max(10, (item.volume / max) * 140)
                        return (
                          <View key={item.key} style={styles.chartBarGroup}>
                            <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>{formatVolume(item.volume, unit)}</Text>
                            <View style={[styles.chartBar, { height }]}>
                              <LinearGradient
                                colors={[theme.accent, `${theme.accent}66`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={StyleSheet.absoluteFill}
                              />
                            </View>
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
                  <Card style={styles.chartCard}>
                    <View style={styles.chart}>
                      {derived.recentDurations.map((item) => {
                        const max = Math.max(...derived.recentDurations.map(e => e.minutes), 1)
                        const height = Math.max(10, (item.minutes / max) * 110)
                        return (
                          <View key={item.key} style={styles.chartBarGroup}>
                            <Text style={[styles.chartTopLabel, { color: theme.text.tertiary }]}>{item.minutes}</Text>
                            <View style={[styles.chartBar, { height }]}>
                              <LinearGradient
                                colors={['#3b82f6', '#3b82f666']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={StyleSheet.absoluteFill}
                              />
                            </View>
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
  content: { paddingBottom: 120 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  pageKicker: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.6 },
  pageName: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  consistencyHeroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringValue: { fontSize: 24, fontWeight: fontWeight.black, letterSpacing: -0.6, lineHeight: 26 },
  ringLabel: { fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1.6, marginTop: 3 },
  consistencyMeta: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8, lineHeight: 30 },
  consistencySub: { fontSize: 13, lineHeight: 18 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heatmapCellWrap: { width: '13%', minWidth: 36, alignItems: 'center', gap: 4 },
  heatmapCell: { width: 26, height: 26, borderRadius: 8 },
  heatmapDayNum: { fontSize: 9 },
  chartCard: { paddingVertical: spacing.lg, marginHorizontal: spacing.xl },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  chartBarGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 160 },
  chartBar: { width: '82%', borderRadius: radius.sm, minHeight: 10, overflow: 'hidden' },
  chartTopLabel: { fontSize: 10, marginBottom: 6, fontWeight: fontWeight.semibold },
  chartBottomLabel: { fontSize: 10, marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  listCard: { marginHorizontal: spacing.xl, marginBottom: spacing.sm },
  prLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  prBadge: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  prCopy: { flex: 1 },
  listTitle: { fontSize: 15, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  listMeta: { fontSize: 12, marginTop: 3 },
  pr1rm: { fontSize: 15, fontWeight: fontWeight.black, letterSpacing: -0.3 },
  rightAlign: { alignItems: 'flex-end' },
  muscleRow: { marginTop: spacing.md },
  historyVolume: { fontSize: 15, fontWeight: fontWeight.black, letterSpacing: -0.3 },
})
