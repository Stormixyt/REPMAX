import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendNotification, NotificationTemplates } from '../lib/notifications'
import FriendCard from '../components/FriendCard'
import InviteCard from '../components/InviteCard'
import PaywallGate from '../components/PaywallGate'
import { RiUserAddFill, RiSearchLine, RiTeamFill, RiMailSendFill, RiSwordFill, RiNotification3Fill, RiUserHeartFill, RiTimeFill } from '@remixicon/react'

export default function Social() {
  const { user, profile, isPro } = useAuth()
  const [tab, setTab] = useState('friends')
  const [friends, setFriends] = useState([])
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
      const [friendsRes, pendingRes, invitesRes] = await Promise.all([
        supabase.from('friendships').select('*, friend:friend_id(id, display_name, total_workouts, subscription_status), requester:user_id(id, display_name, total_workouts, subscription_status)').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted'),
        supabase.from('friendships').select('*, requester:user_id(id, display_name, total_workouts)').eq('friend_id', user.id).eq('status', 'pending'),
        supabase.from('training_invites').select('*, sender:sender_id(display_name), receiver:receiver_id(display_name)').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('scheduled_at', { ascending: false }).limit(20)
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
    } catch (err) {
      console.error('Social load error:', err)
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
      .select('id, display_name, total_workouts, subscription_status, friend_code')
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
  }

  async function acceptFriend(friendshipId, requesterUserId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    // Notify the requester that their request was accepted
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
    // Notify the sender about the response
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
      </div>

      {/* Friend Code */}
      <div className="card card-accent" style={{ marginBottom: 16 }}>
        <div className="card-label">Your Friend Code</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <code className="friend-code">{friendCode}</code>
          <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard?.writeText(friendCode); showToast('Copied!') }}>Copy</button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>Share this code so friends can find you</p>
      </div>

      {/* Search / Add Friend */}
      <div className="search-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrap">
          <RiSearchLine size={18} className="search-icon" />
          <input className="input search-input" placeholder="Enter friend code..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchFriend()} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={searchFriend} disabled={searching}>
          <RiUserAddFill size={16} />
        </button>
      </div>

      {searchResult && searchResult !== 'not_found' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{searchResult.display_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{searchResult.total_workouts || 0} workouts</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => sendFriendRequest(searchResult.id)}>
              <RiUserAddFill size={16} /> Add
            </button>
          </div>
        </div>
      )}
      {searchResult === 'not_found' && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
          No user found with that code
        </div>
      )}

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
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

      {/* Tabs */}
      <div className="tab-bar">
        {[{ id: 'friends', label: 'Friends', icon: <RiTeamFill size={16} /> }, { id: 'invites', label: 'Invites', icon: <RiSwordFill size={16} /> }].map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Friends Tab */}
      {tab === 'friends' && (
        friends.length === 0 ? (
          <div className="empty-state">
            <RiUserHeartFill size={48} className="empty-icon" />
            <h3 className="empty-title">No friends yet</h3>
            <p className="empty-text">Share your friend code or search for friends to connect.</p>
          </div>
        ) : (
          friends.map(f => (
            <FriendCard key={f.id} friend={f} onNudge={nudgeFriend} onInvite={(friend) => { setInviteTarget(friend); setShowInviteForm(true) }} />
          ))
        )
      )}

      {/* Invites Tab */}
      {tab === 'invites' && (
        invites.length === 0 ? (
          <div className="empty-state">
            <RiSwordFill size={48} className="empty-icon" />
            <h3 className="empty-title">No training invites</h3>
            <p className="empty-text">Invite a friend to train together!</p>
          </div>
        ) : (
          invites.map(inv => (
            <InviteCard key={inv.id} invite={inv} currentUserId={user.id} onAccept={() => respondToInvite(inv, 'accepted')} onDecline={() => respondToInvite(inv, 'declined')} />
          ))
        )
      )}

      {/* Training Invite Modal */}
      {showInviteForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowInviteForm(false) }}>
          <div className="modal invite-modal">
            <div className="invite-modal-header">
              <RiSwordFill size={32} className="accent-icon" />
              <h2 className="modal-title">Training Invite</h2>
              <p className="modal-subtitle">Invite {inviteTarget?.display_name} to train with you</p>
            </div>
            <div className="input-group">
              <label className="input-label">Session Title</label>
              <input className="input" placeholder="e.g. Leg Day Session" value={inviteForm.title} onChange={e => setInviteForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Location</label>
              <input className="input" placeholder="e.g. Gold's Gym Downtown" value={inviteForm.location} onChange={e => setInviteForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Date & Time</label>
              <input className="input" type="datetime-local" value={inviteForm.scheduledAt} onChange={e => setInviteForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Workout Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Cardio'].map(t => (
                  <button key={t} className={`tag ${inviteForm.workoutType === t ? 'selected' : ''}`} onClick={() => setInviteForm(f => ({ ...f, workoutType: t }))}>{t}</button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Message (optional)</label>
              <textarea className="input" rows={2} placeholder="Let's crush it!" value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} style={{ resize: 'none' }} />
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={sendTrainingInvite} disabled={!inviteForm.title || !inviteForm.scheduledAt}>
              <RiMailSendFill size={18} /> Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
