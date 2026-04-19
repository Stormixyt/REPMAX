import { useState, useEffect } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../theme/ThemeContext'
import { supabase } from '../../lib/supabase'
import { Card, CardLabel, Button, StatBox, Badge } from '../../components/ui'
import { spacing, fontSize, fontWeight, radius } from '../../theme/spacing'

export default function AdminScreen() {
  const navigation = useNavigation()
  const { user, isAdmin } = useAuth()
  const { theme } = useTheme()
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ users: 0, workouts: 0, prs: 0, activeToday: 0 })
  const [waitlist, setWaitlist] = useState([])
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [tab])

  async function loadData() {
    setLoading(true)
    try {
      if (tab === 'dashboard') {
        const [uRes, wRes, pRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('workouts').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null),
          supabase.from('personal_records').select('id', { count: 'exact', head: true }),
        ])
        setStats({ users: uRes.count || 0, workouts: wRes.count || 0, prs: pRes.count || 0 })
      } else if (tab === 'requests') {
        const { data } = await supabase.from('waitlist').select('*').eq('approved', false).order('created_at', { ascending: false }).limit(50)
        setWaitlist(data || [])
      } else if (tab === 'users') {
        let query = supabase.from('profiles').select('id, display_name, username, subscription_tier, created_at').order('created_at', { ascending: false }).limit(50)
        if (search.trim()) query = query.ilike('display_name', `%${search}%`)
        const { data } = await query
        setUsers(data || [])
      }
    } catch (err) { console.error('Admin load:', err) }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await loadData(); setRefreshing(false) }

  async function approveWaitlist(id) {
    await supabase.from('waitlist').update({ approved: true }).eq('id', id)
    setWaitlist(prev => prev.filter(w => w.id !== id))
  }

  async function rejectWaitlist(id) {
    Alert.alert('Reject', 'Remove this user from waitlist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        await supabase.from('waitlist').delete().eq('id', id)
        setWaitlist(prev => prev.filter(w => w.id !== id))
      }},
    ])
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg.primary, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="lock-closed" size={48} color={theme.text.tertiary} />
        <Text style={[styles.lockedText, { color: theme.text.secondary }]}>Admin access only</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Admin</Text>
      </View>

      <View style={styles.tabRow}>
        {['dashboard', 'requests', 'users'].map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, { backgroundColor: tab === t ? theme.accent : theme.bg.elevated }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, { color: tab === t ? theme.text.onAccent : theme.text.secondary }]}>
              {t === 'dashboard' ? 'Stats' : t === 'requests' ? 'Waitlist' : 'Users'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tab === 'dashboard' ? [1] : tab === 'requests' ? waitlist : users}
        keyExtractor={(item, i) => item?.id || String(i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }}
        ListHeaderComponent={loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : null}
        renderItem={({ item, index }) => {
          if (tab === 'dashboard' && !loading) {
            return (
              <View>
                <View style={styles.statsRow}>
                  <StatBox value={stats.users} label="Users" />
                  <StatBox value={stats.workouts} label="Workouts" />
                  <StatBox value={stats.prs} label="PRs" />
                </View>
              </View>
            )
          }
          if (tab === 'requests') {
            return (
              <View style={[styles.waitlistRow, { backgroundColor: theme.bg.card, borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.waitlistEmail, { color: theme.text.primary }]}>{item.email}</Text>
                  <Text style={[styles.waitlistDate, { color: theme.text.tertiary }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: theme.success }]} onPress={() => approveWaitlist(item.id)}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: theme.danger }]} onPress={() => rejectWaitlist(item.id)}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )
          }
          return (
            <View style={[styles.userRow, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: theme.text.primary }]}>{item.display_name || 'No name'}</Text>
                <Text style={[styles.userMeta, { color: theme.text.tertiary }]}>@{item.username || '—'} · {item.subscription_tier || 'free'}</Text>
              </View>
              {item.subscription_tier && item.subscription_tier !== 'free' && (
                <Badge label={item.subscription_tier.toUpperCase()} color={theme.accent} />
              )}
            </View>
          )
        }}
        ListHeaderComponent={() => {
          if (tab === 'users') {
            return (
              <TextInput style={[styles.searchInput, { backgroundColor: theme.bg.input, color: theme.text.primary, borderColor: theme.border }]}
                placeholder="Search users..." placeholderTextColor={theme.text.tertiary}
                value={search} onChangeText={setSearch} onSubmitEditing={loadData} returnKeyType="search" />
            )
          }
          return loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : null
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  lockedText: { fontSize: fontSize.md, marginTop: spacing.lg },
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' },
  tabLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  waitlistRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm, gap: spacing.sm },
  waitlistEmail: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  waitlistDate: { fontSize: fontSize.xs, marginTop: 2 },
  approveBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1 },
  userName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  userMeta: { fontSize: fontSize.xs, marginTop: 2 },
  searchInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: fontSize.sm, marginBottom: spacing.md },
})
