import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { format, formatDistanceToNow, isToday } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useCall } from '../../context/CallContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Button, EmptyState } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const PAGE_SIZE = 40

function buildDiceBearUrl(seed) {
  return `https://api.dicebear.com/7.x/micah/png?seed=${encodeURIComponent(seed || 'repmax')}&backgroundColor=transparent`
}

function getAvatarUri(person) {
  return person?.image_url || buildDiceBearUrl(person?.avatar_seed || person?.id || person?.username || 'repmax')
}

function formatMessageTime(value) {
  if (!value) return ''

  try {
    const date = new Date(value)
    if (Date.now() - date.getTime() < 1000 * 60 * 60 * 16) {
      return formatDistanceToNow(date, { addSuffix: true })
    }

    if (isToday(date)) {
      return format(date, 'HH:mm')
    }

    return format(date, 'MMM d, HH:mm')
  } catch {
    return ''
  }
}

export default function ChatRoomScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { chatId } = route.params || {}
  const { user } = useAuth()
  const { theme } = useTheme()
  const { setActiveCall, showCallToast } = useCall()
  const [chatMeta, setChatMeta] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [draft, setDraft] = useState('')
  const mounted = useRef(true)
  const listRef = useRef(null)
  const initialScrollDone = useRef(false)

  useEffect(() => {
    mounted.current = true
    loadChat()
    return () => {
      mounted.current = false
    }
  }, [chatId, user?.id])

  useEffect(() => {
    if (!chatId) return undefined

    const channel = supabase
      .channel(`rn-chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const incomingId = payload.new?.id
          if (!incomingId || !mounted.current) return

          setMessages((prev) => {
            if (prev.some((message) => message.id === incomingId)) return prev
            return [...prev, payload.new]
          })

          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true })
          }, 40)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId])

  useEffect(() => {
    if (!loading && messages.length && !initialScrollDone.current) {
      initialScrollDone.current = true
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false })
      }, 40)
    }
  }, [loading, messages.length])

  async function loadChat(targetPage = 0, options = {}) {
    if (!chatId || !user?.id) return

    const { preserveLoading = false } = options

    try {
      if (!preserveLoading) setLoading(true)

      const [metaRes, messagesRes] = await Promise.all([
        supabase
          .from('chats')
          .select('*, chat_members(user_id, profiles(id, display_name, username, avatar_seed, image_url, status_emoji))')
          .eq('id', chatId)
          .single(),
        supabase
          .from('messages')
          .select('id, chat_id, sender_id, content, type, created_at, sender:sender_id(id, display_name, username, avatar_seed, image_url)')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .range(0, (targetPage + 1) * PAGE_SIZE - 1),
      ])

      if (!mounted.current) return

      const rawMeta = metaRes.data
      if (rawMeta) {
        if (rawMeta.type === 'direct') {
          const other = rawMeta.chat_members?.find((member) => member.user_id !== user.id)?.profiles
          setChatMeta({
            id: rawMeta.id,
            type: rawMeta.type,
            title: other?.display_name || other?.username || 'Gym Buddy',
            avatarUri: getAvatarUri(other),
            members: rawMeta.chat_members || [],
          })
        } else {
          setChatMeta({
            id: rawMeta.id,
            type: rawMeta.type,
            title: rawMeta.name || 'Group Chat',
            avatarUri: buildDiceBearUrl(rawMeta.name || rawMeta.id),
            members: rawMeta.chat_members || [],
          })
        }
      }

      const newestFirst = messagesRes.data || []
      const ascending = [...newestFirst].reverse()
      setMessages(ascending)
      setPage(targetPage)
      setHasMore(newestFirst.length === (targetPage + 1) * PAGE_SIZE)
    } catch (error) {
      console.error('Chat room load error:', error)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setLoadingOlder(false)
      }
    }
  }

  async function loadOlderMessages() {
    if (loadingOlder || !hasMore) return
    setLoadingOlder(true)
    await loadChat(page + 1, { preserveLoading: true })
  }

  async function sendMessage() {
    const content = draft.trim()
    if (!content || !user?.id || !chatId) return

    Haptics.selectionAsync().catch(() => {})
    setSending(true)

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content,
          type: 'text',
        })
        .select('id, chat_id, sender_id, content, type, created_at, sender:sender_id(id, display_name, username, avatar_seed, image_url)')
        .single()

      if (error) throw error

      if (mounted.current) {
        setDraft('')
        setMessages((prev) => {
          if (!data || prev.some((message) => message.id === data.id)) return prev
          return [...prev, data]
        })
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true })
        }, 40)
      }
    } catch (error) {
      console.error('Send message error:', error)
    } finally {
      if (mounted.current) setSending(false)
    }
  }

  function startCall(withVideo) {
    Haptics.selectionAsync().catch(() => {})
    setActiveCall({
      chatId,
      type: withVideo ? 'video' : 'voice',
      startedAt: new Date().toISOString(),
      peerName: chatMeta?.title || 'Gym Buddy',
    })
    showCallToast(`Native ${withVideo ? 'video' : 'voice'} shell is armed. Full in-call UI is next.`)
  }

  function handleScroll(event) {
    if (event.nativeEvent.contentOffset.y < 80) {
      loadOlderMessages()
    }
  }

  function renderMessage({ item }) {
    const ownMessage = item.sender_id === user?.id
    const sender = item.sender || chatMeta?.members?.find((member) => member.user_id === item.sender_id)?.profiles
    const isGroup = chatMeta?.type === 'group'

    return (
      <View style={[styles.messageWrap, ownMessage ? styles.messageWrapOwn : styles.messageWrapOther]}>
        {!ownMessage && isGroup && (
          <View style={styles.senderRow}>
            <Image source={{ uri: getAvatarUri(sender) }} style={styles.senderAvatar} />
            <Text style={[styles.senderName, { color: theme.text.tertiary }]}>
              {sender?.display_name || sender?.username || 'Athlete'}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bubble,
            {
              alignSelf: ownMessage ? 'flex-end' : 'flex-start',
              backgroundColor: ownMessage ? theme.accent : theme.bg.card,
              borderColor: ownMessage ? theme.accent : theme.border,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: ownMessage ? theme.text.onAccent : theme.text.primary }]}>
            {item.content || ''}
          </Text>
        </View>

        <Text
          style={[
            styles.messageTime,
            {
              color: theme.text.tertiary,
              textAlign: ownMessage ? 'right' : 'left',
            },
          ]}
        >
          {formatMessageTime(item.created_at)}
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Loading chat…</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.bg.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.bg.secondary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconButton}>
          <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Image source={{ uri: chatMeta?.avatarUri || buildDiceBearUrl('repmax') }} style={styles.headerAvatar} />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
              {chatMeta?.title || 'Chat'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]} numberOfLines={1}>
              {chatMeta?.type === 'group'
                ? `${chatMeta?.members?.length || 0} members`
                : 'Direct chat'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => startCall(false)} style={styles.headerIconButton}>
            <Ionicons name="call-outline" size={18} color={theme.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startCall(true)} style={styles.headerIconButton}>
            <Ionicons name="videocam-outline" size={18} color={theme.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
        ListHeaderComponent={
          loadingOlder ? (
            <View style={styles.loadingOlder}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          ) : hasMore ? (
            <View style={styles.loadOlderWrap}>
              <Button
                title="Load older messages"
                size="sm"
                variant="secondary"
                onPress={loadOlderMessages}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title="No messages yet"
            description="Drop the first message and start the chat."
          />
        }
      />

      <View style={[styles.composerWrap, { borderTopColor: theme.border, backgroundColor: theme.bg.secondary }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Send a message"
          placeholderTextColor={theme.text.tertiary}
          style={[
            styles.composerInput,
            {
              backgroundColor: theme.bg.input,
              color: theme.text.primary,
              borderColor: theme.border,
            },
          ]}
          multiline
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={sendMessage}
          disabled={!draft.trim() || sending}
          style={[
            styles.sendButton,
            {
              backgroundColor: draft.trim() ? theme.accent : theme.bg.elevated,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.text.onAccent} />
          ) : (
            <Ionicons name="send" size={18} color={draft.trim() ? theme.text.onAccent : theme.text.secondary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadOlderWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loadingOlder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  messageWrap: {
    marginBottom: spacing.md,
  },
  messageWrapOwn: {
    alignItems: 'flex-end',
  },
  messageWrapOther: {
    alignItems: 'flex-start',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
  },
  senderName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  bubble: {
    maxWidth: '84%',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleText: {
    fontSize: fontSize.md,
    lineHeight: 21,
  },
  messageTime: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: fontSize.md,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
