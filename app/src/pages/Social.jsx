import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendNotification, NotificationTemplates } from '../lib/notifications'
import GymPicker from '../components/GymPicker'
import {
  RiUserAddFill, RiSearchLine, RiTeamFill, RiChat3Fill,
  RiVipCrownFill, RiFlashlightFill, RiCheckFill, RiCloseFill,
  RiMapPin2Fill, RiTimeFill, RiCalendarLine,
  RiArrowRightSLine
} from '@remixicon/react'

export default function Social() {
  const { user, profile, isPro } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('messages')
  const [friends, setFriends] = useState([])
  const [appointments, setAppointments] = useState([])
  const [chats, setChats] = useState([])
  const [pending, setPending] = useState([])
  const [searchCode, setSearchCode] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [inviteFriendId, setInviteFriendId] = useState(null)
  const [inviteGymName, setInviteGymName] = useState('')
  const [inviteDate, setInviteDate] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedFriends, setSelectedFriends] = useState([])
  const [toast, setToast] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadSocial()
    return () => { mounted.current = false }
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function formatApptDate(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let dayLabel
    if (d.toDateString() === now.toDateString()) dayLabel = 'Today'
    else if (d.toDateString() === tomorrow.toDateString()) dayLabel = 'Tomorrow'
    else dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return { dayLabel, timeLabel }
  }

  async function loadSocial() {
    try {
      // Fetch friends and pending in parallel; gym_appointments may not exist yet
      const [friendsRes, pendingRes] = await Promise.all([
        supabase.from('friendships').select('*, friend:friend_id(id, display_name, total_workouts, subscription_status, avatar_seed), requester:user_id(id, display_name, total_workouts, subscription_status, avatar_seed)').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('friendships').select('*, requester:user_id(id, display_name, total_workouts, avatar_seed)').eq('friend_id', user.id).eq('status', 'pending'),
      ])

      // Appointments — gracefully handle table not existing
      let apptData = []
      try {
        const apptRes = await supabase.from('gym_appointments')
          .select('*, guest:guest_id(display_name, avatar_seed), creator:creator_id(display_name, avatar_seed)')
          .or(`creator_id.eq.${user.id},guest_id.eq.${user.id}`)
          .in('status', ['pending', 'accepted'])
          .order('scheduled_at', { ascending: true })
        apptData = apptRes.data || []
      } catch {}

      let chatsRes = { data: [] }
      try {
        chatsRes = await supabase.from('chats').select('*, chat_members(user_id, profiles(display_name, avatar_seed))').order('created_at', { ascending: false })
      } catch {}

      const friendsList = (friendsRes.data || [])
        .map(f => {
          const isSender = f.user_id === user.id
          const friendProfile = isSender ? f.friend : f.requester
          return friendProfile ? { ...friendProfile, friendship_id: f.id } : null
        })
        .filter(Boolean)

      const pendingList = (pendingRes.data || [])
        .map(f => f.requester ? { ...f.requester, friendship_id: f.id, requester_user_id: f.user_id } : null)
        .filter(Boolean)

      if (!mounted.current) return
      setFriends(friendsList)
      setPending(pendingList)
      setAppointments(apptData)

      const formattedChats = (chatsRes.data || []).map(c => {
        if (c.type === 'direct') {
          const other = c.chat_members?.find(m => m.user_id !== user.id)
          return { ...c, title: other?.profiles?.display_name || 'User', avatar: other?.profiles?.avatar_seed || 'default' }
        }
        return { ...c, title: c.name || 'Group Chat' }
      })
      setChats(formattedChats)
    } catch (err) {
      console.error('Social load:', err)
    }
    if (mounted.current) setLoading(false)
  }

  async function searchFriend() {
    if (!searchCode.trim() || searchCode.trim().length < 4) return
    setSearching(true)
    setSearchResult(null)
    const code = searchCode.trim().toUpperCase()
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, total_workouts, subscription_status, friend_code, avatar_seed')
      .eq('friend_code', code)
      .neq('id', user.id)
      .limit(1)
    setSearchResult(data?.[0] || 'not_found')
    setSearching(false)
  }

  async function sendFriendRequest(friendId) {
    const existing = await supabase.from('friendships').select('id').or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`).limit(1)
    if (existing.data?.length > 0) { showToast('Already connected!'); return }
    if (!isPro && friends.length >= 3) { showToast('Free users can add up to 3 friends. Upgrade to PRO!'); return }

    await supabase.from('friendships').insert({ user_id: user.id, friend_id: friendId })
    const tmpl = NotificationTemplates.friendRequest(profile.display_name)
    await sendNotification({ userId: friendId, ...tmpl, data: { sender_id: user.id } })
    showToast('Friend request sent! ⚡')
    setSearchResult(null)
    setSearchCode('')
    loadSocial()
  }

  async function acceptFriend(friendshipId, requesterUserId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    if (requesterUserId) {
      const tmpl = NotificationTemplates.friendAccepted(profile.display_name)
      await sendNotification({ userId: requesterUserId, ...tmpl, data: { accepter_id: user.id } })
    }
    showToast('Friend added!')
    loadSocial()
  }

  async function declineFriend(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    loadSocial()
  }

  async function sendInvite() {
    if (!inviteGymName || !inviteDate || !inviteFriendId) return

    const { error } = await supabase.from('gym_appointments').insert({
      creator_id: user.id,
      guest_id: inviteFriendId,
      gym_name: inviteGymName,
      scheduled_at: new Date(inviteDate).toISOString(),
      status: 'pending'
    })

    if (!error) {
      // Try to send a chat message about it (find direct chat)
      try {
        const { data: myChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
        if (myChats?.length > 0) {
          const chatIds = myChats.map(c => c.chat_id)
          const { data: mutual } = await supabase.from('chat_members')
            .select('chat_id, chats!inner(type)')
            .eq('user_id', inviteFriendId)
            .in('chat_id', chatIds)
            .eq('chats.type', 'direct')
            .limit(1)

          if (mutual?.[0]) {
            const { dayLabel, timeLabel } = formatApptDate(inviteDate)
            await supabase.from('messages').insert({
              chat_id: mutual[0].chat_id,
              sender_id: user.id,
              content: JSON.stringify({ location: inviteGymName, time: `${dayLabel} at ${timeLabel}`, acceptedBy: [] }),
              type: 'invite'
            })
          }
        }
      } catch {}

      showToast('Invite sent! ⚡')
      setInviteFriendId(null)
      setInviteGymName('')
      setInviteDate('')
      await loadSocial()
    } else {
      showToast('Failed to send invite')
    }
  }

  async function handleAcceptAppointment(apptId) {
    await supabase.from('gym_appointments').update({ status: 'accepted' }).eq('id', apptId)
    showToast('Accepted! See you there 💪')
    await loadSocial()
  }

  async function handleDeclineAppointment(apptId) {
    await supabase.from('gym_appointments').update({ status: 'declined' }).eq('id', apptId)
    showToast('Declined')
    await loadSocial()
  }

  async function handleImHere(appt) {
    const isCreator = appt.creator_id === user.id
    const updates = isCreator ? { creator_arrived: true } : { guest_arrived: true }
    await supabase.from('gym_appointments').update(updates).eq('id', appt.id)
    showToast("Marked as arrived! 📍")
    await loadSocial()
  }

  async function openDirectChat(friendId) {
    const { error: testErr } = await supabase.from('chats').select('id').limit(1)
    if (testErr) { showToast("Chat tables not set up yet"); return }

    const { data: existingChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
    if (existingChats?.length > 0) {
      const chatIds = existingChats.map(c => c.chat_id)
      const { data: mutual } = await supabase.from('chat_members').select('chat_id, chats!inner(type)').eq('user_id', friendId).in('chat_id', chatIds).eq('chats.type', 'direct').limit(1)
      if (mutual?.[0]) {
        navigate(`/chat/${mutual[0].chat_id}`)
        return
      }
    }

    const chatId = crypto.randomUUID()
    const { error } = await supabase.from('chats').insert({ id: chatId, type: 'direct' })
    if (!error) {
      await supabase.from('chat_members').insert([
        { chat_id: chatId, user_id: user.id },
        { chat_id: chatId, user_id: friendId }
      ])
      navigate(`/chat/${chatId}`)
    }
  }

  async function createGroup() {
    if (!groupName.trim() || selectedFriends.length === 0) {
      showToast('Need a name and at least 1 friend!')
      return
    }
    const chatId = crypto.randomUUID()
    const { error } = await supabase.from('chats').insert({ id: chatId, type: 'group', name: groupName.trim() })
    if (!error) {
      const members = selectedFriends.map(fId => ({ chat_id: chatId, user_id: fId }))
      members.push({ chat_id: chatId, user_id: user.id })
      await supabase.from('chat_members').insert(members)
      setShowGroupForm(false)
      setGroupName('')
      setSelectedFriends([])
      navigate(`/chat/${chatId}`)
    }
  }

  function openDirections(gymName) {
    // Universal: works on iOS (Apple Maps) and Android (Google Maps)
    const encoded = encodeURIComponent(gymName)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const url = isIOS
      ? `maps://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`
    window.open(url, '_blank')
  }

  const friendCode = profile?.friend_code || '...'

  if (loading) return (
    <div className="page">
      <div className="page-header"><div className="skeleton" style={{ width: 160, height: 28 }} /></div>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 16, marginBottom: 8 }} />)}
    </div>
  )

  return (
    <div className="page">
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <h1 className="page-title">Social</h1>

        {/* ═══ UPCOMING SESSIONS ═══ */}
        {appointments.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <RiCalendarLine size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Upcoming Sessions
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{appointments.length} planned</span>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 8, margin: '0 -20px', padding: '0 20px', scrollSnapType: 'x mandatory' }}>
              {appointments.map(a => {
                const isCreator = a.creator_id === user.id
                const other = isCreator ? a.guest : a.creator
                const arrived = isCreator ? a.creator_arrived : a.guest_arrived
                const partnerArrived = isCreator ? a.guest_arrived : a.creator_arrived
                const { dayLabel, timeLabel } = formatApptDate(a.scheduled_at)
                const isPending = a.status === 'pending'

                return (
                  <div key={a.id} style={{
                    minWidth: 280, flexShrink: 0, scrollSnapAlign: 'start',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '18px 16px', position: 'relative', overflow: 'hidden'
                  }}>
                    {/* Status indicator */}
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                      padding: '3px 8px', borderRadius: 6,
                      background: isPending ? 'rgba(255,180,0,0.15)' : 'rgba(0,220,130,0.15)',
                      color: isPending ? '#ffb400' : '#00dc82'
                    }}>
                      {isPending ? 'Pending' : 'Confirmed'}
                    </div>

                    {/* Friend info */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      <img
                        src={`https://api.dicebear.com/7.x/micah/svg?seed=${other?.avatar_seed || 'default'}&backgroundColor=transparent`}
                        style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '2px solid var(--border)' }}
                        alt=""
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {other?.display_name || 'Friend'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Gym Partner</div>
                      </div>
                    </div>

                    {/* Location & Time */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RiMapPin2Fill size={15} color="var(--accent)" />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{a.gym_name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RiTimeFill size={15} color="var(--accent)" />
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{dayLabel} at {timeLabel}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {isPending && !isCreator && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: '0.85rem', borderRadius: 12 }} onClick={() => handleAcceptAppointment(a.id)}>
                          <RiCheckFill size={15} style={{ marginRight: 4, verticalAlign: -2 }} /> Accept
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: '0.85rem', borderRadius: 12 }} onClick={() => handleDeclineAppointment(a.id)}>
                          Decline
                        </button>
                      </div>
                    )}

                    {isPending && isCreator && (
                      <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>
                        Waiting for {other?.display_name || 'friend'} to respond...
                      </div>
                    )}

                    {!isPending && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '10px 0', fontSize: '0.85rem', borderRadius: 12 }} onClick={() => openDirections(a.gym_name)}>
                          <RiNavigation2Fill size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Directions
                        </button>
                        <button
                          className={`btn ${arrived ? 'btn-secondary' : 'btn-primary'}`}
                          style={{
                            flex: 1, padding: '10px 0', fontSize: '0.85rem', borderRadius: 12,
                            ...(arrived && { background: 'var(--success)', color: '#000', borderColor: 'var(--success)', opacity: 0.8 })
                          }}
                          onClick={() => !arrived && handleImHere(a)}
                          disabled={arrived}
                        >
                          <RiRunFill size={15} style={{ marginRight: 4, verticalAlign: -2 }} />
                          {arrived ? "You're There" : "I'm Here!"}
                        </button>
                      </div>
                    )}

                    {/* Partner arrived indicator */}
                    {partnerArrived && (
                      <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <RiCheckFill size={13} /> {other?.display_name} has arrived at the gym
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="v3-tabs" style={{ marginTop: appointments.length > 0 ? 8 : 16 }}>
          {[
            { id: 'messages', label: 'Chats', icon: <RiChat3Fill size={15} /> },
            { id: 'friends', label: 'Friends', icon: <RiTeamFill size={15} /> },
            { id: 'search', label: 'Add', icon: <RiSearchLine size={15} /> },
          ].map(t => (
            <button key={t.id} className={`v3-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
              {t.id === 'search' && pending.length > 0 && <span className="tab-badge">{pending.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingBottom: 100 }}>

        {/* ═══ MESSAGES TAB ═══ */}
        {tab === 'messages' && (
          <div className="anim-slide-up">
            <button className="fab-create" onClick={() => setShowGroupForm(true)}>
              <div className="fab-create-icon"><RiUserAddFill size={20} /></div>
              Create New Group Chat
            </button>

            {chats.length === 0 ? (
              <div className="v3-empty">
                <RiChat3Fill size={48} className="v3-empty-icon" />
                <h3 className="v3-empty-title">No Messages Yet</h3>
                <p className="v3-empty-desc">Start a chat from your Friends tab!</p>
              </div>
            ) : (
              <div className="chat-list stagger-children">
                {chats.map(c => (
                  <div key={c.id} className="chat-list-item" onClick={() => navigate(`/chat/${c.id}`)}>
                    {c.type === 'direct' ? (
                      <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${c.avatar}&backgroundColor=transparent`} className="chat-list-avatar" alt="" />
                    ) : (
                      <div className="chat-list-avatar group">
                        <RiTeamFill size={22} />
                      </div>
                    )}
                    <div className="chat-list-info">
                      <div className="chat-list-name">{c.title}</div>
                      <div className="chat-list-preview">
                        {c.type === 'direct' ? 'Tap to chat' : `${c.chat_members?.length || 0} members`}
                      </div>
                    </div>
                    <div className="chat-list-meta">
                      <div className="chat-list-time">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
                      </div>
                      <RiArrowRightSLine size={18} color="var(--text-tertiary)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ FRIENDS TAB ═══ */}
        {tab === 'friends' && (
          <div className="anim-slide-up">
            {friends.length === 0 ? (
              <div className="v3-empty">
                <RiTeamFill size={48} className="v3-empty-icon" />
                <h3 className="v3-empty-title">No Friends Yet</h3>
                <p className="v3-empty-desc">Go to the Add tab to connect with friends using their code.</p>
              </div>
            ) : (
              <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {friends.map(f => (
                  <div key={f.id} className="v3-friend-card" onClick={() => openDirectChat(f.id)}>
                    <div className={`v3-friend-avatar ${f.subscription_status === 'pro' ? 'pro' : ''}`}>
                      <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${f.avatar_seed || f.id}&backgroundColor=transparent`} alt="" />
                    </div>
                    <div className="v3-friend-info">
                      <div className="v3-friend-name">
                        {f.display_name}
                        {f.subscription_status === 'pro' && <RiVipCrownFill size={14} style={{ color: 'var(--accent)' }} />}
                      </div>
                      <div className="v3-friend-meta">{f.total_workouts || 0} workouts</div>
                    </div>
                    <div className="v3-friend-actions">
                      <button className="v3-action-btn accent" onClick={e => { e.stopPropagation(); openDirectChat(f.id) }} title="Message">
                        <RiChat3Fill size={18} />
                      </button>
                      <button className="v3-action-btn" onClick={e => { e.stopPropagation(); setInviteFriendId(f.id); setInviteGymName(''); setInviteDate('') }} title="Plan Workout" style={{ color: 'var(--accent)' }}>
                        <RiFlashlightFill size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ SEARCH / ADD TAB ═══ */}
        {tab === 'search' && (
          <div className="anim-slide-up">
            <div className="friend-code-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Your Friend Code
              </div>
              <div className="friend-code-display">{friendCode}</div>
              <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard?.writeText(friendCode); showToast('Copied!') }}>
                Copy Code
              </button>
            </div>

            <div className="v3-search-box">
              <RiSearchLine size={18} className="v3-search-icon" />
              <input
                type="text"
                className="v3-search-input"
                placeholder="A1B2C3D4"
                value={searchCode}
                onChange={e => setSearchCode(e.target.value.toUpperCase())}
                maxLength={8}
                onKeyDown={e => e.key === 'Enter' && searchFriend()}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={searchFriend} disabled={searching || searchCode.length < 4} style={{ marginBottom: 24 }}>
              {searching ? 'Searching...' : 'Search Code'}
            </button>

            {searchResult && (
              <div style={{ marginBottom: 24 }}>
                {searchResult === 'not_found' ? (
                  <div className="v3-empty" style={{ padding: 24 }}>
                    <RiSearchLine size={32} className="v3-empty-icon" />
                    <h4 className="v3-empty-title">No user found</h4>
                    <p className="v3-empty-desc">Check the code and try again.</p>
                  </div>
                ) : (
                  <div className="v3-friend-card" style={{ borderColor: 'var(--accent)' }}>
                    <div className={`v3-friend-avatar ${searchResult.subscription_status === 'pro' ? 'pro' : ''}`}>
                      <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${searchResult.avatar_seed || searchResult.id}&backgroundColor=transparent`} alt="" />
                    </div>
                    <div className="v3-friend-info">
                      <div className="v3-friend-name">
                        {searchResult.display_name}
                        {searchResult.subscription_status === 'pro' && <RiVipCrownFill size={14} style={{ color: 'var(--accent)' }} />}
                      </div>
                      <div className="v3-friend-meta">{searchResult.total_workouts || 0} workouts</div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => sendFriendRequest(searchResult.id)}>Add</button>
                  </div>
                )}
              </div>
            )}

            {pending.length > 0 && (
              <div>
                <h3 className="section-title" style={{ marginBottom: 12 }}>
                  <RiFlashlightFill size={16} style={{ color: 'var(--accent)' }} /> Pending ({pending.length})
                </h3>
                {pending.map(p => (
                  <div key={p.id} className="pending-card">
                    <img src={p.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${p.avatar_seed || p.id}&backgroundColor=transparent`} className="pending-card-avatar" alt="" />
                    <div className="pending-card-info">
                      <div className="pending-card-name">{p.display_name || 'Unknown'}</div>
                      <div className="pending-card-label">Wants to connect</div>
                    </div>
                    <div className="pending-card-actions">
                      <button className="v3-action-btn" onClick={() => declineFriend(p.friendship_id)}>
                        <RiCloseFill size={18} />
                      </button>
                      <button className="v3-action-btn accent" onClick={() => acceptFriend(p.friendship_id, p.requester_user_id)}>
                        <RiCheckFill size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {showGroupForm && (
        <div className="modal-slide">
          <div className="modal-slide-backdrop" onClick={() => setShowGroupForm(false)} />
          <div className="modal-slide-content">
            <div className="modal-slide-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiTeamFill size={22} color="var(--text-on-accent)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>New Group</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Create a group chat with friends</p>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Group Name</label>
              <input className="input" placeholder="e.g. Iron Gym Squad" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={32} autoFocus />
            </div>

            <div className="input-group">
              <label className="input-label">Select Friends ({selectedFriends.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {friends.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No friends to add yet.</p>
                ) : (
                  friends.map(f => {
                    const isSelected = selectedFriends.includes(f.id)
                    return (
                      <div
                        key={f.id}
                        className="v3-friend-card"
                        onClick={() => setSelectedFriends(prev => isSelected ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                        style={{ padding: '10px 14px', borderColor: isSelected ? 'var(--accent)' : 'var(--border)', background: isSelected ? 'var(--accent-glow)' : 'var(--bg-card)' }}
                      >
                        <div className="v3-friend-avatar" style={{ width: 36, height: 36 }}>
                          <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${f.avatar_seed || f.id}&backgroundColor=transparent`} alt="" />
                        </div>
                        <div className="v3-friend-info">
                          <div className="v3-friend-name" style={{ fontSize: '0.9rem' }}>{f.display_name}</div>
                        </div>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          border: isSelected ? 'none' : '2px solid var(--border)',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <RiCheckFill size={16} color="var(--text-on-accent)" />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={createGroup} disabled={!groupName.trim() || selectedFriends.length === 0} style={{ marginTop: 12 }}>
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* ═══ PLAN WORKOUT MODAL ═══ */}
      {inviteFriendId && (
        <div className="modal-slide">
          <div className="modal-slide-backdrop" onClick={() => setInviteFriendId(null)} />
          <div className="modal-slide-content">
            <div className="modal-slide-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiFlashlightFill size={24} color="var(--text-on-accent)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Plan a Workout</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Invite {friends.find(f => f.id === inviteFriendId)?.display_name || 'your friend'} to the gym
                </p>
              </div>
            </div>

            <GymPicker value={inviteGymName} onChange={setInviteGymName} />

            <div className="input-group">
              <label className="input-label">Date & Time</label>
              <input type="datetime-local" className="input" value={inviteDate} onChange={e => setInviteDate(e.target.value)} />
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={sendInvite}
              disabled={!inviteDate || !inviteGymName}
              style={{ marginTop: 12 }}
            >
              <RiFlashlightFill size={18} style={{ marginRight: 6 }} /> Send Invite
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast fade-in">{toast}</div>}
    </div>
  )
}
