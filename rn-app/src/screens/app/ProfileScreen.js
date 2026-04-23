import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Button, Card, HeroCard, CardLabel, PageHeader, StatBox, Badge, TierBadge, SectionHeader, Divider, Kicker, Pill, PressableScale } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'
import { formatWeight, weightLabel } from '../../lib/units'

const STATUS_OPTIONS = ['🔥', '💪', '⚡', '🎯', '😴', '🏃', '🍗', '🧠']

const LIFT_RECORDS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Pull-Up', 'Barbell Row', 'Dips', 'Romanian Deadlift']

const BADGES = [
  { key: 'first_workout', name: 'First Workout', icon: '🔥' },
  { key: 'streak_7', name: '7-Day Streak', icon: '💪' },
  { key: 'streak_30', name: '30-Day Streak', icon: '🏆' },
  { key: 'workouts_100', name: '100 Workouts', icon: '🎯' },
  { key: 'volume_king', name: 'Volume King', icon: '⚡' },
  { key: 'pr_hunter', name: 'PR Hunter', icon: '🥇' },
  { key: 'early_bird', name: 'Early Bird', icon: '🌅' },
  { key: 'night_owl', name: 'Night Owl', icon: '🌙' },
]

const AURA_LEVELS = [
  { min: 30, name: 'On Fire', emoji: '🔥', color: '#ff6b00' },
  { min: 14, name: 'High Energy', emoji: '⚡', color: '#ccff00' },
  { min: 7, name: 'Building', emoji: '💪', color: '#00d4ff' },
  { min: 3, name: 'Growing', emoji: '🌱', color: '#22c55e' },
  { min: 0, name: 'Dormant', emoji: '💤', color: '#666' },
]

function getAura(streak) {
  return AURA_LEVELS.find(a => streak >= a.min) || AURA_LEVELS[AURA_LEVELS.length - 1]
}

function buildDiceBearUrl(seed) {
  return `https://api.dicebear.com/7.x/micah/png?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`
}

