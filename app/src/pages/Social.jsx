import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendNotification, NotificationTemplates } from '../lib/notifications'
import FriendCard from '../components/FriendCard'
import InviteCard from '../components/InviteCard'
import { RiUserAddFill, RiSearchLine, RiTeamFill, RiMailSendFill, RiSwordFill, RiNotification3Fill, RiChat3Fill, RiVipCrownFill } from '@remixicon/react'

export default function Social() {
  const { user, profile, isPro } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('messages')
  const [friends, setFriends] = useState([])
  const [chats, setChats] = useState([])
  const [pending, setPending] = useState([])
  const [invites, setInvites] = useState([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteTarget, setInviteTarget] = useState(null)
  const [inviteForm, setInviteForm] = useState({ title: '', location: '', scheduledAt: '', workoutType: '', message: '' })
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
      const [friendsRes, pendingRes, invitesRes, chatsRes] = await Promise.all([
        supabase.from('friendships').select('*, friend:friend_id(id, display_name, total_workouts, subscription_status, avatar_seed), requester:user_id(id, display_name, total_workouts, subscription_status, avatar_seed)').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('friendships').select('*, requester:user_id(id, display_name, total_workouts)').eq('friend_id', user.id).eq('status', 'pending'),
        supabase.from('training_invites').select('*, sender:sender_id(display_name), receiver:receiver_id(display_name)').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('scheduled_at', { ascending: false }).limit(20),
        supabase.from('chats').select('*, chat_members(user_id, profiles(display_name, avatar_seed))').order('created_at', { ascending: false })
      ])

      const friendsList = (friendsRes.data || []).map(f => {
        const isSender = f.user_id === user.id
        const friendProfile = isSender ? f.friend : f.requester
        return { ...friendProfile, friendship_id: f.id }
      })
      if (!mounted.current) return
      setFriends(friendsList)
      setPending(pendingRes.data || [])
      setInvites((invitesRes.data || []).map(inv => ({
        ...inv,
        sender_name: inv.sender?.display_name,
        receiver_name: inv.receiver?.display_name
      })))
      
      const formattedChats = (chatsRes.data || []).map(c => {
        if (c.type === 'direct') {
          const other = c.chat_members.find(m => m.user_id !== user.id)
          return { ...c, title: other?.profiles?.display_name || 'User', avatar: other?.profiles?.avatar_seed || 'default' }
        }
        return { ...c, title: c.name || 'Group Chat' }
      })
      setChats(formattedChats || [])
    } catch (err) {
      console.error('Social load error:', err)
      // Hide error from UI if SQL script hasn't been run yet (no chats table)
      if (err?.message?.includes('does not exist')) {
        setChats([])
      }
    }
    if (mounted.current) setLoading(false)
  }

  async function searchFriend() {
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchResult(null)
    const code = searchEmail.trim().toUpperCase()
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
    showToast('Friend request sent!')
    setSearchResult(null)
    setSearchEmail('')
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

  async function nudgeFriend(friend) {
    await supabase.from('nudges').insert({ sender_id: user.id, receiver_id: friend.id, message: `${profile.display_name} is reminding you to train!` })
    const tmpl = NotificationTemplates.nudge(profile.display_name)
    await sendNotification({ userId: friend.id, ...tmpl, data: { sender_id: user.id } })
    showToast(`Nudged ${friend.display_name}!`)
  }

  async function openDirectChat(friendId) {
    // If table doesn't exist yet, warn user
    const { error: testErr } = await supabase.from('chats').select('id').limit(1)
    if (testErr) { showToast("Run the SQL update first!"); return }

    const { data: existingChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
    if (existingChats?.length > 0) {
      const chatIds = existingChats.map(c => c.chat_id)
      const { data: mutual } = await supabase.from('chat_members').select('chat_id, chats!inner(type)').eq('user_id', friendId).in('chat_id', chatIds).eq('chats.type', 'direct').limit(1)
      if (mutual?.[0]) {
        navigate(`/chat/${mutual[0].chat_id}`)
        return
      }
    }
    
    // Create new direct chat
    const { data: newChat } = await supabase.from('chats').insert({ type: 'direct' }).select().single()
    if (newChat) {
      await supabase.from('chat_members').insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: friendId }
      ])
      navigate(`/chat/${newChat.id}`)
    }
  }

  async function sendTrainingInvite() {
    if (!inviteTarget || !inviteForm.title || !inviteForm.scheduledAt) return
    await supabase.from('training_invites').insert({ sender_id: user.id, receiver_id: inviteTarget.id, title: inviteForm.title, location: inviteForm.location, scheduled_at: inviteForm.scheduledAt, workout_type: inviteForm.workoutType, message: inviteForm.message })
    const tmpl = NotificationTemplates.trainingInvite(profile.display_name, inviteForm.title)
    await sendNotification({ userId: inviteTarget.id, ...tmpl, data: { sender_id: user.id, url: '/social' } })
    showToast('Invite sent!')
    setShowInviteForm(false)
    setInviteForm({ title: '', location: '', scheduledAt: '', workoutType: '', message: '' })
    loadSocial()
  }

  async function respondToInvite(invite, status) {
    await supabase.from('training_invites').update({ status }).eq('id', invite.id)
    const senderId = invite.sender_id
    if (senderId) {
      const tmpl = status === 'accepted'
        ? NotificationTemplates.inviteAccepted(profile.display_name, invite.title)
        : NotificationTemplates.inviteDeclined(profile.display_name, invite.title)
      await sendNotification({ userId: senderId, ...tmpl, data: { responder_id: user.id, url: '/social' } })
    }
    showToast(status === 'accepted' ? 'Session confirmed!' : 'Invite declined')
    loadSocial()
  }

  const friendCode = profile?.friend_code || '...'

  if (loading) return (
    <div className="page">
      <div className="page-header"><div className="skeleton" style={{ width: 160, height: 28 }} /></div>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />)}
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Social</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {['messages', 'friends', 'search', 'invites'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'invites' && pending.length > 0 && <span className="badge">{pending.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: 100 }}>
        
        {/* MESSAGES TAB */}
        {tab === 'messages' && (
          <div className="tab-pane active fade-in">
            <div className="card" onClick={() => showToast('Group creation coming soon!')} style={{ marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: '2px dashed var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiUserAddFill size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Create New Group Chat</div>
            </div>
            {chats.length === 0 ? (
              <div className="empty-state">
                <RiChat3Fill size={48} />
                <h3>No Messages Yet</h3>
                <p>Start a chat from your Friends list!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chats.map(c => (
                  <div key={c.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => navigate(`/chat/${c.id}`)}>
                    <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${c.avatar}`} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-primary)' }} alt="avatar" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{c.title}</div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{c.type === 'direct' ? 'Direct Message' : 'Group Chat'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div className="tab-pane active fade-in">
            <h3 className="section-title" style={{ marginTop: 8 }}>Your Friends</h3>
            {friends.length === 0 ? (
              <div className="empty-state">
                <RiTeamFill size={48} />
                <h3>No friends yet</h3>
                <p>Go to the Search tab to connect.</p>
              </div>
            ) : (
              <div className="friends-grid">
                {friends.map(f => (
                  <div key={f.id} className="card friend-card" onClick={() => openDirectChat(f.id)} style={{ cursor: 'pointer' }}>
                    <div className="friend-info">
                      <div className="friend-avatar" style={{ background: 'var(--bg-elevated)' }}>
                         <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${f.avatar_seed || f.id}&backgroundColor=transparent`} style={{ width: '100%', height: '100%', borderRadius: '50%' }} alt="friend" />
                      </div>
                      <div className="friend-details">
                        <h4 className="friend-name">{f.display_name} {f.subscription_status === 'pro' && <RiVipCrownFill size={14} className="accent-icon" />}</h4>
                        <p className="friend-workouts">{f.total_workouts || 0} workouts</p>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openDirectChat(f.id) }} title="Message"><RiChat3Fill size={20} /></button>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); nudgeFriend(f) }} title="Send Nudge"><RiNotification3Fill size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="tab-pane active fade-in">
            <div className="card card-accent" style={{ marginBottom: 16 }}>
              <div className="card-label">Your Friend Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <code className="friend-code">{friendCode}</code>
                <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard?.writeText(friendCode); showToast('Copied!') }}>Copy</button>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RiSearchLine size={24} style={{ color: 'var(--accent)' }}/>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Find Friends</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Enter their 8-character code</p>
                </div>
              </div>

              <div className="search-box">
                <input type="text" className="input" placeholder="e.g. A1B2C3D4" value={searchEmail} onChange={e => setSearchEmail(e.target.value.toUpperCase())} maxLength={8} style={{ width: '100%', textTransform: 'uppercase' }} />
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={searchFriend} disabled={searching || searchEmail.length < 4}>
                  {searching ? 'Searching...' : 'Search Code'}
                </button>
              </div>

              {searchResult && (
                <div className="search-result" style={{ marginTop: 24 }}>
                  {searchResult === 'not_found' ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <RiSearchLine size={32} />
                      <h4>No user found</h4>
                      <p>Check the code and try again.</p>
                    </div>
                  ) : (
                    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--accent)' }}>
                      <div className="friend-info">
                        <div className="friend-avatar">
                          <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${searchResult.avatar_seed || searchResult.id}&backgroundColor=transparent`} style={{ width: '100%', height: '100%', borderRadius: '50%' }} alt="search" />
                        </div>
                        <div className="friend-details">
                          <h4 className="friend-name">{searchResult.display_name} {searchResult.subscription_status === 'pro' && <RiVipCrownFill size={14} className="accent-icon" />}</h4>
                          <p className="friend-workouts">{searchResult.total_workouts || 0} workouts</p>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-accent" onClick={() => sendFriendRequest(searchResult.id)}>Add</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {pending.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 className="section-title"><RiMailSendFill size={16} /> Pending Requests ({pending.length})</h3>
                {pending.map(p => (
                  <div key={p.id} className="card" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{p.requester?.display_name || 'Unknown'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => declineFriend(p.id)}>Decline</button>
                        <button className="btn btn-sm btn-primary" onClick={() => acceptFriend(p.id, p.user_id)}>Accept</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INVITES TAB (Legacy Tracking) */}
        {tab === 'invites' && (
          <div className="tab-pane active fade-in">
            {invites.length === 0 ? (
              <div className="empty-state">
                <RiSwordFill size={48} className="empty-icon" />
                <h3 className="empty-title">No training invites</h3>
                <p className="empty-text">Send a lightning invite inside a chat!</p>
              </div>
            ) : (
              invites.map(inv => (
                <InviteCard key={inv.id} invite={inv} currentUserId={user.id} onAccept={() => respondToInvite(inv, 'accepted')} onDecline={() => respondToInvite(inv, 'declined')} />
              ))
            )}
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && <div className="toast fade-in">{toast}</div>}
    </div>
  )
}
