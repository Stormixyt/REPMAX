import { useState, useEffect, useMemo, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { Card, CardLabel, Button, PageHeader, StatBox } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const RUN_HISTORY_KEY = 'repmax-run-history'

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatPace(distanceKm, elapsedSeconds) {
  if (!distanceKm || !elapsedSeconds) return '--'
  const secondsPerKm = elapsedSeconds / distanceKm
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

export default function RunTrackerScreen() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const { user } = useAuth()
  const { t } = useLanguage()
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [distanceKm, setDistanceKm] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0)
  const [lastAccuracy, setLastAccuracy] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const watchRef = useRef(null)
  const timerRef = useRef(null)
  const lastPointRef = useRef(null)
  const startedAtRef = useRef(null)
  const pausedAtRef = useRef(null)

  useEffect(() => {
    AsyncStorage.getItem(RUN_HISTORY_KEY).then(stored => {
      if (stored) setHistory(JSON.parse(stored))
    }).catch(() => {})
    return () => {
      if (watchRef.current) watchRef.current.remove()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const estimatedSteps = useMemo(() => Math.round((distanceKm * 1000) / 0.78), [distanceKm])
  const pace = useMemo(() => formatPace(distanceKm, elapsedSeconds), [distanceKm, elapsedSeconds])

  function resetRun() {
    setIsRunning(false); setIsPaused(false); setDistanceKm(0); setElapsedSeconds(0)
    setCurrentSpeedKmh(0); setLastAccuracy(null); setError('')
    lastPointRef.current = null; startedAtRef.current = null; pausedAtRef.current = null
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!startedAtRef.current) return
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)))
    }, 1000)
  }

  async function beginLocationWatch() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') { setError('Location permission denied.'); return }
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1500, distanceInterval: 3 },
      (loc) => {
        const { latitude, longitude, accuracy, speed } = loc.coords
        setLastAccuracy(accuracy || null)
        setCurrentSpeedKmh(speed && speed > 0 ? speed * 3.6 : 0)
        const nextPoint = { latitude, longitude, accuracy: accuracy || 0 }
        const prev = lastPointRef.current
        if (prev) {
          const delta = haversineDistance(prev.latitude, prev.longitude, nextPoint.latitude, nextPoint.longitude)
          if (delta > 0.003 && delta < 0.4 && (accuracy || 0) < 120) setDistanceKm(c => c + delta)
        }
        lastPointRef.current = nextPoint
      }
    )
  }

  async function handleStartRun() {
    setError(''); setDistanceKm(0); setElapsedSeconds(0); setCurrentSpeedKmh(0); setLastAccuracy(null)
    lastPointRef.current = null; startedAtRef.current = Date.now(); pausedAtRef.current = null
    setIsRunning(true); setIsPaused(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    startTimer(); await beginLocationWatch()
  }

  function handlePauseRun() {
    if (!isRunning) return
    setIsPaused(true); pausedAtRef.current = Date.now()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
  }

  async function handleResumeRun() {
    if (!isRunning || !isPaused) return
    const pausedDuration = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0
    startedAtRef.current = (startedAtRef.current || Date.now()) + pausedDuration
    pausedAtRef.current = null; lastPointRef.current = null; setIsPaused(false)
    startTimer(); await beginLocationWatch()
  }

  function handleFinishRun() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const endTime = pausedAtRef.current || Date.now()
    const finalElapsed = startedAtRef.current ? Math.max(0, Math.round((endTime - startedAtRef.current) / 1000)) : elapsedSeconds
    const run = { id: Date.now().toString(), finishedAt: new Date().toISOString(), elapsedSeconds: finalElapsed, distanceKm, estimatedSteps, averagePace: formatPace(distanceKm, finalElapsed) }
    if (run.distanceKm > 0.05 || run.elapsedSeconds > 60) {
      const next = [run, ...history].slice(0, 8)
      setHistory(next)
      AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(next)).catch(() => {})
      // Sync to Supabase
      if (user?.id) {
        supabase.from('run_logs').insert({
          user_id: user.id,
          distance_km: run.distanceKm,
          duration_seconds: run.elapsedSeconds,
          estimated_steps: run.estimatedSteps,
          average_pace: run.averagePace,
          finished_at: run.finishedAt,
        }).catch(err => console.error('Run sync error:', err))
      }
    }
    resetRun()
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg.primary }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
        <Text style={[styles.backText, { color: theme.text.primary }]}>Back</Text>
      </TouchableOpacity>
      <PageHeader title={t('run_title')} subtitle={t('run_subtitle')} />

      <View style={[styles.hero, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
        <Text style={[styles.heroKicker, { color: theme.text.tertiary }]}>OUTDOOR BETA</Text>
        <Text style={[styles.heroDistance, { color: theme.text.primary }]}>{distanceKm.toFixed(2)} km</Text>
        <Text style={[styles.heroPace, { color: theme.accent }]}>{pace}</Text>
        <View style={styles.heroMeta}>
          <Text style={[styles.metaItem, { color: theme.text.secondary }]}>{t('run_duration')}: {formatDuration(elapsedSeconds)}</Text>
          <Text style={[styles.metaItem, { color: theme.text.secondary }]}>{t('run_steps')}: {estimatedSteps}</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <Ionicons name="timer" size={18} color={theme.accent} />
          <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{t('run_duration')}</Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>{formatDuration(elapsedSeconds)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <Ionicons name="location" size={18} color={theme.accent} />
          <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{t('run_distance')}</Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>{distanceKm.toFixed(2)} km</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <Ionicons name="footsteps" size={18} color={theme.accent} />
          <Text style={[styles.statLabel, { color: theme.text.tertiary }]}>{t('run_steps')}</Text>
          <Text style={[styles.statValue, { color: theme.text.primary }]}>{estimatedSteps}</Text>
        </View>
      </View>

      <Card>
        <CardLabel>Live Metrics</CardLabel>
        <View style={styles.liveRow}>
          <View style={styles.liveBox}><Text style={[styles.liveLabel, { color: theme.text.secondary }]}>Speed</Text><Text style={[styles.liveValue, { color: theme.text.primary }]}>{currentSpeedKmh > 0 ? `${currentSpeedKmh.toFixed(1)} km/h` : '--'}</Text></View>
          <View style={styles.liveBox}><Text style={[styles.liveLabel, { color: theme.text.secondary }]}>GPS Accuracy</Text><Text style={[styles.liveValue, { color: theme.text.primary }]}>{lastAccuracy ? `${Math.round(lastAccuracy)}m` : '--'}</Text></View>
        </View>
      </Card>

      {error ? <Card><Text style={{ color: theme.danger, fontWeight: fontWeight.bold }}>{error}</Text></Card> : null}

      <View style={styles.actions}>
        {!isRunning && <Button title={t('run_start')} onPress={handleStartRun} size="lg" icon={<Ionicons name="play-circle" size={20} color={theme.text.onAccent} />} />}
        {isRunning && !isPaused && (<>
          <Button title={t('run_pause')} variant="secondary" onPress={handlePauseRun} style={{ flex: 1 }} />
          <Button title={t('run_finish')} onPress={handleFinishRun} size="lg" style={{ flex: 1 }} />
        </>)}
        {isRunning && isPaused && (<>
          <Button title={t('run_resume')} variant="secondary" onPress={handleResumeRun} style={{ flex: 1 }} />
          <Button title={t('run_finish')} onPress={handleFinishRun} size="lg" style={{ flex: 1 }} />
        </>)}
      </View>

      <Card>
        <CardLabel>{t('run_history')}</CardLabel>
        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>Your outdoor runs will show up here after you finish one.</Text>
        ) : history.map(run => (
          <View key={run.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.historyDate, { color: theme.text.primary }]}>{new Date(run.finishedAt).toLocaleDateString()}</Text>
              <Text style={[styles.historyMeta, { color: theme.text.tertiary }]}>{formatDuration(run.elapsedSeconds)} · {run.averagePace}</Text>
            </View>
            <Text style={[styles.historyDist, { color: theme.accent }]}>{Number(run.distanceKm || 0).toFixed(2)} km</Text>
          </View>
        ))}
      </Card>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.xxl, alignItems: 'center', marginBottom: spacing.lg },
  heroKicker: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.sm },
  heroDistance: { fontSize: 48, fontWeight: fontWeight.black },
  heroPace: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: 4 },
  heroMeta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  metaItem: { fontSize: fontSize.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  liveRow: { flexDirection: 'row', gap: spacing.md },
  liveBox: { flex: 1 },
  liveLabel: { fontSize: fontSize.sm },
  liveValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  emptyText: { fontSize: fontSize.sm, lineHeight: 20 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1 },
  historyDate: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  historyMeta: { fontSize: fontSize.xs, marginTop: 2 },
  historyDist: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
})
