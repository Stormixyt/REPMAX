import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Button, Card, CardLabel, CardTitle, PageHeader, StatBox } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const STATUS_OPTIONS = ['🔥', '💪', '⚡', '🎯', '😴', '🏃', '🍗', '🧠']

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

function prettifyThemeName(themeName) {
  return String(themeName || 'green')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildDiceBearUrl(seed) {
  return `https://api.dicebear.com/7.x/micah/png?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`
}

export default function ProfileScreen() {
  const navigation = useNavigation()
  const { user, profile, isPro, isUltra, updateProfile } = useAuth()
  const { theme } = useTheme()
  const [stats, setStats] = useState({ workouts: profile?.total_workouts || 0, prCount: 0, totalVolume: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bioDraft, setBioDraft] = useState(profile?.bio || '')
  const [savingBio, setSavingBio] = useState(false)
  const mounted = useRef(true)

  const avatarUrl = profile?.image_url || buildDiceBearUrl(profile?.avatar_seed || user?.id || 'repmax')

  useEffect(() => {
    mounted.current = true
    setBioDraft(profile?.bio || '')
    loadProfileStats()
    return () => {
      mounted.current = false
    }
  }, [user?.id, profile?.bio])

  async function loadProfileStats() {
    if (!user?.id) return

    try {
      const [workoutRes, prRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, total_volume, completed_at')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),
        supabase
          .from('personal_records')
          .select('id')
          .eq('user_id', user.id),
      ])

      if (!mounted.current) return

      const workoutRows = workoutRes.data || []
      const totalVolume = workoutRows.reduce((sum, row) => sum + (Number(row.total_volume) || 0), 0)

      setStats({
        workouts: workoutRows.length || profile?.total_workouts || 0,
        prCount: (prRes.data || []).length,
        totalVolume,
        workoutRows,
      })
    } catch (error) {
      console.error('Profile stats error:', error)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    loadProfileStats()
  }

  async function selectStatus(emoji) {
    Haptics.selectionAsync().catch(() => {})
    await updateProfile({ status_emoji: emoji })
  }

  async function saveBio() {
    const nextBio = bioDraft.trim()
    if (nextBio === (profile?.bio || '')) return

    setSavingBio(true)
    try {
      await updateProfile({ bio: nextBio })
    } finally {
      if (mounted.current) setSavingBio(false)
    }
  }

  const badgeState = useMemo(() => {
    const workoutRows = stats.workoutRows || []
    const hasEarlyBird = workoutRows.some((row) => {
      const hour = new Date(row.completed_at).getHours()
      return hour < 8
    })
    const hasNightOwl = workoutRows.some((row) => {
      const hour = new Date(row.completed_at).getHours()
      return hour >= 21
    })

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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Profile" subtitle="Your identity, streaks, and earned status inside REPMAX." />

      <Card style={[styles.heroCard, { backgroundColor: theme.bg.secondary }]}>
        <View style={styles.heroTop}>
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: isPro ? theme.accent : theme.border }]} />
          <View style={styles.heroCopy}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text.primary }]}>{profile?.display_name || 'Athlete'}</Text>
              {(isPro || isUltra) && (
                <View style={[styles.tierBadge, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.tierBadgeText, { color: theme.text.onAccent }]}>{isUltra ? 'ULTRA' : 'PRO'}</Text>
                </View>
              )}
            </View>
            {!!profile?.username && (
              <Text style={[styles.username, { color: theme.accent }]}>@{profile.username}</Text>
            )}
            <Text style={[styles.email, { color: theme.text.secondary }]}>{user?.email}</Text>
          </View>
        </View>

        <CardLabel>Status</CardLabel>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((emoji) => {
            const active = profile?.status_emoji === emoji
            return (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.85}
                onPress={() => selectStatus(emoji)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={styles.statusEmoji}>{emoji}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <CardLabel>Bio</CardLabel>
        <View style={[styles.bioWrap, { backgroundColor: theme.bg.input, borderColor: theme.border }]}>
          <TextInput
            multiline
            value={bioDraft}
            onChangeText={setBioDraft}
            onBlur={saveBio}
            placeholder="Tell the crew what you’re building."
            placeholderTextColor={theme.text.tertiary}
            style={[styles.bioInput, { color: theme.text.primary }]}
            maxLength={150}
          />
          <View style={styles.bioFooter}>
            <Text style={[styles.bioCount, { color: theme.text.tertiary }]}>{bioDraft.length}/150</Text>
            {savingBio && <ActivityIndicator size="small" color={theme.accent} />}
          </View>
        </View>
      </Card>

      <View style={styles.statRow}>
        <StatBox value={String(stats.workouts)} label="Workouts" />
        <StatBox value={String(profile?.current_streak || 0)} label="Current Streak" />
        <StatBox value={String(profile?.longest_streak || 0)} label="Longest Streak" />
      </View>

      <Card>
        <CardLabel>Identity</CardLabel>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>Theme</Text>
          <Text style={[styles.infoValue, { color: theme.text.primary }]}>{prettifyThemeName(theme.themeName)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>Preferred Split</Text>
          <Text style={[styles.infoValue, { color: theme.text.primary }]}>
            {profile?.preferred_split ? String(profile.preferred_split).replaceAll('_', ' ').toUpperCase() : 'Not set'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>Tier</Text>
          <Text style={[styles.infoValue, { color: theme.text.primary }]}>{isUltra ? 'ULTRA' : isPro ? 'PRO' : 'FREE'}</Text>
        </View>
      </Card>

      <Card>
        <CardLabel>Badges</CardLabel>
        <CardTitle>Achievement Stack</CardTitle>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge) => {
            const earned = badgeState[badge.key]
            return (
              <View
                key={badge.key}
                style={[
                  styles.badgeCard,
                  {
                    backgroundColor: earned ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: earned ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={[styles.badgeIcon, { opacity: earned ? 1 : 0.45 }]}>{badge.icon}</Text>
                <Text style={[styles.badgeName, { color: earned ? theme.text.primary : theme.text.tertiary }]}>{badge.name}</Text>
              </View>
            )
          })}
        </View>
      </Card>

      <View style={styles.actionButtons}>
        <Button
          title="Open Settings"
          variant="secondary"
          onPress={() => navigation.navigate('Settings')}
          icon={<Ionicons name="settings-outline" size={16} color={theme.text.primary} />}
          style={styles.actionButton}
        />
        <Button
          title="Subscription"
          onPress={() => navigation.navigate('Subscription')}
          icon={<Ionicons name="diamond-outline" size={16} color={theme.text.onAccent} />}
          style={styles.actionButton}
        />
      </View>
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
  heroCard: {
    marginHorizontal: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    borderWidth: 3,
  },
  heroCopy: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
  },
  tierBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tierBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
  },
  username: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  email: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusChip: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusEmoji: {
    fontSize: 20,
  },
  bioWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bioInput: {
    minHeight: 70,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  bioFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  bioCount: {
    fontSize: fontSize.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.sm,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    maxWidth: '55%',
    textAlign: 'right',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  badgeCard: {
    width: '23%',
    minWidth: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    lineHeight: 13,
  },
  actionButtons: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
})
