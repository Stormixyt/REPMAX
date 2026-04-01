import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import GymInviteCard from '../components/GymInviteCard'
import { RiArrowLeftLine, RiSendPlaneFill, RiFlashlightFill, RiCheckLine, RiDeleteBinLine, RiTeamFill } from '@remixicon/react'

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

  useEffect(() => {
    loadChat()
    const sub = supabase.channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [chatId])

  async function loadChat() {
    const [metaRes, msgRes] = await Promise.all([
      supabase.from('chats').select('*, chat_members(user_id, profiles(display_name, avatar_seed))').eq('id', chatId).single(),
      supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
    ])
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
    setTimeout(() => scrollRef.current?.scrollIntoView(), 60)
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    inputRef.current?.focus()

    const tempId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: tempId, chat_id: chatId, sender_id: user.id, content, type: 'text', created_at: new Date().toISOString() }])
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)

    await supabase.from('messages').insert({ id: tempId, chat_id: chatId, sender_id: user.id, content, type: 'text' })
  }

  function toggleMsgMenu(msgId) {
    setTappedMsgId(prev => prev === msgId ? null : msgId)
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

  function getMemberAvatar(senderId) {
    const member = chatMeta?.members?.find(m => m.user_id === senderId)
    return member?.profiles?.avatar_seed || senderId
  }

  async function submitLightningInvite() {
    if (!inviteForm.location.trim() || !inviteForm.time.trim()) return
    setShowInviteMenu(false)
    const payload = { location: inviteForm.location.trim(), time: inviteForm.time.trim(), acceptedBy: [] }
    const contentStr = JSON.stringify(payload)

    const tempId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite', created_at: new Date().toISOString() }])
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)

    await supabase.from('messages').insert({ id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite' })
    setInviteForm({ location: '', time: '' })
  }

  async function acceptInvite(msg) {
    const myName = profile?.display_name || 'Someone'
    let inviteData
    try { inviteData = JSON.parse(msg.content) } catch { inviteData = { location: '?', time: '?' } }
    const accepted = inviteData.acceptedBy || []
    if (accepted.includes(myName)) return

    accepted.push(myName)
    const updated = JSON.stringify({ ...inviteData, acceptedBy: accepted })

    await supabase.from('messages').update({ content: updated }).eq('id', msg.id)
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: updated } : m))

    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: `${myName} is in! ⚡`,
      type: 'status'
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

          return (
            <div key={msg.id}>
              {showDate && <div className="chat-date-sep">{dateLabel}</div>}
              <div
                className={`msg-wrapper ${isMe ? 'sent' : 'received'} msg-enter`}
                onClick={() => isMe && toggleMsgMenu(msg.id)}
              >
                {!isMe && chatMeta?.type === 'group' && (
                  <div className="msg-sender-name">{senderName}</div>
                )}

                {msg.type === 'text' ? (
                  <div className={`msg-bubble ${isMe ? 'sent' : 'received'}`}>
                    {msg.content}
                    <div className="msg-time">{time}</div>
                  </div>
                ) : (
                  <GymInviteCard
                    senderName={senderName}
                    location={inviteData.location}
                    time={inviteData.time}
                    acceptedBy={inviteData.acceptedBy}
                    isMe={isMe}
                    onAccept={() => acceptInvite(msg)}
                  />
                )}

                {tappedMsgId === msg.id && isMe && (
                  <button className="msg-delete-btn" onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}>
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
        <div className="modal-slide">
          <div className="modal-slide-backdrop" onClick={() => setShowInviteMenu(false)} />
          <div className="modal-slide-content">
            <div className="modal-slide-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiFlashlightFill size={24} color="var(--text-on-accent)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Gym Invite</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Drop a lightning invite to the chat</p>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Location</label>
              <input type="text" className="input" placeholder="e.g. Basic-Fit Amsterdam" value={inviteForm.location} onChange={e => setInviteForm({ ...inviteForm, location: e.target.value })} autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Time</label>
              <input type="text" className="input" placeholder="e.g. 7:30 PM" value={inviteForm.time} onChange={e => setInviteForm({ ...inviteForm, time: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={submitLightningInvite} disabled={!inviteForm.location.trim() || !inviteForm.time.trim()} style={{ marginTop: 8 }}>
              <RiFlashlightFill size={18} /> Drop Invite
            </button>
          </div>
        </div>
      )}

      {tappedMsgId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setTappedMsgId(null)} />
      )}
    </div>
  )
}
