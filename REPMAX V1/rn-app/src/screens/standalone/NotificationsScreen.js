import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Button, EmptyState } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

const NOTIF_ICONS = {
  message: 'chatbubble',
  friend_request: 'person-add',
  friend_accepted: 'people',
  incoming_call: 'call',
  nudge: 'megaphone',
  training_invite: 'barbell',
  new_pr: 'trophy',
  streak_warning: 'flame',
  daily_reminder: 'alarm',
  weekly_progress: 'bar-chart',
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function NotificationsScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const { theme } = useTheme()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await loadNotifications(); setRefreshing(false) }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleTap(notif) {
    markRead(notif.id)
    if (notif.data?.chat_id) navigation.navigate('ChatRoom', { chatId: notif.data.chat_id })
  }

  function renderNotif({ item }) {
    const iconName = NOTIF_ICONS[item.type] || 'notifications'
    return (
      <TouchableOpacity style={[styles.notifRow, !item.read && { backgroundColor: theme.accentGlow }]} onPress={() => handleTap(item)}>
        <View style={[styles.notifIcon, { backgroundColor: theme.bg.elevated }]}>
          <Ionicons name={iconName} size={18} color={item.read ? theme.text.tertiary : theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.notifTitle, { color: theme.text.primary }]}>{item.title || 'Notification'}</Text>
          {item.body && <Text style={[styles.notifBody, { color: theme.text.secondary }]} numberOfLines={2}>{item.body}</Text>}
          <Text style={[styles.notifTime, { color: theme.text.tertiary }]}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={[styles.markAll, { color: theme.accent }]}>Read All</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={notifications}
          renderItem={renderNotif}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListEmptyComponent={<EmptyState icon="🔔" title="No notifications" description="You're all caught up." />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  markAll: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md },
  notifIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  notifBody: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  notifTime: { fontSize: 10, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
})