export default function ProfileScreen() {
  const navigation = useNavigation()
  const { user, profile, isPro, isUltra, updateProfile } = useAuth()
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState({ workouts: profile?.total_workouts || 0, prCount: 0, totalVolume: 0 })
  const [liftRecords, setLiftRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bioDraft, setBioDraft] = useState(profile?.bio || '')
  const [savingBio, setSavingBio] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const mounted = useRef(true)

  const unit = profile?.unit_preference || 'kg'
  const avatarUrl = profile?.image_url || buildDiceBearUrl(profile?.avatar_seed || user?.id || 'repmax')
  const tier = isUltra ? 'ultra' : isPro ? 'pro' : 'free'
  const streak = profile?.current_streak || 0
  const aura = getAura(streak)

  useEffect(() => {
    mounted.current = true
    setBioDraft(profile?.bio || '')
    loadProfileStats()
    return () => { mounted.current = false }
  }, [user?.id, profile?.bio])

  async function loadProfileStats() {
    if (!user?.id) return
    try {
      const [workoutRes, prRes, liftRes] = await Promise.all([
        supabase.from('workouts').select('id, total_volume, completed_at').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('personal_records').select('id').eq('user_id', user.id),
        supabase.from('personal_records').select('exercise_name, weight, reps, estimated_1rm').eq('user_id', user.id).order('estimated_1rm', { ascending: false }),
      ])
      if (!mounted.current) return

      const workoutRows = workoutRes.data || []
      const totalVolume = workoutRows.reduce((sum, row) => sum + (Number(row.total_volume) || 0), 0)

      const lifts = {}
      ;(liftRes.data || []).forEach(pr => {
        const name = pr.exercise_name
        const matchedLift = LIFT_RECORDS.find(l => name.toLowerCase().includes(l.toLowerCase().split(' ')[0].toLowerCase()))
        if (matchedLift && (!lifts[matchedLift] || pr.estimated_1rm > lifts[matchedLift].estimated_1rm)) {
          lifts[matchedLift] = pr
        }
      })
      setLiftRecords(lifts)

      setStats({ workouts: workoutRows.length || profile?.total_workouts || 0, prCount: (prRes.data || []).length, totalVolume, workoutRows })
    } catch (error) {
      console.error('Profile stats error:', error)
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false) }
    }
  }

  function onRefresh() { setRefreshing(true); loadProfileStats() }

  async function selectStatus(emoji) {
    Haptics.selectionAsync().catch(() => {})
    await updateProfile({ status_emoji: emoji })
  }

  async function saveBio() {
    const nextBio = bioDraft.trim()
    if (nextBio === (profile?.bio || '')) return
    setSavingBio(true)
    try { await updateProfile({ bio: nextBio }) } finally { if (mounted.current) setSavingBio(false) }
  }

  async function submitFeedback() {
    if (!feedbackText.trim()) return
    setSendingFeedback(true)
    try {
      await supabase.from('feedback').insert({ user_id: user.id, message: feedbackText.trim(), source: 'mobile_app' })
      setFeedbackText('')
      setShowFeedback(false)
      Alert.alert('Thank you!', 'Your feedback has been submitted.')
    } catch (err) {
      Alert.alert('Error', 'Could not submit feedback. Try again.')
    } finally { if (mounted.current) setSendingFeedback(false) }
  }

  async function regenerateProgram() {
    Alert.alert('Regenerate Program', 'This will create a new AI-generated program based on your current profile. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        onPress: async () => {
          setRegenerating(true)
          try {
            await supabase.from('programs').update({ active: false }).eq('user_id', user.id).eq('active', true)
            await updateProfile({ onboarded: false })
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
          } catch (err) {
            Alert.alert('Error', 'Could not regenerate program.')
          } finally { if (mounted.current) setRegenerating(false) }
        },
      },
    ])
  }

  const badgeState = useMemo(() => {
    const workoutRows = stats.workoutRows || []
    const hasEarlyBird = workoutRows.some(row => new Date(row.completed_at).getHours() < 8)
    const hasNightOwl = workoutRows.some(row => new Date(row.completed_at).getHours() >= 21)
    return {
      first_workout: stats.workouts >= 1,
      streak_7: (profile?.longest_streak || 0) >= 7,
      streak_30: (profile?.longest_streak || 0) >= 30,
      workouts_100: stats.workouts >= 100,
      volume_king: stats.totalVolume >= 100000,
      pr_hunter: stats.prCount >= 5,
      early_bird: hasEarlyBird,
      night_owl: hasNightOwl,
    }
  }, [profile?.longest_streak, stats.prCount, stats.totalVolume, stats.workoutRows, stats.workouts])

  const earnedBadges = BADGES.filter(b => badgeState[b.key]).length

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageKicker, { color: theme.text.tertiary }]}>PROFILE</Text>
          <Text style={[styles.pageName, { color: theme.text.primary }]}>Your signal</Text>
        </View>
        <PressableScale onPress={() => navigation.navigate('Settings')} haptic="light">
          <View style={[styles.iconBtn, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            <Ionicons name="settings-outline" size={18} color={theme.text.secondary} />
          </View>
        </PressableScale>
      </View>

      {/* Hero Card */}
      <HeroCard tint={aura.color} style={{ marginHorizontal: spacing.xl }}>
        <View style={styles.heroTop}>
          <View style={[
            styles.avatarRing,
            {
              borderColor: aura.color,
              shadowColor: aura.color,
              shadowOpacity: streak >= 7 ? 0.5 : 0,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
              elevation: streak >= 7 ? 10 : 0,
            },
          ]}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>{profile?.display_name || 'Athlete'}</Text>
              <TierBadge tier={tier} />
            </View>
            {!!profile?.username && <Text style={[styles.username, { color: theme.accent }]}>@{profile.username}</Text>}
            <Text style={[styles.email, { color: theme.text.tertiary }]} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        {/* Aura Level */}
        <View style={[styles.auraRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}>
          <View style={[styles.auraShell, { backgroundColor: `${aura.color}14`, borderColor: `${aura.color}33` }]}>
            <Text style={styles.auraEmoji}>{aura.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.auraName, { color: aura.color }]}>{aura.name} Aura</Text>
            <Text style={[styles.auraStreak, { color: theme.text.tertiary }]}>{streak} day streak</Text>
          </View>
          <Pill label={`LVL ${Math.min(5, Math.floor(streak / 7) + 1)}`} color={aura.color} />
        </View>

        {/* Status */}
        <Kicker label="Status" style={{ marginBottom: spacing.sm }} />
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((emoji) => {
            const active = profile?.status_emoji === emoji
            return (
              <PressableScale key={emoji} onPress={() => selectStatus(emoji)} haptic="light">
                <View style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: active ? theme.accent : theme.border,
                  },
                  active && { shadowColor: theme.accent, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
                ]}>
                  <Text style={styles.statusEmoji}>{emoji}</Text>
                </View>
              </PressableScale>
            )
          })}
        </View>

        {/* Bio */}
        <Kicker label="Bio" style={{ marginBottom: spacing.sm }} />
        <View style={[styles.bioWrap, { backgroundColor: theme.bg.input, borderColor: theme.border }]}>
          <TextInput multiline value={bioDraft} onChangeText={setBioDraft} onBlur={saveBio}
            placeholder="Tell the crew what you're building." placeholderTextColor={theme.text.tertiary}
            style={[styles.bioInput, { color: theme.text.primary }]} maxLength={150} />
          <View style={styles.bioFooter}>
            <Text style={[styles.bioCount, { color: theme.text.tertiary }]}>{bioDraft.length}/150</Text>
            {savingBio && <ActivityIndicator size="small" color={theme.accent} />}
          </View>
        </View>
      </HeroCard>

      {/* Stats Row */}
      <View style={styles.statRow}>
        <StatBox icon="💪" value={String(stats.workouts)} label="Workouts" />
        <StatBox icon="🔥" value={String(streak)} label="Streak" />
        <StatBox icon="🏆" value={String(profile?.longest_streak || 0)} label="Best" />
      </View>

      {/* Lift Records */}
      <SectionHeader title="LIFT RECORDS" right={<Badge label={`${Object.keys(liftRecords).length}/${LIFT_RECORDS.length}`} />} />
      <Card>
        {LIFT_RECORDS.map((lift, i) => {
          const record = liftRecords[lift]
          return (
            <View key={lift} style={[styles.liftRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.liftInfo}>
                <Text style={[styles.liftName, { color: record ? theme.text.primary : theme.text.tertiary }]}>{lift}</Text>
                {record ? (
                  <Text style={[styles.liftDetail, { color: theme.text.tertiary }]}>
                    {formatWeight(record.weight, unit)} {weightLabel(unit)} × {record.reps} · e1RM: {formatWeight(record.estimated_1rm, unit, 0)}
                  </Text>
                ) : (
                  <Text style={[styles.liftDetail, { color: theme.text.tertiary }]}>No record yet</Text>
                )}
              </View>
              {record && <Text style={[styles.liftValue, { color: theme.accent }]}>{formatWeight(record.estimated_1rm, unit, 0)}</Text>}
            </View>
          )
        })}
      </Card>

      {/* Badges */}
      <SectionHeader title="BADGES" right={<Pill label={`${earnedBadges}/${BADGES.length}`} />} />
      <View style={styles.badgeGridOuter}>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge) => {
            const earned = badgeState[badge.key]
            return (
              <View key={badge.key} style={[
                styles.badgeCard,
                {
                  backgroundColor: theme.bg.card,
                  borderColor: earned ? theme.accent : theme.border,
                },
                earned && {
                  shadowColor: theme.accent,
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                },
              ]}>
                {earned && (
                  <LinearGradient
                    colors={[`${theme.accent}20`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                )}
                <Text style={[styles.badgeIcon, { opacity: earned ? 1 : 0.25 }]}>{badge.icon}</Text>
                <Text style={[styles.badgeName, { color: earned ? theme.text.primary : theme.text.tertiary }]}>{badge.name}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Identity */}
      <SectionHeader title="IDENTITY" />
      <Card>
        {[
          { label: 'Theme', value: String(profile?.theme_color || 'green').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') },
          { label: 'Split', value: profile?.preferred_split ? String(profile.preferred_split).replaceAll('_', '/').toUpperCase() : 'Not set' },
          { label: 'Tier', value: isUltra ? 'ULTRA' : isPro ? 'PRO' : 'FREE' },
          { label: 'Total Volume', value: `${stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(0)}k` : stats.totalVolume} ${weightLabel(unit)}` },
        ].map((info, i) => (
          <View key={i} style={[styles.infoRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>{info.label}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>{info.value}</Text>
          </View>
        ))}
      </Card>

      {/* Actions */}
      <View style={styles.actionSection}>
        <Button title="Regenerate AI Program" variant="outline" onPress={regenerateProgram} loading={regenerating}
          icon={<Ionicons name="refresh" size={16} color={theme.accent} />} style={styles.actionBtn} />
        <Button title={showFeedback ? 'Cancel' : 'Send Feedback'} variant="ghost" onPress={() => setShowFeedback(!showFeedback)}
          icon={<Ionicons name="chatbubble-outline" size={16} color={theme.text.secondary} />} style={styles.actionBtn} />
        {showFeedback && (
          <View style={[styles.feedbackBox, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            <TextInput multiline value={feedbackText} onChangeText={setFeedbackText}
              placeholder="What could we improve?" placeholderTextColor={theme.text.tertiary}
              style={[styles.feedbackInput, { color: theme.text.primary, backgroundColor: theme.bg.input, borderColor: theme.border }]} maxLength={500} />
            <Button title="Submit" onPress={submitFeedback} loading={sendingFeedback} disabled={!feedbackText.trim()} size="sm" style={{ marginTop: spacing.sm }} />
          </View>
        )}
        <Divider />
        <Button title="Open Settings" variant="secondary" onPress={() => navigation.navigate('Settings')}
          icon={<Ionicons name="settings-outline" size={16} color={theme.text.primary} />} style={styles.actionBtn} />
        <Button title="Subscription" onPress={() => navigation.navigate('Subscription')}
          icon={<Ionicons name="diamond-outline" size={16} color={theme.text.onAccent} />} style={styles.actionBtn} />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 120 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  pageKicker: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.6 },
  pageName: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8, marginTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heroTop: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  heroCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { fontSize: 26, fontWeight: fontWeight.black, letterSpacing: -0.8, lineHeight: 30, maxWidth: '80%' },
  username: { fontSize: 14, fontWeight: fontWeight.bold, marginTop: 4 },
  email: { fontSize: 12, marginTop: 2 },
  auraRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg, gap: spacing.md },
  auraShell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  auraEmoji: { fontSize: 22 },
  auraName: { fontSize: 14, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  auraStreak: { fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  statusChip: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusEmoji: { fontSize: 20 },
  bioWrap: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bioInput: { minHeight: 60, fontSize: fontSize.md, textAlignVertical: 'top', lineHeight: 20 },
  bioFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  bioCount: { fontSize: 11, letterSpacing: 0.4 },
  statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.sm, marginTop: spacing.md },
  liftRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  liftInfo: { flex: 1 },
  liftName: { fontSize: 14, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  liftDetail: { fontSize: 11, marginTop: 3 },
  liftValue: { fontSize: 17, fontWeight: fontWeight.black, letterSpacing: -0.3 },
  badgeGridOuter: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { width: '22.8%', minWidth: 70, borderWidth: 1, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: 'center', overflow: 'hidden' },
  badgeIcon: { fontSize: 26, marginBottom: 6 },
  badgeName: { fontSize: 9, fontWeight: fontWeight.bold, textAlign: 'center', lineHeight: 12, letterSpacing: 0.2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  infoLabel: { fontSize: 13, fontWeight: fontWeight.medium },
  infoValue: { fontSize: 13, fontWeight: fontWeight.bold, maxWidth: '55%', textAlign: 'right' },
  actionSection: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  actionBtn: { marginBottom: spacing.sm },
  feedbackBox: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  feedbackInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },
})
