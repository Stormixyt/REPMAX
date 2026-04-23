import { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, RefreshControl, Alert, TextInput, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { formatWeight, weightLabel } from '../../lib/units'
import { Badge, Button, Card, EmptyState, Input, PageHeader, ProgressBar, SectionHeader, Pill, PressableScale, Kicker } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState('crews')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [crews, setCrews] = useState([])
  const [prWall, setPrWall] = useState([])
  const [streaks, setStreaks] = useState([])
  const [flexFeed, setFlexFeed] = useState([])
  const [showCreateCrew, setShowCreateCrew] = useState(false)
  const [crewName, setCrewName] = useState('')
  const [crewType, setCrewType] = useState('split')
  const [crewDescription, setCrewDescription] = useState('')
  const [crewSaving, setCrewSaving] = useState(false)
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

  async function createCrew() {
    const name = crewName.trim()
    if (!name) {
      Alert.alert('Name required', 'Give your crew a name.')
      return
    }
    setCrewSaving(true)
    try {
      const { data, error } = await supabase.from('communities').insert({
        name,
        type: crewType,
        description: crewDescription.trim() || null,
        created_by: user.id,
      }).select().single()

      if (error) throw error

      // Add creator as member
      if (data?.id) {
        await supabase.from('community_members').insert({
          community_id: data.id,
          user_id: user.id,
          role: 'owner',
        }).catch(() => {}) // table may not exist yet
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setShowCreateCrew(false)
      setCrewName('')
      setCrewType('split')
      setCrewDescription('')
      await loadData()
    } catch (err) {
      console.error('Create crew error:', err)
      Alert.alert('Error', 'Could not create crew. Try again.')
    } finally {
      setCrewSaving(false)
    }
  }

  function renderContent() {
    if (tab === 'crews') {
      return (
        <>
          <Button
            title="Create a Crew"
            onPress={() => setShowCreateCrew(true)}
            icon={<Ionicons name="add-circle-outline" size={16} color={theme.text.onAccent} />}
            style={{ marginBottom: spacing.md }}
          />
          {crews.length === 0 ? (
            <EmptyState icon="👥" title="No crews yet" description="Be the first to create one!" />
          ) : (
            crews.map((crew, i) => (
              <View key={crew.id || i} style={[styles.crewCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.crewName, { color: theme.text.primary }]}>{crew.name}</Text>
                  {!!crew.description && <Text style={[styles.crewDesc, { color: theme.text.secondary }]} numberOfLines={2}>{crew.description}</Text>}
                  <Text style={[styles.crewMeta, { color: theme.text.tertiary }]}>{crew.type || 'Community'}</Text>
                </View>
                <Badge label={crew.type === 'gym' ? 'GYM' : crew.type === 'city' ? 'CITY' : 'SPLIT'} color={theme.accent} />
              </View>
            ))
          )}
        </>
      )
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
          <ProgressBar progress={c.progress / 100} color={theme.accent} style={{ marginTop: spacing.md }} />
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.pageKicker, { color: theme.text.tertiary }]}>COMMUNITY</Text>
        <Text style={[styles.pageName, { color: theme.text.primary }]}>Crews &amp; Ladders</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabContent}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <PressableScale key={t.id} onPress={() => setTab(t.id)} haptic="light">
              <View style={[
                styles.tabBtn,
                {
                  backgroundColor: active ? theme.accent : theme.bg.card,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}>
                <Ionicons name={t.icon} size={14} color={active ? theme.text.onAccent : theme.text.secondary} />
                <Text style={[styles.tabLabel, { color: active ? theme.text.onAccent : theme.text.secondary }]}>{t.label}</Text>
              </View>
            </PressableScale>
          )
        })}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : renderContent()}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCreateCrew} animationType="slide" transparent onRequestClose={() => setShowCreateCrew(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Create a Crew</Text>
                <Text style={[styles.modalSubtitle, { color: theme.text.tertiary }]}>Build your training community.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateCrew(false)}>
                <Ionicons name="close" size={22} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            <Input label="Crew Name" value={crewName} onChangeText={setCrewName} placeholder="e.g. Morning Lifters" maxLength={50} />
            <Input label="Description (optional)" value={crewDescription} onChangeText={setCrewDescription} placeholder="What's this crew about?" maxLength={200} />

            <Text style={[styles.typeLabel, { color: theme.text.secondary }]}>Type</Text>
            <View style={styles.typeRow}>
              {[
                { id: 'split', label: 'Split', icon: 'barbell-outline' },
                { id: 'gym', label: 'Gym', icon: 'fitness-outline' },
                { id: 'city', label: 'City', icon: 'location-outline' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setCrewType(t.id)}
                  style={[styles.typeChip, {
                    backgroundColor: crewType === t.id ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: crewType === t.id ? theme.accent : theme.border,
                  }]}
                >
                  <Ionicons name={t.icon} size={16} color={crewType === t.id ? theme.accent : theme.text.secondary} />
                  <Text style={[styles.typeChipText, { color: crewType === t.id ? theme.text.primary : theme.text.secondary }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button title="Create Crew" onPress={createCrew} loading={crewSaving} disabled={!crewName.trim()} style={{ marginTop: spacing.lg }} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  pageKicker: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.6 },
  pageName: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8, marginTop: 4 },
  pageTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  tabRow: { maxHeight: 48, marginBottom: spacing.md },
  tabContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1 },
  tabLabel: { fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.2 },
  bodyContent: { paddingHorizontal: spacing.xl },
  crewCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  crewName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  crewDesc: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  modalTitle: { fontSize: 22, fontWeight: fontWeight.black },
  modalSubtitle: { fontSize: fontSize.sm, marginTop: 4 },
  typeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md },
  typeChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
})
