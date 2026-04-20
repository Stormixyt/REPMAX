import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Badge, Button, Card, CardLabel, CardTitle, EmptyState, Input, PageHeader, SegmentedControl, SectionHeader } from '../../components/ui'
import { fontSize, fontWeight, radius, spacing } from '../../theme/spacing'

const TABS = [
  { id: 'chats', labelKey: 'social_tab_chats', icon: 'chatbubbles-outline' },
  { id: 'friends', labelKey: 'social_tab_friends', icon: 'people-outline' },
  { id: 'add', labelKey: 'social_tab_add', icon: 'person-add-outline' },
]

function buildDiceBearUrl(seed) {
  return `https://api.dicebear.com/7.x/micah/png?seed=${encodeURIComponent(seed || 'repmax')}&backgroundColor=transparent`
}

function getAvatarUri(person) {
  return person?.image_url || buildDiceBearUrl(person?.avatar_seed || person?.id || person?.username || 'repmax')
}

function formatRelativeTime(value) {
  if (!value) return ''
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return ''
  }
}

function messagePreview(message) {
  if (!message) return 'No messages yet.'
  if (message.type === 'invite') return 'Sent a training invite'
  if (message.type === 'status') return message.content || 'Status update'
  return message.content || 'New message'
}

export default function SocialScreen() {
  const navigation = useNavigation()
  const { user, profile } = useAuth()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [chats, setChats] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const mounted = useRef(true)

  const connectedUserIds = useMemo(() => {
    return new Set([
      ...friends.map((friend) => friend.id),
      ...pendingRequests.map((request) => request.id),
    ])
  }, [friends, pendingRequests])

  useEffect(() => {
    mounted.current = true
    loadSocial()
    return () => {
      mounted.current = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return undefined

    let refreshTimer = null
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        loadSocial({ silent: true })
      }, 180)
    }

    const channel = supabase
      .channel(`rn-social-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  async function loadSocial(options = {}) {
    if (!user?.id) return

    const { silent = false } = options
    if (!silent) setLoading(true)

    try {
      const [friendsRes, pendingRes, chatsRes] = await Promise.all([
        supabase
          .from('friendships')
          .select('*, friend:friend_id(id, display_name, username, avatar_seed, image_url, status_emoji, subscription_tier), requester:user_id(id, display_name, username, avatar_seed, image_url, status_emoji, subscription_tier)')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted'),
        supabase
          .from('friendships')
          .select('*, requester:user_id(id, display_name, username, avatar_seed, image_url, status_emoji, subscription_tier)')
          .eq('friend_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('chats')
          .select('*, chat_members(user_id, profiles(id, display_name, username, avatar_seed, image_url, status_emoji))')
          .order('created_at', { ascending: false }),
      ])

      const friendRows = (friendsRes.data || [])
        .map((row) => {
          const friendProfile = row.user_id === user.id ? row.friend : row.requester
          return friendProfile
            ? {
                ...friendProfile,
                friendshipId: row.id,
              }
            : null
        })
        .filter(Boolean)

      const pendingRows = (pendingRes.data || [])
        .map((row) => {
          return row.requester
            ? {
                ...row.requester,
                friendshipId: row.id,
                requesterUserId: row.user_id,
              }
            : null
        })
        .filter(Boolean)

      const rawChats = (chatsRes.data || []).filter((chat) =>
        (chat.chat_members || []).some((member) => member.user_id === user.id)
      )

      const chatIds = rawChats.map((chat) => chat.id)
      let lastMessageByChat = {}

      if (chatIds.length) {
        const { data: messageRows } = await supabase
          .from('messages')
          .select('id, chat_id, sender_id, content, type, created_at')
          .in('chat_id', chatIds)
          .order('created_at', { ascending: false })
          .limit(250)

        lastMessageByChat = (messageRows || []).reduce((acc, message) => {
          if (!acc[message.chat_id]) acc[message.chat_id] = message
          return acc
        }, {})
      }

      const formattedChats = rawChats
        .map((chat) => {
          const otherMember = (chat.chat_members || []).find((member) => member.user_id !== user.id)?.profiles
          const latestMessage = lastMessageByChat[chat.id] || null
          const isDirect = chat.type === 'direct'

          return {
            ...chat,
            title: isDirect ? otherMember?.display_name || otherMember?.username || 'Gym Buddy' : chat.name || 'Group Chat',
            avatarUri: isDirect ? getAvatarUri(otherMember) : buildDiceBearUrl(chat.name || chat.id),
            memberCount: chat.chat_members?.length || 0,
            latestMessage,
          }
        })
        .sort((a, b) => {
          const left = new Date(a.latestMessage?.created_at || a.created_at).getTime()
          const right = new Date(b.latestMessage?.created_at || b.created_at).getTime()
          return right - left
        })

      if (!mounted.current) return

      setFriends(friendRows)
      setPendingRequests(pendingRows)
      setChats(formattedChats)
    } catch (error) {
      console.error('Social load error:', error)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    loadSocial({ silent: true })
  }

  async function searchUsers() {
    const query = searchQuery.trim()
    if (!query || !user?.id) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_seed, image_url, status_emoji, subscription_tier')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', user.id)
        .limit(12)

      if (error) throw error
      if (!mounted.current) return
      setSearchResults(data || [])
    } catch (error) {
      console.error('Social search error:', error)
      if (mounted.current) setSearchResults([])
    } finally {
      if (mounted.current) setSearching(false)
    }
  }

  async function sendFriendRequest(friendId) {
    if (!user?.id || !friendId) return

    Haptics.selectionAsync().catch(() => {})

    try {
      const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .limit(1)

      if (existing?.length) {
        await loadSocial({ silent: true })
        return
      }

      await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
      })

      await loadSocial({ silent: true })
      setSearchResults((prev) => prev.filter((item) => item.id !== friendId))
    } catch (error) {
      console.error('Friend request error:', error)
    }
  }

  async function acceptFriendRequest(friendshipId) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    loadSocial({ silent: true })
  }

  async function declineFriendRequest(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    loadSocial({ silent: true })
  }

  async function openDirectChat(friendId) {
    if (!user?.id || !friendId) return

    Haptics.selectionAsync().catch(() => {})

    try {
      const { data: existingChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
      if (existingChats?.length) {
        const chatIds = existingChats.map((row) => row.chat_id)
        const { data: mutual } = await supabase
          .from('chat_members')
          .select('chat_id, chats!inner(type)')
          .eq('user_id', friendId)
          .in('chat_id', chatIds)
          .eq('chats.type', 'direct')
          .limit(1)

        if (mutual?.[0]?.chat_id) {
          navigation.navigate('ChatRoom', { chatId: mutual[0].chat_id })
          return
        }
      }

      const { data: chatRow, error: chatError } = await supabase
        .from('chats')
        .insert({ type: 'direct' })
        .select('id')
        .single()

      if (chatError || !chatRow?.id) throw chatError || new Error('Could not create chat.')

      const { error: memberError } = await supabase.from('chat_members').insert([
        { chat_id: chatRow.id, user_id: user.id },
        { chat_id: chatRow.id, user_id: friendId },
      ])

      if (memberError) throw memberError

      navigation.navigate('ChatRoom', { chatId: chatRow.id })
    } catch (error) {
      console.error('Open direct chat error:', error)
    }
  }

  function renderTabButton(tab) {
    const active = activeTab === tab.id
    return (
      <TouchableOpacity
        key={tab.id}
        activeOpacity={0.85}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {})
          setActiveTab(tab.id)
        }}
        style={[
          styles.tabButton,
          {
            backgroundColor: active ? theme.accent : theme.bg.card,
            borderColor: active ? theme.accent : theme.border,
          },
        ]}
      >
        <Ionicons name={tab.icon} size={16} color={active ? theme.text.onAccent : theme.text.secondary} />
        <Text style={[styles.tabLabel, { color: active ? theme.text.onAccent : theme.text.secondary }]}>
          {t(tab.labelKey)}
        </Text>
      </TouchableOpacity>
    )
  }

  function renderChatItem({ item }) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
      >
        <Card style={styles.listCard}>
          <View style={styles.listRow}>
            <Image source={{ uri: item.avatarUri }} style={styles.avatar} />
            <View style={styles.listCopy}>
              <View style={styles.listTopRow}>
                <Text style={[styles.listTitle, { color: theme.text.primary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.listTime, { color: theme.text.tertiary }]}>
                  {formatRelativeTime(item.latestMessage?.created_at || item.created_at)}
                </Text>
              </View>
              <Text style={[styles.listSubtitle, { color: theme.text.secondary }]} numberOfLines={1}>
                {messagePreview(item.latestMessage)}
              </Text>
              {item.type === 'group' && (
                <Text style={[styles.listMeta, { color: theme.text.tertiary }]}>
                  {item.memberCount} members
                </Text>
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    )
  }

  function renderFriendItem({ item }) {
    return (
      <Card style={styles.listCard}>
        <View style={styles.listRow}>
          <Image source={{ uri: getAvatarUri(item) }} style={styles.avatar} />
          <View style={styles.listCopy}>
            <View style={styles.nameLine}>
              <Text style={[styles.listTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {item.display_name || item.username || 'Gym Buddy'}
              </Text>
              {!!item.status_emoji && <Text style={styles.statusEmoji}>{item.status_emoji}</Text>}
            </View>
            <Text style={[styles.listSubtitle, { color: theme.text.secondary }]} numberOfLines={1}>
              @{item.username || 'unknown'}
            </Text>
          </View>
        </View>
        <View style={styles.friendActions}>
          <Button
            title="Chat"
            size="sm"
            onPress={() => openDirectChat(item.id)}
            icon={<Ionicons name="chatbubble-outline" size={14} color={theme.text.onAccent} />}
            style={styles.friendActionButton}
          />
        </View>
      </Card>
    )
  }

  function renderSearchItem({ item }) {
    const connected = connectedUserIds.has(item.id)
    return (
      <Card style={styles.listCard}>
        <View style={styles.listRow}>
          <Image source={{ uri: getAvatarUri(item) }} style={styles.avatar} />
          <View style={styles.listCopy}>
            <View style={styles.nameLine}>
              <Text style={[styles.listTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {item.display_name || item.username || 'Athlete'}
              </Text>
              {!!item.status_emoji && <Text style={styles.statusEmoji}>{item.status_emoji}</Text>}
            </View>
            <Text style={[styles.listSubtitle, { color: theme.text.secondary }]} numberOfLines={1}>
              @{item.username || 'unknown'}
            </Text>
          </View>
        </View>
        {connected ? (
          <Badge label="Connected" style={styles.connectedBadge} />
        ) : (
          <Button
            title="Add Friend"
            size="sm"
            onPress={() => sendFriendRequest(item.id)}
            icon={<Ionicons name="person-add-outline" size={14} color={theme.text.onAccent} />}
          />
        )}
      </Card>
    )
  }

  const pendingHeader = pendingRequests.length ? (
    <Card style={styles.pendingCard}>
      <CardLabel>{t('social_pending')}</CardLabel>
      <CardTitle>{pendingRequests.length} waiting on you</CardTitle>
      <View style={styles.pendingList}>
        {pendingRequests.map((request) => (
          <View key={request.friendshipId} style={[styles.pendingRow, { borderTopColor: theme.border }]}>
            <View style={styles.listRow}>
              <Image source={{ uri: getAvatarUri(request) }} style={styles.smallAvatar} />
              <View style={styles.listCopy}>
                <Text style={[styles.listTitle, { color: theme.text.primary }]} numberOfLines={1}>
                  {request.display_name || request.username || 'Athlete'}
                </Text>
                <Text style={[styles.listSubtitle, { color: theme.text.secondary }]} numberOfLines={1}>
                  @{request.username || 'unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.pendingButtons}>
              <Button title="Accept" size="sm" onPress={() => acceptFriendRequest(request.friendshipId)} />
              <Button title="Decline" size="sm" variant="secondary" onPress={() => declineFriendRequest(request.friendshipId)} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  ) : null

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg.primary }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.text.secondary }]}>Loading social…</Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg.primary }]}>
      <PageHeader title={t('social_title')} subtitle="Connect with friends and gym partners." />

      <View style={styles.tabsWrap}>
        <SegmentedControl options={['Chats', 'Friends', 'Add']} selectedIndex={activeTab} onChange={setActiveTab} />
      </View>

      {activeTab === 0 && (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title={t('social_no_messages')}
              description={t('social_no_messages_desc')}
            />
          }
        />
      )}

      {activeTab === 1 && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendshipId || item.id}
          renderItem={renderFriendItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={pendingHeader}
          ListEmptyComponent={
            <EmptyState
              icon="👥"
              title={t('social_no_friends')}
              description={t('social_no_friends_desc')}
            />
          }
        />
      )}

      {activeTab === 2 && (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.addHeader}>
              <Card>
                <CardLabel>{t('social_find_user')}</CardLabel>
                <View style={styles.searchRow}>
                  <Input
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="@username"
                    style={styles.searchInputWrap}
                    inputStyle={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={searchUsers}
                  />
                  <Button
                    title="Search"
                    size="sm"
                    onPress={searchUsers}
                    loading={searching}
                    style={styles.searchButton}
                  />
                </View>
                <Text style={[styles.usernameLine, { color: theme.text.secondary }]}>
                  {t('social_your_username')}: <Text style={{ color: theme.accent }}>@{profile?.username || 'set-one-in-settings'}</Text>
                </Text>
              </Card>
            </View>
          }
          ListEmptyComponent={
            searching ? null : (
              <EmptyState
                icon="🧭"
                title="Search the crew"
                description="Type a username or display name to add someone."
              />
            )
          }
        />
      )}
    </View>
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
  tabsWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  listCard: {
    marginBottom: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },
  smallAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
  },
  listTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  listTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
  listSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  listMeta: {
    fontSize: fontSize.xs,
    marginTop: 6,
  },
  listTime: {
    fontSize: fontSize.xs,
    flexShrink: 0,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusEmoji: {
    fontSize: fontSize.md,
  },
  pendingCard: {
    marginBottom: spacing.md,
  },
  pendingList: {
    gap: spacing.md,
  },
  pendingRow: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  pendingButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  friendActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  friendActionButton: {
    minWidth: 108,
  },
  connectedBadge: {
    alignSelf: 'flex-start',
  },
  addHeader: {
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    marginBottom: 0,
  },
  searchInput: {
    minHeight: 44,
  },
  searchButton: {
    minWidth: 88,
    marginTop: 22,
  },
  usernameLine: {
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
})
