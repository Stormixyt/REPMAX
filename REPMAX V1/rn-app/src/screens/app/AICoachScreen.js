import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { askCoach, COACH_MODEL_OPTIONS, COACH_RESPONSE_STYLE_OPTIONS, DEFAULT_COACH_MODEL } from '../../lib/groq'
import { Card, Badge } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const SUGGESTED_PROMPTS = [
  { icon: 'help-circle', text: 'Based on my profile, what should I focus on this week?' },
  { icon: 'heart', text: 'My shoulder hurts after overhead press. What should I change?' },
  { icon: 'restaurant', text: 'Give me a high-protein post-workout meal for muscle growth.' },
  { icon: 'sparkles', text: 'Create a 4-week hypertrophy program for intermediate lifters.' },
]

export default function AICoachScreen() {
  const { user, profile, isPro, isUltra } = useAuth()
  const { theme } = useTheme()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [model, setModel] = useState(DEFAULT_COACH_MODEL)
  const [style, setStyle] = useState('balanced')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [todayUsage, setTodayUsage] = useState(0)
  const flatListRef = useRef(null)

  const dailyLimit = isPro || isUltra ? 999 : 3
  const canSend = todayUsage < dailyLimit && !loading

  useEffect(() => {
    loadHistory()
    countTodayUsage()
  }, [])

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setMessages(data.reverse().map(m => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })))
    } catch {}
    setLoadingHistory(false)
  }

  async function countTodayUsage() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('coach_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', todayStart.toISOString())
    setTodayUsage(count || 0)
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})

    try {
      await supabase.from('coach_messages').insert({ user_id: user.id, role: 'user', content: userMsg.content })

      const context = {
        goal: profile?.goal,
        experience: profile?.experience_level,
        split: profile?.preferred_split,
        history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
      }

      try {
        const { data: workouts } = await supabase.from('workouts').select('day_name, completed_at, total_volume')
          .eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(5)
        const { data: prs } = await supabase.from('personal_records').select('exercise_name, weight, reps')
          .eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(5)
        context.recentWorkouts = workouts || []
        context.recentPRs = prs || []
      } catch {}

      const response = await askCoach(userMsg.content, context, { model, style, isPaid: isPro || isUltra })
      const aiMsg = { id: `a-${Date.now()}`, role: 'assistant', content: response, created_at: new Date().toISOString() }
      setMessages(prev => [...prev, aiMsg])

      await supabase.from('coach_messages').insert({ user_id: user.id, role: 'assistant', content: response })
      setTodayUsage(prev => prev + 1)
    } catch (err) {
      const errMsg = { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${err.message || 'Could not reach the coach right now.'}`, created_at: new Date().toISOString() }
      setMessages(prev => [...prev, errMsg])
    }
    setLoading(false)
  }

  const renderMessage = useCallback(({ item }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        <View style={[styles.msgBubble, {
          backgroundColor: isUser ? theme.accent : theme.bg.card,
          borderColor: isUser ? 'transparent' : theme.border,
        }]}>
          <Text style={[styles.msgText, { color: isUser ? theme.text.onAccent : theme.text.primary }]}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }, [theme])

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.bg.primary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text.primary }]}>AI Coach</Text>
          <Text style={[styles.subtitle, { color: theme.text.tertiary }]}>
            {todayUsage}/{dailyLimit === 999 ? '∞' : dailyLimit} today · {COACH_MODEL_OPTIONS.find(m => m.id === model)?.label}
          </Text>
        </View>
        <TouchableOpacity style={[styles.modelBtn, { backgroundColor: theme.bg.elevated }]} onPress={() => setShowModelPicker(true)}>
          <Ionicons name="settings-outline" size={18} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Style selector */}
      <View style={styles.styleRow}>
        {COACH_RESPONSE_STYLE_OPTIONS.map(s => (
          <TouchableOpacity key={s.id} style={[styles.styleChip, { backgroundColor: style === s.id ? theme.accent : theme.bg.elevated }]}
            onPress={() => setStyle(s.id)}>
            <Text style={[styles.styleText, { color: style === s.id ? theme.text.onAccent : theme.text.secondary }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      {loadingHistory ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={theme.accent} /></View>
      ) : messages.length === 0 ? (
        <View style={styles.suggestionsWrap}>
          <Text style={[styles.suggestTitle, { color: theme.text.secondary }]}>Ask your coach anything</Text>
          {SUGGESTED_PROMPTS.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.suggestCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}
              onPress={() => sendMessage(p.text)}>
              <Ionicons name={p.icon} size={16} color={theme.accent} />
              <Text style={[styles.suggestText, { color: theme.text.primary }]}>{p.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {loading && (
        <View style={styles.typingRow}>
          <View style={[styles.typingDot, { backgroundColor: theme.accent }]} />
          <View style={[styles.typingDot, { backgroundColor: theme.accent, opacity: 0.6 }]} />
          <View style={[styles.typingDot, { backgroundColor: theme.accent, opacity: 0.3 }]} />
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: theme.bg.secondary, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
          placeholder="Ask your coach..."
          placeholderTextColor={theme.text.tertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={canSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: canSend && input.trim() ? theme.accent : theme.bg.elevated }]}
          onPress={() => sendMessage(input)}
          disabled={!canSend || !input.trim()}>
          <Ionicons name="send" size={18} color={canSend && input.trim() ? theme.text.onAccent : theme.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Model Picker Modal */}
      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModelPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.bg.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Select Model</Text>
            {COACH_MODEL_OPTIONS.map(m => {
              const locked = m.tier === 'pro' && !isPro && !isUltra
              return (
                <TouchableOpacity key={m.id} disabled={locked}
                  style={[styles.modelOption, { backgroundColor: model === m.id ? theme.accentGlow : theme.bg.elevated, borderColor: model === m.id ? theme.borderAccent : theme.border, opacity: locked ? 0.4 : 1 }]}
                  onPress={() => { setModel(m.id); setShowModelPicker(false) }}>
                  <Text style={[styles.modelLabel, { color: theme.text.primary }]}>{m.label}</Text>
                  {locked && <Badge label="PRO" color={theme.warning} />}
                  {model === m.id && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  subtitle: { fontSize: fontSize.xs, marginTop: 2 },
  modelBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  styleRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  styleChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  styleText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  suggestionsWrap: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  suggestTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.lg, textAlign: 'center' },
  suggestCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  suggestText: { fontSize: fontSize.sm, flex: 1 },
  msgList: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.sm },
  msgRow: { marginBottom: spacing.sm },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAI: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  msgText: { fontSize: fontSize.sm, lineHeight: 20 },
  typingRow: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.md, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.lg },
  modelOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  modelLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
})
