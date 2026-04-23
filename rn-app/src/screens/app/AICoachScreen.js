import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { askCoach, COACH_MODEL_OPTIONS, COACH_RESPONSE_STYLE_OPTIONS, DEFAULT_COACH_MODEL } from '../../lib/groq'
import { Card, Badge, Kicker, Pill, PressableScale } from '../../components/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [model, setModel] = useState(DEFAULT_COACH_MODEL)
  const [style, setStyle] = useState('balanced')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [todayUsage, setTodayUsage] = useState(0)
  const flatListRef = useRef(null)

  const dailyLimit = isUltra ? 10 : isPro ? 5 : 1
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

      const response = await askCoach(userMsg.content, context, { style })
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
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: `${theme.accent}18`, borderColor: theme.borderAccent }]}>
            <Ionicons name="sparkles" size={13} color={theme.accent} />
          </View>
        )}
        <View style={[styles.msgBubble, {
          backgroundColor: isUser ? theme.accent : theme.bg.card,
          borderColor: isUser ? theme.accent : theme.border,
          borderBottomRightRadius: isUser ? 6 : radius.lg,
          borderBottomLeftRadius: isUser ? radius.lg : 6,
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageKicker, { color: theme.text.tertiary }]}>COACH</Text>
          <Text style={[styles.title, { color: theme.text.primary }]}>Ask anything</Text>
          <View style={styles.usageRow}>
            <View style={[styles.usageDot, { backgroundColor: todayUsage < dailyLimit ? theme.accent : theme.danger }]} />
            <Text style={[styles.subtitle, { color: theme.text.tertiary }]}>
              {todayUsage}/{dailyLimit} today · Claude Haiku 4.5
            </Text>
          </View>
        </View>
        <PressableScale onPress={() => setShowModelPicker(true)} haptic="light">
          <View style={[styles.modelBtn, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            <Ionicons name="options-outline" size={18} color={theme.text.secondary} />
          </View>
        </PressableScale>
      </View>

      {/* Style selector — segmented pill bar */}
      <View style={styles.styleRowWrap}>
        <View style={[styles.styleTrack, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          {COACH_RESPONSE_STYLE_OPTIONS.map(s => {
            const active = style === s.id
            return (
              <PressableScale key={s.id} onPress={() => setStyle(s.id)} haptic="light" style={{ flex: 1 }}>
                <View style={[styles.styleChip, active && { backgroundColor: theme.accent }]}>
                  <Text style={[styles.styleText, { color: active ? theme.text.onAccent : theme.text.secondary }]}>{s.label}</Text>
                </View>
              </PressableScale>
            )
          })}
        </View>
      </View>

      {/* Messages */}
      {loadingHistory ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={theme.accent} /></View>
      ) : messages.length === 0 ? (
        <View style={styles.suggestionsWrap}>
          <View style={[styles.welcomeBadge, { backgroundColor: theme.bg.card, borderColor: theme.borderAccent }]}>
            <Ionicons name="sparkles" size={14} color={theme.accent} />
            <Text style={[styles.welcomeBadgeText, { color: theme.accent }]}>REPMAX COACH</Text>
          </View>
          <Text style={[styles.suggestTitle, { color: theme.text.primary }]}>What's on your mind?</Text>
          <Text style={[styles.suggestSub, { color: theme.text.tertiary }]}>Programming, form cues, nutrition — ask anything.</Text>
          <View style={{ gap: spacing.sm, width: '100%', marginTop: spacing.xl }}>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <PressableScale key={i} onPress={() => sendMessage(p.text)} haptic="light">
                <View style={[styles.suggestCard, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                  <View style={[styles.suggestIconShell, { backgroundColor: `${theme.accent}14`, borderColor: theme.borderAccent }]}>
                    <Ionicons name={p.icon} size={16} color={theme.accent} />
                  </View>
                  <Text style={[styles.suggestText, { color: theme.text.primary }]}>{p.text}</Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.text.tertiary} />
                </View>
              </PressableScale>
            ))}
          </View>
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
        <View style={styles.typingWrap}>
          <View style={[styles.aiAvatar, { backgroundColor: `${theme.accent}18`, borderColor: theme.borderAccent }]}>
            <Ionicons name="sparkles" size={13} color={theme.accent} />
          </View>
          <View style={[styles.typingBubble, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
            <View style={[styles.typingDot, { backgroundColor: theme.accent }]} />
            <View style={[styles.typingDot, { backgroundColor: theme.accent, opacity: 0.6 }]} />
            <View style={[styles.typingDot, { backgroundColor: theme.accent, opacity: 0.3 }]} />
          </View>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: 'rgba(7,7,7,0.95)', borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={[styles.inputWrap, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text.primary }]}
            placeholder="Ask your coach..."
            placeholderTextColor={theme.text.tertiary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            editable={canSend}
          />
          <PressableScale
            onPress={() => sendMessage(input)}
            haptic="medium"
            disabled={!canSend || !input.trim()}
          >
            <View style={[styles.sendBtn, { backgroundColor: canSend && input.trim() ? theme.accent : theme.bg.elevated }]}>
              {canSend && input.trim() && (
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              )}
              <Ionicons name="arrow-up" size={18} color={canSend && input.trim() ? theme.text.onAccent : theme.text.tertiary} />
            </View>
          </PressableScale>
        </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  pageKicker: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: fontWeight.black, letterSpacing: -0.8, lineHeight: 32, marginTop: 4 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  usageDot: { width: 6, height: 6, borderRadius: 3 },
  subtitle: { fontSize: 12 },
  modelBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 20 },
  styleRowWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.md },
  styleTrack: { flexDirection: 'row', padding: 4, borderRadius: radius.full, borderWidth: 1, gap: 2 },
  styleChip: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  styleText: { fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  suggestionsWrap: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, alignItems: 'center' },
  welcomeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, marginBottom: spacing.lg },
  welcomeBadgeText: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 1.6 },
  suggestTitle: { fontSize: 22, fontWeight: fontWeight.black, letterSpacing: -0.6, textAlign: 'center' },
  suggestSub: { fontSize: 13, textAlign: 'center', marginTop: 6, maxWidth: 280 },
  suggestCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  suggestIconShell: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  suggestText: { fontSize: 14, flex: 1, lineHeight: 19, fontWeight: fontWeight.medium },
  msgList: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.sm },
  msgRow: { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  aiAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  msgBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1 },
  msgText: { fontSize: 14, lineHeight: 20 },
  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  typingBubble: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1 },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  inputBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, borderRadius: radius.full, borderWidth: 1 },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSize.md, maxHeight: 120, minHeight: 40 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: fontWeight.black, letterSpacing: -0.5, marginBottom: spacing.lg },
  modelOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  modelLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
})
