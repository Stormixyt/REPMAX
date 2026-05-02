import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import RestTimer from '../../components/RestTimer'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function WorkoutScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const { workoutId } = route.params
  const { user, updateProfile, profile } = useAuth()
  const { theme } = useTheme()
  const unit = profile?.unit_preference || 'kg'

  const [workout, setWorkout] = useState(null)
  const [sets, setSets] = useState([])
  const [ghostData, setGhostData] = useState({})
  const [loading, setLoading] = useState(true)
  const [showTimer, setShowTimer] = useState(false)
  const [timerDuration, setTimerDuration] = useState(120)
  const [showSummary, setShowSummary] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [newPRs, setNewPRs] = useState([])
  const [finishing, setFinishing] = useState(false)
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState(null)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    loadWorkout()
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [workoutId])

  async function loadWorkout() {
    const [wRes, sRes] = await Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('sets').select('*').eq('workout_id', workoutId).order('id'),
    ])
    setWorkout(wRes.data)
    setSets(sRes.data || [])

    if (wRes.data?.day_name) {
      try {
        const { data: prevWorkouts } = await supabase.from('workouts')
          .select('id').eq('user_id', user.id).eq('day_name', wRes.data.day_name)
          .not('completed_at', 'is', null).neq('id', workoutId)
          .order('completed_at', { ascending: false }).limit(1)
        if (prevWorkouts?.[0]) {
          const { data: prevSets } = await supabase.from('sets')
            .select('exercise_name, set_number, actual_weight, actual_reps')
            .eq('workout_id', prevWorkouts[0].id).eq('completed', true)
          const ghost = {}
          prevSets?.forEach(s => { ghost[`${s.exercise_name}_${s.set_number}`] = { weight: s.actual_weight, reps: s.actual_reps } })
          setGhostData(ghost)
        }
      } catch {}
    }
    setLoading(false)
  }

  const exercises = useMemo(() => {
    const map = {}
    sets.forEach(s => {
      if (!map[s.exercise_name]) map[s.exercise_name] = []
      map[s.exercise_name].push(s)
    })
    return map
  }, [sets])

  function updateSet(setId, field, value) {
    setSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s))
  }

  async function completeSet(setId) {
    const set = sets.find(s => s.id === setId)
    if (!set) return
    const newCompleted = !set.completed
    setSets(prev => prev.map(s => s.id === setId ? { ...s, completed: newCompleted } : s))

    if (newCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

      const name = set.exercise_name.toLowerCase()
      const isCompound = ['squat', 'bench', 'deadlift', 'press', 'row'].some(w => name.includes(w))
      setTimerDuration(isCompound ? 180 : set.target_reps <= 6 ? 150 : 90)
      setShowTimer(true)

      const actualReps = set.actual_reps || set.target_reps || 0
      const actualWeight = set.actual_weight || set.target_weight || 0
      const targetReps = set.target_reps || 8
      const sameSets = sets.filter(s => s.exercise_name === set.exercise_name)
      const nextSet = sameSets.find(s => !s.completed && s.set_number > set.set_number)

      if (nextSet) {
        if (actualReps >= targetReps + 2 && actualWeight > 0) {
          const bump = isCompound ? 2.5 : 1
          setAdaptiveSuggestion({ setId: nextSet.id, type: 'up', suggestedWeight: actualWeight + bump, msg: `Try ${actualWeight + bump}${unit} — you crushed ${actualReps} reps` })
        } else if (actualReps > 0 && actualReps <= targetReps - 2 && actualWeight > 0) {
          const drop = isCompound ? 2.5 : 1
          setAdaptiveSuggestion({ setId: nextSet.id, type: 'down', suggestedWeight: Math.max(0, actualWeight - drop), msg: `Drop to ${Math.max(0, actualWeight - drop)}${unit} — only ${actualReps} reps` })
        } else {
          setAdaptiveSuggestion({ setId: nextSet.id, type: 'ok', msg: 'On track — keep this weight' })
        }
        setTimeout(() => setAdaptiveSuggestion(null), 12000)
      }
    }

    await supabase.from('sets').update({
      actual_reps: set.actual_reps || set.target_reps,
      actual_weight: set.actual_weight || set.target_weight,
      completed: newCompleted,
    }).eq('id', setId)
  }

  async function finishWorkout() {
    if (finishing) return
    setFinishing(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

    try {
      const { data: current } = await supabase.from('workouts').select('completed_at').eq('id', workoutId).single()
      if (current?.completed_at) { setShowSummary(true); return }

      const completedSets = sets.filter(s => s.completed)
      const totalVolume = completedSets.reduce((sum, s) => sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0)), 0)
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)

      await supabase.from('workouts').update({ completed_at: new Date().toISOString(), duration_seconds: duration, total_volume: totalVolume }).eq('id', workoutId)

      const prList = []
      const exerciseMaxes = {}
      completedSets.forEach(s => {
        const weight = s.actual_weight || s.target_weight || 0
        const reps = s.actual_reps || s.target_reps || 0
        const e1rm = weight * (1 + reps / 30)
        if (!exerciseMaxes[s.exercise_name] || e1rm > exerciseMaxes[s.exercise_name].e1rm) {
          exerciseMaxes[s.exercise_name] = { weight, reps, e1rm }
        }
      })

      for (const [exercise, data] of Object.entries(exerciseMaxes)) {
        if (data.weight > 0) {
          const { data: existing } = await supabase.from('personal_records')
            .select('estimated_1rm').eq('user_id', user.id).eq('exercise_name', exercise)
            .order('estimated_1rm', { ascending: false }).limit(1).single()
          if (!existing || data.e1rm > existing.estimated_1rm) {
            await supabase.from('personal_records').insert({ user_id: user.id, exercise_name: exercise, weight: data.weight, reps: data.reps, estimated_1rm: Math.round(data.e1rm * 10) / 10 })
            prList.push({ exercise, weight: data.weight, reps: data.reps })
          }
        }
      }
      setNewPRs(prList)

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { count: todayCount } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('completed_at', 'is', null).neq('id', workoutId).gte('completed_at', todayStart.toISOString())
      const total = (profile?.total_workouts || 0) + 1
      if ((todayCount || 0) === 0) {
        const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
        const { count: yesterdayCount } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('completed_at', 'is', null).gte('completed_at', yesterdayStart.toISOString()).lt('completed_at', todayStart.toISOString())
        const streak = (yesterdayCount || 0) > 0 ? (profile?.current_streak || 0) + 1 : 1
        await updateProfile({ total_workouts: total, current_streak: streak, longest_streak: Math.max(streak, profile?.longest_streak || 0) })
      } else {
        await updateProfile({ total_workouts: total })
      }
      setShowSummary(true)
    } catch (err) {
      console.error('Finish workout error:', err)
      setFinishing(false)
    }
  }

  const completedCount = sets.filter(s => s.completed).length
  const totalSets = sets.length
  const progress = totalSets > 0 ? (completedCount / totalSets) * 100 : 0
  const exerciseEntries = Object.entries(exercises)

  if (loading) {
    return <View style={[styles.loadingWrap, { backgroundColor: theme.bg.primary }]}><ActivityIndicator color={theme.accent} size="large" /></View>
  }

  if (showSummary) {
    const totalVolume = sets.filter(s => s.completed).reduce((sum, s) => sum + ((s.actual_weight || s.target_weight || 0) * (s.actual_reps || s.target_reps || 0)), 0)
    return (
      <View style={[styles.victoryOverlay, { backgroundColor: theme.bg.primary }]}>
        <Ionicons name="trophy" size={56} color={theme.accent} />
        <Text style={[styles.victoryTitle, { color: theme.text.primary }]}>Session Complete</Text>
        <View style={styles.victoryStats}>
          <View style={styles.victoryStat}><Text style={[styles.victoryValue, { color: theme.accent }]}>{completedCount}</Text><Text style={[styles.victoryLabel, { color: theme.text.tertiary }]}>Sets</Text></View>
          <View style={styles.victoryStat}><Text style={[styles.victoryValue, { color: theme.accent }]}>{formatTime(elapsed)}</Text><Text style={[styles.victoryLabel, { color: theme.text.tertiary }]}>Duration</Text></View>
          <View style={styles.victoryStat}><Text style={[styles.victoryValue, { color: theme.accent }]}>{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</Text><Text style={[styles.victoryLabel, { color: theme.text.tertiary }]}>Volume</Text></View>
          <View style={styles.victoryStat}><Text style={[styles.victoryValue, { color: theme.accent }]}>{exerciseEntries.length}</Text><Text style={[styles.victoryLabel, { color: theme.text.tertiary }]}>Exercises</Text></View>
        </View>
        {newPRs.length > 0 && (
          <View style={[styles.prSection, { borderColor: theme.borderAccent }]}>
            <Text style={[styles.prTitle, { color: theme.accent }]}>New Personal Records</Text>
            {newPRs.map((pr, i) => (
              <View key={i} style={styles.prRow}>
                <Text style={[styles.prName, { color: theme.text.primary }]}>{pr.exercise}</Text>
                <Text style={[styles.prWeight, { color: theme.accent }]}>{pr.weight} x {pr.reps}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={[styles.victoryBtn, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={[styles.victoryBtnText, { color: theme.text.onAccent }]}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {!focusMode && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.kicker, { color: theme.text.tertiary }]}>Week {workout?.week_number || 1}</Text>
            <Text style={[styles.title, { color: theme.text.primary }]}>{workout?.day_name || 'Workout'}</Text>
            <Text style={[styles.subtitle, { color: theme.text.tertiary }]}>{formatTime(elapsed)} · {exerciseEntries.length} exercises</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.chip, { backgroundColor: focusMode ? theme.accent : theme.bg.elevated }]} onPress={() => setFocusMode(!focusMode)}>
            <Ionicons name={focusMode ? 'eye-off' : 'eye'} size={16} color={focusMode ? theme.text.onAccent : theme.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, { backgroundColor: theme.bg.elevated }]} onPress={() => setShowTimer(true)}>
            <Ionicons name="timer" size={16} color={theme.accent} />
            <Text style={[styles.chipText, { color: theme.text.primary }]}>Rest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: theme.text.secondary }]}>Session progress</Text>
          <Text style={[styles.progressCount, { color: theme.text.primary }]}>{completedCount}/{totalSets} sets</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progress === 100 ? theme.success : theme.accent }]} />
        </View>
      </View>

      {/* Exercise Cards */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {exerciseEntries.map(([exerciseName, exerciseSets], exerciseIndex) => {
          const doneSets = exerciseSets.filter(s => s.completed).length
          const allDone = doneSets === exerciseSets.length

          return (
            <View key={exerciseName} style={[styles.exerciseCard, { backgroundColor: theme.bg.card, borderColor: allDone ? theme.success + '33' : theme.border }]}>
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exerciseKicker, { color: theme.text.tertiary }]}>Exercise {exerciseIndex + 1}</Text>
                  <Text style={[styles.exerciseName, { color: allDone ? theme.success : theme.text.primary }]}>{exerciseName}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.metaChip, { backgroundColor: theme.bg.elevated }]}><Text style={[styles.metaText, { color: theme.text.secondary }]}>{exerciseSets.length} sets</Text></View>
                    <View style={[styles.metaChip, { backgroundColor: theme.bg.elevated }]}><Text style={[styles.metaText, { color: theme.text.secondary }]}>{exerciseSets[0]?.target_reps || '?'} reps</Text></View>
                    {ghostData[`${exerciseName}_${exerciseSets[0]?.set_number}`] && (
                      <View style={[styles.metaChip, { backgroundColor: 'rgba(204,255,0,0.08)' }]}><Text style={[styles.metaText, { color: theme.accent }]}>Ghost</Text></View>
                    )}
                  </View>
                </View>
                <Text style={[styles.exerciseCounter, { color: allDone ? theme.success : theme.accent }]}>{doneSets}/{exerciseSets.length}</Text>
              </View>

              {/* Set Header */}
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setHeaderText, { color: theme.text.tertiary, width: 30 }]}>Set</Text>
                <Text style={[styles.setHeaderText, { color: theme.text.tertiary, flex: 1, textAlign: 'center' }]}>Weight</Text>
                <Text style={[styles.setHeaderText, { color: theme.text.tertiary, flex: 1, textAlign: 'center' }]}>Reps</Text>
                <Text style={[styles.setHeaderText, { color: theme.text.tertiary, width: 48, textAlign: 'right' }]}>Done</Text>
              </View>

              {exerciseSets.map(set => {
                const ghostKey = `${set.exercise_name}_${set.set_number}`
                const ghost = ghostData[ghostKey]

                return (
                  <View key={set.id}>
                    {adaptiveSuggestion?.setId === set.id && !set.completed && (
                      <View style={[styles.suggestion, {
                        backgroundColor: adaptiveSuggestion.type === 'up' ? 'rgba(0,220,130,0.1)' : adaptiveSuggestion.type === 'down' ? 'rgba(255,100,100,0.1)' : theme.accentGlow,
                        borderColor: adaptiveSuggestion.type === 'up' ? 'rgba(0,220,130,0.15)' : adaptiveSuggestion.type === 'down' ? 'rgba(255,100,100,0.15)' : theme.borderAccent,
                      }]}>
                        <Text style={[styles.suggestionText, {
                          color: adaptiveSuggestion.type === 'up' ? '#00dc82' : adaptiveSuggestion.type === 'down' ? '#ff6b6b' : theme.accent,
                        }]}>{adaptiveSuggestion.msg}</Text>
                        {adaptiveSuggestion.type !== 'ok' && (
                          <TouchableOpacity onPress={() => { updateSet(set.id, 'actual_weight', adaptiveSuggestion.suggestedWeight); setAdaptiveSuggestion(null) }}
                            style={[styles.applyBtn, { backgroundColor: theme.bg.elevated }]}>
                            <Text style={[styles.applyText, { color: theme.text.primary }]}>Apply</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    <View style={styles.setRow}>
                      <Text style={[styles.setNum, { color: set.completed ? theme.success : theme.text.secondary }]}>{set.set_number}</Text>
                      <View style={styles.setField}>
                        <TextInput
                          style={[styles.setInput, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
                          keyboardType="decimal-pad"
                          placeholder={String(set.target_weight || '—')}
                          placeholderTextColor={theme.text.tertiary}
                          value={set.actual_weight != null ? String(set.actual_weight) : ''}
                          onChangeText={v => updateSet(set.id, 'actual_weight', parseFloat(v) || 0)}
                          editable={!set.completed}
                        />
                        {ghost && !set.completed && <Text style={[styles.ghostHint, { color: theme.text.tertiary }]}>{ghost.weight}</Text>}
                      </View>
                      <View style={styles.setField}>
                        <TextInput
                          style={[styles.setInput, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
                          keyboardType="number-pad"
                          placeholder={String(set.target_reps || '—')}
                          placeholderTextColor={theme.text.tertiary}
                          value={set.actual_reps != null ? String(set.actual_reps) : ''}
                          onChangeText={v => updateSet(set.id, 'actual_reps', parseInt(v) || 0)}
                          editable={!set.completed}
                        />
                        {ghost && !set.completed && <Text style={[styles.ghostHint, { color: theme.text.tertiary }]}>{ghost.reps}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => completeSet(set.id)} style={[styles.checkBtn, { backgroundColor: set.completed ? theme.success : theme.bg.elevated }]}>
                        <Ionicons name="checkmark" size={20} color={set.completed ? '#fff' : theme.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}
      </ScrollView>

      {/* Finish Button */}
      <View style={[styles.footer, { backgroundColor: theme.bg.primary, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.finishBtn, { backgroundColor: theme.accent, opacity: completedCount === 0 || finishing ? 0.5 : 1 }]}
          onPress={finishWorkout}
          disabled={completedCount === 0 || finishing}
        >
          {finishing ? <ActivityIndicator color={theme.text.onAccent} /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flash" size={18} color={theme.text.onAccent} />
              <Text style={[styles.finishText, { color: theme.text.onAccent }]}>Finish Workout ({completedCount}/{totalSets})</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {showTimer && <RestTimer duration={timerDuration} onClose={() => setShowTimer(false)} onDurationChange={setTimerDuration} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  backBtn: { marginTop: 4 },
  kicker: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  subtitle: { fontSize: fontSize.xs, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  progressWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: fontSize.xs },
  progressCount: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  progressTrack: { height: 4, borderRadius: 2 },
  progressFill: { height: '100%', borderRadius: 2 },
  scroll: { flex: 1, paddingHorizontal: spacing.xl },
  exerciseCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  exerciseKicker: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  exerciseName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metaChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  metaText: { fontSize: 11, fontWeight: fontWeight.semibold },
  exerciseCounter: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setHeaderText: { fontSize: 11, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  setNum: { width: 24, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
  setField: { flex: 1, position: 'relative' },
  setInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: fontSize.md, textAlign: 'center', fontWeight: fontWeight.semibold },
  ghostHint: { position: 'absolute', bottom: -12, left: 0, right: 0, textAlign: 'center', fontSize: 10 },
  checkBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  suggestion: { borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestionText: { fontSize: 12, fontWeight: fontWeight.bold, flex: 1 },
  applyBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  applyText: { fontSize: 12, fontWeight: fontWeight.bold },
  footer: { padding: spacing.xl, borderTopWidth: 1 },
  finishBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  finishText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  victoryOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  victoryTitle: { fontSize: fontSize.xxxl, fontWeight: fontWeight.black, marginTop: spacing.xl },
  victoryStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xxl },
  victoryStat: { alignItems: 'center' },
  victoryValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  victoryLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', marginTop: 2 },
  prSection: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xxl, width: '100%' },
  prTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  prName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  prWeight: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  victoryBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl, width: '100%' },
  victoryBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
})
