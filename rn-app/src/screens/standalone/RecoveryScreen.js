import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Card, CardLabel, Button, PageHeader, ProgressBar } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const SORENESS_SCALE = [
  { value: 1, emoji: '😊', label: 'Fresh' },
  { value: 2, emoji: '🙂', label: 'Mild' },
  { value: 3, emoji: '😐', label: 'Moderate' },
  { value: 4, emoji: '😣', label: 'Sore' },
  { value: 5, emoji: '🥵', label: 'Destroyed' },
]

const MOBILITY_DRILLS = [
  { name: 'Cat-Cow Stretch', duration: '60s', target: 'Spine' },
  { name: 'World\'s Greatest Stretch', duration: '30s each', target: 'Full Body' },
  { name: 'Hip 90/90', duration: '30s each', target: 'Hips' },
  { name: 'Thoracic Rotation', duration: '30s each', target: 'Upper Back' },
  { name: 'Shoulder Dislocates', duration: '10 reps', target: 'Shoulders' },
  { name: 'Couch Stretch', duration: '60s each', target: 'Hip Flexors' },
  { name: 'Deep Squat Hold', duration: '60s', target: 'Ankles & Hips' },
  { name: 'Foam Roll Quads', duration: '60s each', target: 'Quads' },
]

export default function RecoveryScreen() {
  const navigation = useNavigation()
  const { user, profile } = useAuth()
  const { theme } = useTheme()
  const [soreness, setSoreness] = useState(null)
  const [water, setWater] = useState(0)
  const mounted = useRef(true)

  const dateKey = new Date().toISOString().split('T')[0]

  useEffect(() => {
    mounted.current = true
    loadRecoveryData()
    return () => { mounted.current = false }
  }, [user?.id])

  async function loadRecoveryData() {
    if (!user?.id) return
    try {
      const [waterRes] = await Promise.all([
        supabase.from('water_logs').select('glasses').eq('user_id', user.id).eq('logged_at', dateKey).maybeSingle(),
      ])
      if (!mounted.current) return
      setWater(Number(waterRes.data?.glasses || 0))
    } catch (err) {
      console.error('Recovery load error:', err)
    }
  }

  function selectSoreness(val) {
    setSoreness(val)
    Haptics.selectionAsync().catch(() => {})
  }

  async function updateWater(next) {
    const safe = Math.max(0, Math.min(next, 12))
    setWater(safe)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (!user?.id) return
    try {
      await supabase.from('water_logs').upsert({ user_id: user.id, logged_at: dateKey, glasses: safe }, { onConflict: 'user_id,logged_at' })
    } catch (err) {
      console.error('Water update error:', err)
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg.primary }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
      </TouchableOpacity>

      <PageHeader title="Recovery Hub" subtitle="Rest smarter. Recover faster." />

      {/* Soreness Check */}
      <Card>
        <CardLabel>How sore are you?</CardLabel>
        <View style={styles.sorenessRow}>
          {SORENESS_SCALE.map(s => (
            <TouchableOpacity key={s.value} style={[styles.sorenessBtn, soreness === s.value && { backgroundColor: theme.accentGlow, borderColor: theme.borderAccent }, { borderColor: theme.border }]}
              onPress={() => selectSoreness(s.value)}>
              <Text style={styles.sorenessEmoji}>{s.emoji}</Text>
              <Text style={[styles.sorenessLabel, { color: soreness === s.value ? theme.accent : theme.text.tertiary }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {soreness && soreness >= 4 && (
          <Text style={[styles.sorenessAdvice, { color: theme.warning }]}>Consider a light day or active recovery. Your muscles need time.</Text>
        )}
      </Card>

      {/* Water Tracker */}
      <Card>
        <CardLabel>Water Intake</CardLabel>
        <View style={styles.waterRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(glass => (
            <TouchableOpacity key={glass} onPress={() => updateWater(glass)}>
              <Ionicons name={glass <= water ? 'water' : 'water-outline'} size={28} color={glass <= water ? theme.info : theme.text.tertiary} />
            </TouchableOpacity>
          ))}
        </View>
        <ProgressBar progress={water / 8} color={theme.info} style={{ marginTop: spacing.sm }} />
        <Text style={[styles.waterLabel, { color: theme.text.secondary }]}>{water}/8 glasses</Text>
      </Card>

      {/* Mobility Drills */}
      <Card>
        <CardLabel>Mobility Drills</CardLabel>
        {MOBILITY_DRILLS.map((drill, i) => (
          <View key={i} style={[styles.drillRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.drillName, { color: theme.text.primary }]}>{drill.name}</Text>
              <Text style={[styles.drillMeta, { color: theme.text.tertiary }]}>{drill.target} · {drill.duration}</Text>
            </View>
            <Ionicons name="play-circle" size={24} color={theme.accent} />
          </View>
        ))}
      </Card>

      {/* Tips */}
      <Card>
        <CardLabel>Recovery Tips</CardLabel>
        <Text style={[styles.tipText, { color: theme.text.secondary }]}>
          {'\u2022'} Sleep 7-9 hours for optimal muscle repair{'\n'}
          {'\u2022'} Eat protein within 2 hours post-workout{'\n'}
          {'\u2022'} Light walking improves blood flow to sore muscles{'\n'}
          {'\u2022'} Foam rolling reduces DOMS by up to 30%{'\n'}
          {'\u2022'} Hydrate — dehydration delays recovery
        </Text>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  backBtn: { marginBottom: spacing.sm },
  sorenessRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  sorenessBtn: { alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, flex: 1 },
  sorenessEmoji: { fontSize: 24 },
  sorenessLabel: { fontSize: 10, fontWeight: fontWeight.semibold, marginTop: 4 },
  sorenessAdvice: { fontSize: fontSize.xs, marginTop: spacing.md, fontWeight: fontWeight.semibold },
  waterRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  waterLabel: { fontSize: fontSize.sm, textAlign: 'center' },
  drillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  drillName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  drillMeta: { fontSize: fontSize.xs, marginTop: 2 },
  tipText: { fontSize: fontSize.sm, lineHeight: 22 },
})
