import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiArrowLeftLine, RiSendPlaneFill, RiFlashlightFill, RiCheckLine, RiDeleteBinLine, RiTeamFill, RiCheckDoubleLine, RiMapPin2Fill, RiTimeFill } from '@remixicon/react'

export default function ChatRoom() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [chatMeta, setChatMeta] = useState(null)
  const [text, setText] = useState('')
  const [showInviteMenu, setShowInviteMenu] = useState(false)
  const [inviteForm, setInviteForm] = useState({ location: '', time: '' })
  const [loading, setLoading] = useState(true)
  const [tappedMsgId, setTappedMsgId] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const channelRef = useRef(null)

  // Use AbortController pattern to prevent stale state updates on unmount
  useEffect(() => {
    let cancelled = false

    async function init() {
      const [metaRes, msgRes] = await Promise.all([
        supabase.from('chats').select('*, chat_members(user_id, profiles(display_name, avatar_seed))').eq('id', chatId).single(),
        supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(200)
      ])

      if (cancelled) return

      if (metaRes.data) {
        if (metaRes.data.type === 'direct') {
          const other = metaRes.data.chat_members?.find(m => m.user_id !== user.id)
          setChatMeta({ type: 'direct', title: other?.profiles?.display_name || 'User', avatar: other?.profiles?.avatar_seed || 'default', members: metaRes.data.chat_members })
        } else {
          setChatMeta({ type: 'group', title: metaRes.data.name || 'Group Chat', members: metaRes.data.chat_members })
        }
      }
      setMessages(msgRes.data || [])
      setLoading(false)
      requestAnimationFrame(() => scrollRef.current?.scrollIntoView())
    }

    init()

    // Realtime subscription — fixes message delivery iOS ↔ Android
    const channel = supabase.channel(`chat-live-${chatId}`, {
      config: { broadcast: { self: false } }
    })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        if (cancelled) return
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        if (cancelled) return
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        if (cancelled) return
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[REPMAX] Chat ${chatId} realtime connected`)
        }
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [chatId])

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    inputRef.current?.focus()

    const tempId = crypto.randomUUID()
    const newMsg = { id: tempId, chat_id: chatId, sender_id: user.id, content, type: 'text', created_at: new Date().toISOString(), _pending: true }
    setMessages(prev => [...prev, newMsg])
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }))

    const { error } = await supabase.from('messages').insert({ id: tempId, chat_id: chatId, sender_id: user.id, content, type: 'text' })
    if (error) {
      // Mark as failed
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _failed: true } : m))
    }
  }

  async function deleteMessage(msgId) {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setTappedMsgId(null)
    await supabase.from('messages').delete().eq('id', msgId)
  }

  function getMemberName(senderId) {
    if (senderId === user.id) return 'You'
    if (chatMeta?.type === 'direct') return chatMeta.title
    const member = chatMeta?.members?.find(m => m.user_id === senderId)
    return member?.profiles?.display_name || 'Someone'
  }

  async function submitLightningInvite() {
    if (!inviteForm.location.trim() || !inviteForm.time.trim()) return
    setShowInviteMenu(false)
    
    // Instead of old chat-only logic, we integrate with Gym Appointments for the carousel!
    const membersToInvite = chatMeta?.members?.filter(m => m.user_id !== user.id) || []
    if (membersToInvite.length > 0) {
      const appointments = membersToInvite.map(m => ({
        creator_id: user.id,
        guest_id: m.user_id,
        gym_name: inviteForm.location.trim(),
        scheduled_at: new Date(inviteForm.time).toISOString(),
        status: 'pending'
      }))
      await supabase.from('gym_appointments').insert(appointments)
    }

    const contentStr = `Hey! Let's hit ${inviteForm.location.trim()} at ${new Date(inviteForm.time).toLocaleString()}`
    const tempId = crypto.randomUUID()
    
    // Optimistic UI for the chat message
    setMessages(prev => [...prev, { id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite', created_at: new Date().toISOString() }])
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }))

    // Insert traditional invite message into the chat room
    await supabase.from('messages').insert({ id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite' })
    setInviteForm({ location: '', time: '' })
  }

  async function acceptInvite(msg) {
    if (msg.sender_id === user.id) return // sender can't accept own invite
    const myName = profile?.display_name || 'Someone'
    let inviteData
    try { inviteData = JSON.parse(msg.content) } catch { inviteData = { location: '?', time: '?', acceptedBy: [] } }
    const accepted = inviteData.acceptedBy || []
    if (accepted.includes(myName)) return

    accepted.push(myName)
    const updated = JSON.stringify({ ...inviteData, acceptedBy: accepted })

    // Optimistic update locally
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: updated } : m))

    // Persist to DB — this triggers realtime UPDATE for ALL clients
    await supabase.from('messages').update({ content: updated }).eq('id', msg.id)

    // Status message visible to ALL
    await supabase.from('messages').insert({
      chat_id: chatId, sender_id: user.id,
      content: `${myName} is in! ⚡`, type: 'status'
    })
  }

  function getDateLabel(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  if (loading) return (
    <div className="chat-room">
      <div className="chat-header">
        <button className="chat-header-back" onClick={() => navigate('/social')}><RiArrowLeftLine size={22} /></button>
        <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: 100, height: 18, borderRadius: 8 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    </div>
  )

  let lastDateLabel = ''

  return (
    <div className="chat-room">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-header-back" onClick={() => navigate('/social')}>
          <RiArrowLeftLine size={22} />
        </button>
        {chatMeta?.type === 'direct' && (
          <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${chatMeta.avatar}&backgroundColor=transparent`} alt="" className="chat-header-avatar" />
        )}
        {chatMeta?.type === 'group' && (
          <div className="chat-header-avatar" style={{ background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiTeamFill size={18} color="var(--text-on-accent)" />
          </div>
        )}
        <div className="chat-header-info">
          <div className="chat-header-name">{chatMeta?.title}</div>
          <div className="chat-header-status">
            {chatMeta?.type === 'group' ? `${chatMeta.members?.length || 0} members` : 'online'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id
          const senderName = getMemberName(msg.sender_id)

          const dateLabel = getDateLabel(msg.created_at)
          let showDate = false
          if (dateLabel !== lastDateLabel) {
            showDate = true
            lastDateLabel = dateLabel
          }

          if (msg.type === 'status') {
            return (
              <div key={msg.id}>
                {showDate && <div className="chat-date-sep">{dateLabel}</div>}
                <div className="chat-status-msg msg-enter">
                  <RiCheckLine size={14} color="var(--accent)" /> {msg.content}
                </div>
              </div>
            )
          }

          let inviteData = { location: '?', time: '?', acceptedBy: [] }
          if (msg.type === 'invite') {
            try { inviteData = JSON.parse(msg.content) } catch {}
          }

          const time = new Date(msg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
          const alreadyAccepted = inviteData.acceptedBy?.includes(profile?.display_name)

          return (
            <div key={msg.id}>
              {showDate && <div className="chat-date-sep">{dateLabel}</div>}
              <div
                className={`msg-wrapper ${isMe ? 'sent' : 'received'} msg-enter`}
                onClick={() => isMe && setTappedMsgId(prev => prev === msg.id ? null : msg.id)}
              >
                {!isMe && chatMeta?.type === 'group' && (
                  <div className="msg-sender-name">{senderName}</div>
                )}

                {msg.type === 'text' ? (
                  <div className={`msg-bubble ${isMe ? 'sent' : 'received'}`}>
                    {msg.content}
                    <div className="msg-time">
                      {time}
                      {isMe && !msg._failed && <RiCheckDoubleLine size={12} style={{ marginLeft: 4, opacity: msg._pending ? 0.4 : 1 }} />}
                      {msg._failed && <span style={{ color: 'var(--danger)', marginLeft: 4, fontSize: '0.7rem' }}>Failed</span>}
                    </div>
                  </div>
                ) : (
                  /* GYM INVITE CARD — Inline for better control */
                  <div className="invite-card msg-enter">
                    <div className="invite-card-bolt"><RiFlashlightFill size={100} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <RiFlashlightFill size={14} color="var(--accent)" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{senderName} sent a gym invite</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RiMapPin2Fill size={18} color="var(--accent)" />
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>LOCATION</div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inviteData.location}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RiTimeFill size={18} color="var(--accent)" />
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>TIME</div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inviteData.time}</div>
                        </div>
                      </div>
                    </div>

                    {/* Accepted chips — VISIBLE TO EVERYONE */}
                    {inviteData.acceptedBy?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {inviteData.acceptedBy.map((name, i) => (
                          <div key={i} className="invite-accepted-chip">
                            <RiCheckLine size={12} /> {name}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Accept button — only non-senders who haven't accepted yet */}
                    {!isMe && !alreadyAccepted && (
                      <button className="invite-accept-btn" onClick={() => acceptInvite(msg)}>
                        <RiFlashlightFill size={16} style={{ marginRight: 6 }} /> Accept
                      </button>
                    )}
                    {!isMe && alreadyAccepted && (
                      <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700, fontSize: '0.88rem', padding: '10px 0' }}>
                        <RiCheckDoubleLine size={16} style={{ marginRight: 4 }} /> You're in!
                      </div>
                    )}
                    {isMe && (
                      <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem', padding: '8px 0' }}>
                        {inviteData.acceptedBy?.length > 0 ? `${inviteData.acceptedBy.length} accepted` : 'Waiting for responses...'}
                      </div>
                    )}
                  </div>
                )}

                {tappedMsgId === msg.id && isMe && (
                  <button className="msg-delete-popup" onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}>
                    <RiDeleteBinLine size={14} /> Delete for everyone
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} style={{ height: 1 }} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-bar">
        <button onClick={() => { setShowInviteMenu(true); setInviteForm({ location: '', time: '' }) }} className="chat-lightning-btn">
          <RiFlashlightFill size={20} />
        </button>
        <form onSubmit={sendMessage} style={{ flex: 1, display: 'flex', gap: 10 }}>
          <input ref={inputRef} type="text" placeholder="Message..." value={text} onChange={e => setText(e.target.value)} className="chat-input" />
          <button type="submit" disabled={!text.trim()} className={`chat-send-btn ${text.trim() ? 'active' : ''}`}>
            <RiSendPlaneFill size={18} />
          </button>
        </form>
      </div>

      {/* Lightning Invite Modal */}
      {showInviteMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setShowInviteMenu(false) }}>
          <div style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }} onClick={() => setShowInviteMenu(false)}>✕</button>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, color: '#fff', fontWeight: 600 }}>Plan a Workout</h2>
            <p style={{ color: '#888', marginBottom: 20, fontSize: '0.9rem' }}>Send an invite to sync your session.</p>
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4, display: 'block' }}>Gym Name or Location</label>
              <input type="text" className="v3-input" placeholder="e.g. Gold's Gym" value={inviteForm.location} onChange={e => setInviteForm({ ...inviteForm, location: e.target.value })} style={{ width: '100%', background: '#2c2c2e', border: '1px solid #3c3c3e', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div className="input-group" style={{ marginTop: 16 }}>
              <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: 4, display: 'block' }}>Date & Time</label>
              <input type="datetime-local" className="v3-input" value={inviteForm.time} onChange={e => setInviteForm({ ...inviteForm, time: e.target.value })} style={{ width: '100%', background: '#2c2c2e', border: '1px solid #3c3c3e', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#2c2c2e', color: '#fff', border: '1px solid #3c3c3e', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowInviteMenu(false)}>Cancel</button>
              <button style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#d4ff00', color: '#000', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: (!inviteForm.time || !inviteForm.location) ? 0.5 : 1 }} disabled={!inviteForm.time || !inviteForm.location} onClick={submitLightningInvite}>Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {tappedMsgId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setTappedMsgId(null)} />
      )}
    </div>
  )
}
