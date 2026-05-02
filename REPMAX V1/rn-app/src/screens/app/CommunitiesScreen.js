import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { formatWeight, weightLabel } from '../../lib/units'
import { Badge, EmptyState } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const TABS = [
  { id: 'crews', label: 'Crews', icon: 'people' },
  { id: 'prwall', label: 'PR Wall', icon: 'trophy' },
  { id: 'challenges', label: 'Challenges', icon: 'flag' },
  { id: 'streaks', label: 'Elite Streaks', icon: 'flame' },
  { id: 'flex', label: 'Flex Feed', icon: 'sparkles' },
]

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function CommunitiesScreen() {
  const { user, profile, isPro, isUltra } = useAuth()
  const { theme } = useTheme()
  const [tab, setTab] = useState('crews')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [crews, setCrews] = useState([])
  const [prWall, setPrWall] = useState([])
  const [streaks, setStreaks] = useState([])
  const [flexFeed, setFlexFeed] = useState([])
  const unit = profile?.unit_preference || 'kg'

  useEffect(() => { loadData() }, [tab])

  async function loadData() {
    setLoading(true)
    try {
      if (tab === 'crews') {
        const { data } = await supabase.from('communities').select('*').limit(30)
        setCrews(data || [])
      } else if (tab === 'prwall') {
        const { data } = await supabase.from('personal_records').select('*, profiles!inner(display_name, image_url, subscription_tier)')
          .order('estimated_1rm', { ascending: false }).limit(50)
        setPrWall(data || [])
      } else if (tab === 'streaks') {
        const { data } = await supabase.from('profiles').select('id, display_name, image_url, current_streak, subscription_tier')
          .gt('current_streak', 0).order('current_streak', { ascending: false }).limit(50)
        setStreaks(data || [])
      } else if (tab === 'flex') {
        const { data } = await supabase.from('personal_records').select('*, profiles!inner(display_name)')
          .order('achieved_at', { ascending: false }).limit(30)
        setFlexFeed(data || [])
      }
    } catch (err) {
      console.error('Communities load error:', err)
    }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await loadData(); setRefreshing(false) }

  function renderContent() {
    if (tab === 'crews') {
      if (crews.length === 0) return <EmptyState icon="👥" title="No crews yet" description="Crews appear as community grows." />
      return crews.map((crew, i) => (
        <View key={crew.id || i} style={[styles.crewCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.crewName, { color: theme.text.primary }]}>{crew.name}</Text>
            <Text style={[styles.crewMeta, { color: theme.text.tertiary }]}>{crew.type || 'Community'}</Text>
          </View>
          <Badge label={crew.type === 'gym' ? 'GYM' : crew.type === 'city' ? 'CITY' : 'SPLIT'} color={theme.accent} />
        </View>
      ))
    }
    if (tab === 'prwall') {
      if (prWall.length === 0) return <EmptyState icon="🏆" title="No PRs yet" description="Complete workouts to appear on the wall." />
      return prWall.map((pr, i) => (
        <View key={pr.id || i} style={[styles.leaderRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.rank, { color: i < 3 ? theme.accent : theme.text.tertiary }]}>#{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.leaderName, { color: theme.text.primary }]}>{pr.profiles?.display_name || 'Athlete'}</Text>
            <Text style={[styles.leaderSub, { color: theme.text.secondary }]}>{pr.exercise_name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.leaderWeight, { color: theme.accent }]}>{formatWeight(pr.weight, unit)} {weightLabel(unit)}</Text>
            <Text style={[styles.leaderSub, { color: theme.text.tertiary }]}>x{pr.reps}</Text>
          </View>
        </View>
      ))
    }
    if (tab === 'challenges') {
      const challenges = [
        { title: '7-Day Streak', desc: 'Train 7 consecutive days', progress: Math.min(100, ((profile?.current_streak || 0) / 7) * 100) },
        { title: 'Volume King', desc: 'Hit 50k total volume this month', progress: 45 },
        { title: 'PR Hunter', desc: 'Set 5 new PRs this month', progress: 60 },
      ]
      return challenges.map((c, i) => (
        <View key={i} style={[styles.challengeCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <Text style={[styles.challengeTitle, { color: theme.text.primary }]}>{c.title}</Text>
          <Text style={[styles.challengeDesc, { color: theme.text.tertiary }]}>{c.desc}</Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.bg.elevated }]}>
            <View style={[styles.progressFill, { width: `${c.progress}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.challengePct, { color: theme.text.secondary }]}>{Math.round(c.progress)}%</Text>
        </View>
      ))
    }
    if (tab === 'streaks') {
      if (streaks.length === 0) return <EmptyState icon="🔥" title="No streaks" description="Start training to climb ranks." />
      return streaks.map((s, i) => (
        <View key={s.id || i} style={[styles.leaderRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.rank, { color: i < 3 ? theme.accent : theme.text.tertiary }]}>{i === 0 ? '👑' : `#${i + 1}`}</Text>
          <Text style={[styles.leaderName, { color: theme.text.primary, flex: 1 }]}>{s.display_name || 'Athlete'}</Text>
          <Text style={[styles.streakVal, { color: theme.accent }]}>{s.current_streak}🔥</Text>
        </View>
      ))
    }
    if (flexFeed.length === 0) return <EmptyState icon="✨" title="No flex yet" description="PRs and milestones show here." />
    return flexFeed.map((item, i) => (
      <View key={item.id || i} style={[styles.flexCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
        <View style={styles.flexHeader}>
          <Text style={[styles.flexName, { color: theme.text.primary }]}>{item.profiles?.display_name || 'Athlete'}</Text>
          <Text style={[styles.flexTime, { color: theme.text.tertiary }]}>{formatRelative(item.achieved_at)}</Text>
        </View>
        <Text style={[styles.flexBody, { color: theme.text.secondary }]}>
          New PR: {item.exercise_name} — {formatWeight(item.weight, unit)} {weightLabel(unit)} x {item.reps}
        </Text>
      </View>
    ))
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: theme.text.primary }]}>Communities</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabContent}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tabBtn, { backgroundColor: tab === t.id ? theme.accent : theme.bg.elevated }]}
            onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={14} color={tab === t.id ? theme.text.onAccent : theme.text.secondary} />
            <Text style={[styles.tabLabel, { color: tab === t.id ? theme.text.onAccent : theme.text.secondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : renderContent()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.sm },
  pageTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  tabRow: { maxHeight: 44, marginBottom: spacing.sm },
  tabContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full },
  tabLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  bodyContent: { paddingHorizontal: spacing.xl },
  crewCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  crewName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  crewMeta: { fontSize: fontSize.xs, marginTop: 2 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, gap: spacing.md },
  rank: { fontSize: fontSize.md, fontWeight: fontWeight.black, width: 36 },
  leaderName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  leaderSub: { fontSize: fontSize.xs },
  leaderWeight: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  streakVal: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  challengeCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  challengeTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  challengeDesc: { fontSize: fontSize.xs, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: spacing.md },
  progressFill: { height: '100%', borderRadius: 3 },
  challengePct: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 4, textAlign: 'right' },
  flexCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  flexHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  flexName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  flexTime: { fontSize: fontSize.xs },
  flexBody: { fontSize: fontSize.sm, lineHeight: 20 },
})
