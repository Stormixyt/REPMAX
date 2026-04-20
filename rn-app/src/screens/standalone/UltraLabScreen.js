import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet, RefreshControl, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { askCoach } from '../../lib/groq'
import { formatWeight, formatVolume, weightLabel } from '../../lib/units'
import { Card, CardLabel, Button, Badge, EmptyState, PageHeader, SegmentedControl, SectionHeader, ProgressBar } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const DAY_MS = 86400000

function clamp(v, min, max) { return Math.min(Math.max(v, min), max) }

function buildInsights(profile, workouts, prs, unit) {
  const now = Date.now()
  const completed = (workouts || []).filter(w => w?.completed_at).map(w => ({
    ts: new Date(w.completed_at).getTime(), volume: Number(w.total_volume) || 0,
  })).sort((a, b) => b.ts - a.ts)

  const inDays = d => completed.filter(w => now - w.ts <= d * DAY_MS)
  const sumVol = rows => rows.reduce((t, r) => t + r.volume, 0)
  const last7 = inDays(7), prev7 = completed.filter(w => { const age = (now - w.ts) / DAY_MS; return age > 7 && age <= 14 })
  const last7Vol = sumVol(last7), prev7Vol = sumVol(prev7)
  const volTrend = prev7Vol > 0 ? ((last7Vol - prev7Vol) / prev7Vol) * 100 : (last7Vol > 0 ? 100 : 0)
  const target = Math.max(1, profile?.training_days?.length || 4)
  const adherence = Math.round(clamp((last7.length / target) * 100, 0, 180))
  const streak = Number(profile?.current_streak) || 0
  const lastTs = completed[0]?.ts
  const daysSince = lastTs ? (now - lastTs) / DAY_MS : null
  const recovery = daysSince == null ? 60 : clamp(100 - Math.abs(daysSince - 1.5) * 22, 20, 100)
  const readiness = Math.round(clamp((recovery * 0.45) + (clamp((last7.length / target) * 100, 20, 120) * 0.35) + (clamp(35 + streak * 2.2, 35, 100) * 0.2), 25, 99))
  const prProb = Math.round(clamp(38 + (volTrend * 0.35) + ((readiness - 60) * 0.55), 12, 96))

  return [
    { id: 'readiness', title: 'Readiness', value: `${readiness}/100`, note: readiness >= 82 ? 'Prime' : readiness >= 68 ? 'Ready' : 'Steady' },
    { id: 'momentum', title: 'Momentum', value: `${volTrend > 0 ? '+' : ''}${Math.round(volTrend)}%`, note: `${last7.length} sessions this week` },
    { id: 'adherence', title: 'Adherence', value: `${adherence}%`, note: `${last7.length}/${target} planned` },
    { id: 'pr', title: 'PR Chance', value: `${prProb}%`, note: 'Next session forecast' },
    { id: 'streak', title: 'Streak', value: `${streak}🔥`, note: `Best: ${profile?.longest_streak || 0}` },
    { id: 'volume', title: 'Weekly Vol', value: formatVolume(last7Vol, unit), note: `vs ${formatVolume(prev7Vol, unit)} prev` },
  ]
}

