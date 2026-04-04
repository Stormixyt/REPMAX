import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendNotification, NotificationTemplates } from '../lib/notifications'
import { RiUserAddFill, RiSearchLine, RiTeamFill, RiChat3Fill, RiVipCrownFill, RiNotification3Fill, RiFlashlightFill, RiCheckFill, RiCloseFill } from '@remixicon/react'

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

  async function loadSocial() {
    try {
      const [friendsRes, pendingRes, apptRes] = await Promise.all([
        supabase.from('friendships').select('*, friend:friend_id(id, display_name, total_workouts, subscription_status, avatar_seed), requester:user_id(id, display_name, total_workouts, subscription_status, avatar_seed)').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('friendships').select('*, requester:user_id(id, display_name, total_workouts, avatar_seed)').eq('friend_id', user.id).eq('status', 'pending'),
        supabase.from('gym_appointments').select('*, guest:guest_id(display_name, avatar_seed), creator:creator_id(display_name, avatar_seed)').or(`creator_id.eq.${user.id},guest_id.eq.${user.id}`).in('status', ['pending', 'accepted']).order('scheduled_at', { ascending: true })
      ])

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
      setAppointments(apptRes?.data || [])

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
      showToast('Invite sent!')
      setInviteFriendId(null)
      setInviteGymName('')
      setInviteDate('')
      await loadSocial()
      
      // Also send a direct message in their chat
      const chatIdRes = await supabase.rpc('get_direct_chat', { peer_id: inviteFriendId })
      if (chatIdRes.data) {
         await supabase.from('messages').insert({
           chat_id: chatIdRes.data,
           sender_id: user.id,
           content: `Hey! Let's hit ${inviteGymName} at ${new Date(inviteDate).toLocaleString()}`,
           type: 'invite'
         })
      }
    } else {
      showToast('Failed to send invite')
    }
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

        {appointments.length > 0 && (
          <div style={{ marginTop: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Upcoming Sessions</h3>
            </div>
            <div className="stagger-children" style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 8, margin: '0 -16px', padding: '0 16px' }}>
              {appointments.map(a => {
                const isCreator = a.creator_id === user.id
                const other = isCreator ? a.guest : a.creator
                const arrived = isCreator ? a.creator_arrived : a.guest_arrived
                const partnerArrived = isCreator ? a.guest_arrived : a.creator_arrived
                
                return (
                  <div key={a.id} className="glass-card" style={{ padding: 16, borderRadius: 20, minWidth: 260, flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                      <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${other?.avatar_seed || 'default'}&backgroundColor=transparent`} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Workout with {other?.display_name || 'Friend'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                          {new Date(a.scheduled_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <RiFlashlightFill size={14} /> {a.gym_name}
                    </div>
                    {a.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isCreator ? (
                          <>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }} onClick={async () => {
                              await supabase.from('gym_appointments').update({ status: 'accepted' }).eq('id', a.id)
                              await loadSocial()
                            }}>Accept</button>
                            <button className="btn btn-secondary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }} onClick={async () => {
                              await supabase.from('gym_appointments').update({ status: 'declined' }).eq('id', a.id)
                              await loadSocial()
                            }}>Decline</button>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Awaiting response...</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onClick={() => window.open(`http://maps.apple.com/?q=${encodeURIComponent(a.gym_name)}`, '_blank')}>
                          Directions
                        </button>
                        <button 
                          className={`btn ${arrived ? 'btn-secondary' : 'btn-primary'}`} 
                          style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', ...(arrived && { background: 'var(--success)', color: '#000', borderColor: 'var(--success)' }) }}
                          onClick={async () => {
                            if (arrived) return
                            const updates = isCreator ? { creator_arrived: true } : { guest_arrived: true }
                            await supabase.from('gym_appointments').update(updates).eq('id', a.id)
                            // Optionally send a ping message
                            await supabase.from('messages').insert({ chat_id: (await supabase.rpc('get_direct_chat', { peer_id: isCreator ? a.guest_id : a.creator_id })).data, sender_id: user.id, content: "I've arrived at the gym! 📍", type: 'text' })
                            await loadSocial()
                          }}
                        >
                          {arrived ? 'Arrived' : 'I\'m Here!'}
                        </button>
                      </div>
                    )}
                    {partnerArrived && (
                      <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RiCheckFill size={14} /> {other?.display_name} has arrived
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Premium tab bar */}
        <div className="v3-tabs" style={{ marginTop: 8 }}>
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
                      <button className="v3-action-btn" onClick={e => { e.stopPropagation(); setInviteFriendId(f.id) }} title="Plan Workout" style={{ color: 'var(--accent)' }}>
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
            {/* Your Friend Code */}
            <div className="friend-code-card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Your Friend Code
              </div>
              <div className="friend-code-display">{friendCode}</div>
              <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard?.writeText(friendCode); showToast('Copied!') }}>
                Copy Code
              </button>
            </div>

            {/* Search */}
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

            {/* Pending Requests */}
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

      {inviteFriendId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setInviteFriendId(null) }}>
          <div style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={() => setInviteFriendId(null)}>✕</button>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, color: '#fff', fontWeight: 600 }}>Plan a Workout</h2>
            <p style={{ color: '#888', marginBottom: 20, fontSize: '0.9rem' }}>Send an invite to sync your session.</p>
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4, display: 'block' }}>Gym Name or Location</label>
              <input type="text" className="v3-input" placeholder="e.g. Gold's Gym" value={inviteGymName} onChange={e => setInviteGymName(e.target.value)} style={{ width: '100%', background: '#2c2c2e', border: '1px solid #3c3c3e', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div className="input-group" style={{ marginTop: 16 }}>
              <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4, display: 'block' }}>Date & Time</label>
              <input type="datetime-local" className="v3-input" value={inviteDate} onChange={e => setInviteDate(e.target.value)} style={{ width: '100%', background: '#2c2c2e', border: '1px solid #3c3c3e', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#2c2c2e', color: '#fff', border: '1px solid #3c3c3e', fontWeight: 600, cursor: 'pointer' }} onClick={() => setInviteFriendId(null)}>Cancel</button>
              <button style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#d4ff00', color: '#000', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: (!inviteDate || !inviteGymName) ? 0.5 : 1 }} disabled={!inviteDate || !inviteGymName} onClick={sendInvite}>Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast fade-in">{toast}</div>}
    </div>
  )
}
