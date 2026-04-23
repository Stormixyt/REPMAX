import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { themes } from '../../theme/colors'
import { invokeServerApi, supabase } from '../../lib/supabase'
import { Button, Card, CardLabel, Input, PageHeader, SectionHeader, Divider } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const SKIN_OPTIONS = [
  { key: 'default', label: 'Default', requiredTier: 'free' },
  { key: 'v5', label: 'V5', requiredTier: 'pro' },
  { key: 'v6', label: 'V6', requiredTier: 'pro' },
  { key: 'ultra-signature', label: 'Ultra Signature', requiredTier: 'ultra' },
]

function tierAllows(requiredTier, { isPro, isUltra }) {
  if (requiredTier === 'free') return true
  if (requiredTier === 'pro') return isPro || isUltra
  return isUltra
}

function formatPermission(status) {
  if (!status) return 'Unknown'
  if (status === 'granted') return 'Allowed'
  if (status === 'denied') return 'Blocked'
  if (status === 'undetermined') return 'Ask first'
  return status
}

export default function SettingsScreen() {
  const navigation = require('@react-navigation/native').useNavigation()
  const mounted = useRef(true)
  const { user, profile, isPro, isUltra, signOut, updateProfile } = useAuth()
  const { language, setLanguage, languageOptions } = useLanguage()
  const { theme, setThemeName, setSkin } = useTheme()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [pushStatus, setPushStatus] = useState('unknown')
  const [loadingPush, setLoadingPush] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [exporting, setExporting] = useState(false)

  const themeOptions = useMemo(
    () => Object.entries(themes).map(([key, value]) => ({ key, color: value.accent })),
    []
  )

  useEffect(() => {
    mounted.current = true
    setDisplayName(profile?.display_name || '')
    refreshPushStatus()
    return () => {
      mounted.current = false
    }
  }, [profile?.display_name])

  async function refreshPushStatus() {
    setLoadingPush(true)
    try {
      const permission = await Notifications.getPermissionsAsync()
      if (mounted.current) setPushStatus(permission.status)
    } catch (error) {
      console.error('Push permission read error:', error)
    } finally {
      if (mounted.current) {
        setLoadingPush(false)
        setRefreshing(false)
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    refreshPushStatus()
  }

  async function saveDisplayName() {
    const nextName = displayName.trim()
    if (!nextName || nextName === (profile?.display_name || '')) return

    setSavingName(true)
    try {
      await updateProfile({ display_name: nextName })
    } finally {
      if (mounted.current) setSavingName(false)
    }
  }

  async function chooseTheme(themeName) {
    Haptics.selectionAsync().catch(() => {})
    setThemeName(themeName)
    await updateProfile({ theme_color: themeName })
  }

  async function chooseLanguage(value) {
    const normalized = setLanguage(value)
    await updateProfile({ language: normalized })
  }

  async function toggleUnits() {
    const current = profile?.unit_preference || profile?.units || 'lbs'
    const next = current === 'kg' ? 'lbs' : 'kg'
    await updateProfile({ unit_preference: next, units: next })
  }

  async function requestPushPermission() {
    try {
      const permission = await Notifications.requestPermissionsAsync()
      setPushStatus(permission.status)
    } catch (error) {
      console.error('Push permission request error:', error)
    }
  }

  async function chooseSkin(option) {
    if (!tierAllows(option.requiredTier, { isPro, isUltra })) {
      Alert.alert(
        'Upgrade required',
        option.requiredTier === 'ultra'
          ? 'Ultra Signature is reserved for ULTRA members.'
          : 'This interface skin unlocks with PRO.'
      )
      return
    }

    Haptics.selectionAsync().catch(() => {})
    setSkin(option.key)
    await updateProfile({ interface_skin: option.key })
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your REPMAX account, workouts, and profile data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await invokeServerApi('/api/delete-account', {}, { timeoutMs: 20000, requireAuth: true })
              await signOut()
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Could not delete this account.')
            }
          },
        },
      ]
    )
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      Alert.alert('Done', 'Password updated successfully.')
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not change password.')
    } finally { if (mounted.current) setSavingPassword(false) }
  }

  async function exportData() {
    setExporting(true)
    try {
      const [workoutsRes, prsRes, logsRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('personal_records').select('*').eq('user_id', user.id),
        supabase.from('food_logs').select('*').eq('user_id', user.id),
      ])
      const summary = {
        exported_at: new Date().toISOString(),
        workouts: (workoutsRes.data || []).length,
        personal_records: (prsRes.data || []).length,
        food_logs: (logsRes.data || []).length,
      }
      Alert.alert('Data Export', `Workouts: ${summary.workouts}\nPRs: ${summary.personal_records}\nFood logs: ${summary.food_logs}\n\nFull CSV export coming soon.`)
    } catch (err) {
      Alert.alert('Error', 'Could not export your data.')
    } finally { if (mounted.current) setExporting(false) }
  }

  function reRunOnboarding() {
    Alert.alert('Re-run Onboarding', 'This will take you through the setup flow again to regenerate your program.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: async () => {
        await updateProfile({ onboarded: false })
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
      }},
    ])
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Settings" subtitle="Control the way REPMAX looks, feels, and syncs on your phone." />

      <Card>
        <CardLabel>Account</CardLabel>
        <Input
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Athlete name"
          autoCapitalize="words"
        />
        <Text style={[styles.email, { color: theme.text.secondary }]}>{user?.email}</Text>
        <Button
          title="Save Name"
          onPress={saveDisplayName}
          loading={savingName}
          icon={<Ionicons name="checkmark" size={16} color={theme.text.onAccent} />}
          style={styles.topButton}
        />
      </Card>

      <Card>
        <CardLabel>Theme</CardLabel>
        <View style={styles.themeRow}>
          {themeOptions.map((option) => {
            const active = theme.themeName === option.key
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.85}
                onPress={() => chooseTheme(option.key)}
                style={[
                  styles.themeDotWrap,
                  {
                    borderColor: active ? option.color : theme.border,
                    backgroundColor: active ? `${option.color}14` : 'transparent',
                  },
                ]}
              >
                <View style={[
                  styles.themeDot,
                  { backgroundColor: option.color, shadowColor: option.color },
                  active && { shadowOpacity: 0.8, shadowRadius: 10 },
                ]} />
                <Text style={[styles.themeText, { color: active ? theme.text.primary : theme.text.tertiary }]}>
                  {option.key}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </Card>

      <Card>
        <CardLabel>Language</CardLabel>
        <View style={styles.optionList}>
          {languageOptions.map((option) => {
            const active = language === option.value
            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.85}
                onPress={() => chooseLanguage(option.value)}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={[styles.optionLabel, { color: active ? theme.text.primary : theme.text.secondary }]}>
                  {option.nativeLabel}
                </Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
              </TouchableOpacity>
            )
          })}
        </View>
      </Card>

      <Card>
        <CardLabel>Training</CardLabel>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={toggleUnits}
          style={[styles.infoCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}
        >
          <View>
            <Text style={[styles.infoTitle, { color: theme.text.primary }]}>Units</Text>
            <Text style={[styles.infoSubtitle, { color: theme.text.secondary }]}>
              {(profile?.unit_preference || profile?.units || 'lbs').toUpperCase()}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={20} color={theme.accent} />
        </TouchableOpacity>
      </Card>

      <Card>
        <CardLabel>Notifications</CardLabel>
        <View style={[styles.infoCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border }]}>
          <View style={styles.pushCopy}>
            <Text style={[styles.infoTitle, { color: theme.text.primary }]}>Push Permissions</Text>
            <Text style={[styles.infoSubtitle, { color: theme.text.secondary }]}>
              {loadingPush ? 'Checking this device…' : formatPermission(pushStatus)}
            </Text>
          </View>
          <Button
            title={pushStatus === 'granted' ? 'Refresh' : 'Enable'}
            size="sm"
            variant={pushStatus === 'granted' ? 'secondary' : 'primary'}
            onPress={pushStatus === 'granted' ? refreshPushStatus : requestPushPermission}
          />
        </View>
      </Card>

      <Card>
        <CardLabel>Interface Skin</CardLabel>
        <View style={styles.optionList}>
          {SKIN_OPTIONS.map((option) => {
            const active = theme.skin === option.key
            const allowed = tierAllows(option.requiredTier, { isPro, isUltra })
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.85}
                onPress={() => chooseSkin(option)}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: active ? theme.accentGlowStrong : theme.bg.elevated,
                    borderColor: active ? theme.accent : theme.border,
                    opacity: allowed ? 1 : 0.55,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.optionLabel, { color: theme.text.primary }]}>{option.label}</Text>
                  <Text style={[styles.optionTier, { color: theme.text.tertiary }]}>
                    {option.requiredTier === 'free' ? 'Free' : option.requiredTier === 'pro' ? 'PRO' : 'ULTRA'}
                  </Text>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                ) : !allowed ? (
                  <Ionicons name="lock-closed" size={16} color={theme.text.tertiary} />
                ) : null}
              </TouchableOpacity>
            )
          })}
        </View>
      </Card>

      <Card>
        <CardLabel>Account Actions</CardLabel>
        <Input
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Min 6 characters"
          secureTextEntry
        />
        <Button
          title="Change Password"
          variant="secondary"
          onPress={changePassword}
          loading={savingPassword}
          disabled={newPassword.length < 6}
          icon={<Ionicons name="key-outline" size={16} color={theme.text.primary} />}
          style={styles.topButton}
        />
        <Divider />
        <Button
          title="Re-run Onboarding"
          variant="secondary"
          onPress={reRunOnboarding}
          icon={<Ionicons name="refresh-outline" size={16} color={theme.text.primary} />}
          style={styles.topButton}
        />
        <Button
          title="Export My Data"
          variant="secondary"
          onPress={exportData}
          loading={exporting}
          icon={<Ionicons name="download-outline" size={16} color={theme.text.primary} />}
          style={styles.topButton}
        />
        <Divider />
        <Button
          title="Sign Out"
          variant="secondary"
          onPress={signOut}
          icon={<Ionicons name="log-out-outline" size={16} color={theme.text.primary} />}
          style={styles.topButton}
        />
        <Button
          title="Delete Account"
          variant="danger"
          onPress={confirmDeleteAccount}
          icon={<Ionicons name="trash-outline" size={16} color="#fff" />}
        />
      </Card>
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
  email: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  topButton: {
    marginBottom: spacing.sm,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: spacing.xs,
  },
  themeDotWrap: {
    width: 72,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: 8,
  },
  themeDot: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  themeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  optionTier: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  infoSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  pushCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
})