export default function UltraLabScreen() {
  const { user, profile, isUltra, isPro } = useAuth()
  const { theme } = useTheme()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState([])
  const [prs, setPrs] = useState([])
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const unit = profile?.unit_preference || 'kg'

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [wRes, pRes] = await Promise.all([
      supabase.from('workouts').select('completed_at, total_volume').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(60),
      supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(20),
    ])
    setWorkouts(wRes.data || [])
    setPrs(pRes.data || [])
    setLoading(false)
  }

  const insights = buildInsights(profile, workouts, prs, unit)

  async function importFromText() {
    if (!importText.trim()) return
    setImporting(true)
    try {
      const result = await askCoach(
        `Parse this workout routine into a structured JSON program with weeks, days, and exercises: ${importText}`,
        { goal: profile?.goal, experience: profile?.experience_level },
        { model: 'claude-sonnet-4', style: 'deep' }
      )
      setImportResult(result)
    } catch (err) {
      Alert.alert('Import Failed', err.message)
    }
    setImporting(false)
  }

  async function importFromImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (result.canceled) return
    Alert.alert('Coming Soon', 'Image-based routine import is being built for the native app.')
  }

  if (!isUltra && !isPro) {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: theme.bg.primary }]}>
        <Ionicons name="lock-closed" size={48} color={theme.text.tertiary} />
        <Text style={[styles.lockedTitle, { color: theme.text.primary }]}>ULTRA Lab</Text>
        <Text style={[styles.lockedDesc, { color: theme.text.secondary }]}>Advanced analytics, routine import, and social planning. Available for ULTRA subscribers.</Text>
        <Badge label="ULTRA" color={theme.accent} style={{ marginTop: spacing.lg }} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <PageHeader title="ULTRA Lab" subtitle="Advanced analytics and intelligence" />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        <SegmentedControl options={['Intelligence', 'Import Studio', 'Social Edge']} selectedIndex={tab} onChange={setTab} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}

        {!loading && tab === 0 && (
          <>
            <SectionHeader title="Insights" />
            <View style={styles.insightsGrid}>
              {insights.map(ins => (
                <View key={ins.id} style={[styles.insightCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                  <Text style={[styles.insightValue, { color: theme.accent }]}>{ins.value}</Text>
                  <Text style={[styles.insightTitle, { color: theme.text.secondary }]}>{ins.title}</Text>
                  <Text style={[styles.insightNote, { color: theme.text.tertiary }]}>{ins.note}</Text>
                </View>
              ))}
            </View>
            {prs.length > 0 && (
              <Card style={{ marginTop: spacing.lg }}>
                <CardLabel>RECENT PRs</CardLabel>
                {prs.slice(0, 8).map((pr, i) => (
                  <View key={pr.id || i} style={[styles.prRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                    <Text style={[styles.prName, { color: theme.text.primary }]}>{pr.exercise_name}</Text>
                    <Text style={[styles.prVal, { color: theme.accent }]}>{formatWeight(pr.weight, unit)} x {pr.reps}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {!loading && tab === 1 && (
          <>
            <Card>
              <CardLabel>IMPORT FROM TEXT</CardLabel>
              <TextInput
                style={[styles.importInput, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
                placeholder="Paste your routine here..."
                placeholderTextColor={theme.text.tertiary}
                multiline
                value={importText}
                onChangeText={setImportText}
              />
              <Button title={importing ? 'Parsing...' : 'Parse Routine'} loading={importing} onPress={importFromText} style={{ marginTop: spacing.md }} />
            </Card>
            <Card style={{ marginTop: spacing.md }}>
              <CardLabel>IMPORT FROM SCREENSHOT</CardLabel>
              <Button title="Choose Image" variant="secondary" onPress={importFromImage} icon={<Ionicons name="image" size={18} color={theme.text.primary} />} />
            </Card>
            {importResult && (
              <Card style={{ marginTop: spacing.md }}>
                <CardLabel>RESULT</CardLabel>
                <Text style={[styles.resultText, { color: theme.text.secondary }]}>{typeof importResult === 'string' ? importResult : JSON.stringify(importResult, null, 2)}</Text>
              </Card>
            )}
          </>
        )}

        {!loading && tab === 2 && (
          <EmptyState icon="🤝" title="Social Edge" description="Recurring training appointments, accountability boards, and crew nudges — coming soon." />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  lockedTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.black, marginTop: spacing.lg },
  lockedDesc: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.sm },
  pageTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' },
  tabLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  body: { paddingHorizontal: spacing.xl },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  insightCard: { width: '48%', borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  insightValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  insightTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
  insightNote: { fontSize: 10, marginTop: 2 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  prName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  prVal: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  importInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, minHeight: 120, textAlignVertical: 'top' },
  resultText: { fontSize: fontSize.xs, lineHeight: 18 },
})
