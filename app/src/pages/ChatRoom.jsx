import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiArrowLeftLine, RiSendPlaneFill, RiFlashlightFill, RiCheckDoubleFill, RiMapPin2Fill, RiTimeFill, RiCheckLine } from '@remixicon/react'

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
  const scrollRef = useRef(null)

  useEffect(() => {
    loadChat()
    
    const sub = supabase.channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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
        const otherMember = metaRes.data.chat_members.find(m => m.user_id !== user.id)
        setChatMeta({ type: 'direct', title: otherMember?.profiles?.display_name || 'User', avatar: otherMember?.profiles?.avatar_seed || 'default' })
      } else {
        setChatMeta({ type: 'group', title: metaRes.data.name || 'Group Chat', members: metaRes.data.chat_members })
      }
    }
    setMessages(msgRes.data || [])
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollIntoView(), 100)
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: user.id, content, type: 'text' })
  }

  function getMemberName(senderId) {
    if (senderId === user.id) return 'You'
    if (chatMeta?.type === 'direct') return chatMeta.title
    const member = chatMeta?.members?.find(m => m.user_id === senderId)
    return member?.profiles?.display_name || 'Someone'
  }

  async function submitLightningInvite() {
    if (!inviteForm.location || !inviteForm.time) return
    setShowInviteMenu(false)
    const contentStr = JSON.stringify({ location: inviteForm.location.trim(), time: inviteForm.time.trim() })
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite' })
    setInviteForm({ location: '', time: '' })
  }

  async function acceptInvite(msgId) {
    const senderName = getMemberName(user.id)
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: `${senderName} accepted the invite!`,
      type: 'status'
    })
  }

  if (loading) return <div className="page"><div className="skeleton" style={{height: 60}} /></div>

  return (
    <div className="page chat-room" style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="page-header" style={{ padding: '20px 20px', background: 'var(--bg-elevated)', margin: '-24px -24px 0 -24px', zIndex: 10 }}>
        <button className="back-btn" onClick={() => navigate(-1)}><RiArrowLeftLine size={24} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
          {chatMeta?.type === 'direct' && (
            <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${chatMeta.avatar}`} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card)' }} />
          )}
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{chatMeta?.title}</h2>
        </div>
      </div>

      <div className="messages-container" style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => {
          const isMe = msg.sender_id === user.id
          const senderName = getMemberName(msg.sender_id)

          if (msg.type === 'status') {
            return (
              <div key={msg.id} style={{ alignSelf: 'center', margin: '8px 0', padding: '6px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RiCheckLine size={16} color="var(--accent)" /> {msg.content}
              </div>
            )
          }

          let inviteData = { location: 'Local Gym', time: 'TBD' }
          if (msg.type === 'invite') {
            try { inviteData = JSON.parse(msg.content) } catch (e) {}
          }

          return (
            <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {!isMe && chatMeta?.type === 'group' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4, marginLeft: 12 }}>{senderName}</div>
              )}
              {msg.type === 'text' ? (
                <div style={{
                  background: isMe ? 'var(--accent)' : 'var(--bg-card)',
                  color: isMe ? 'var(--text-on-accent)' : 'var(--text-primary)',
                  padding: '12px 16px',
                  borderRadius: '20px',
                  borderBottomRightRadius: isMe ? '4px' : '20px',
                  borderBottomLeftRadius: isMe ? '20px' : '4px',
                  fontSize: '0.95rem'
                }}>
                  {msg.content}
                </div>
              ) : (
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: 20,
                  borderRadius: 24,
                  minWidth: 260,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05, transform: 'rotate(15deg)' }}>
                    <RiFlashlightFill size={100} />
                  </div>
                  
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
                      {senderName} sent a group invite
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 500 }}>
                        <RiMapPin2Fill size={18} color="var(--text-tertiary)" />
                        <span>LOCATION: {inviteData.location}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 500 }}>
                         <RiTimeFill size={18} color="var(--text-tertiary)" />
                         <span>Time: {inviteData.time}</span>
                      </div>
                    </div>
                    
                    <button onClick={() => acceptInvite(msg.id)} style={{ padding: '14px 24px', background: '#ccff00', color: '#000', border: 'none', borderRadius: 12, width: '100%', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(204,255,0,0.3)' }}>
                      Accept
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={scrollRef} style={{ height: 1 }} />
      </div>

      <div className="chat-input-area" style={{ background: 'var(--bg-primary)', padding: '16px 24px', margin: '0 -24px -24px -24px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button 
          onClick={e => { e.preventDefault(); setShowInviteMenu(true); setInviteForm({ location: '', time: '' }) }}
          style={{ background: 'var(--bg-card)', border: 'none', color: 'var(--accent)', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RiFlashlightFill size={24} />
        </button>
        <form onSubmit={sendMessage} style={{ flex: 1, display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            placeholder="Text message..." 
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0 20px', height: 48, borderRadius: 24, color: '#fff', fontSize: '1rem' }}
          />
          <button type="submit" disabled={!text.trim()} style={{ background: text.trim() ? 'var(--accent)' : 'var(--bg-card)', color: text.trim() ? 'var(--text-on-accent)' : 'var(--text-tertiary)', border: 'none', width: 48, height: 48, borderRadius: '50%', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            <RiSendPlaneFill size={20} />
          </button>
        </form>
      </div>

      {/* Lightning Invite Modal */}
      {showInviteMenu && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end', justifyContent: 'flex-end', padding: 0 }} onClick={e => { if(e.target === e.currentTarget) setShowInviteMenu(false) }}>
          <div className="modal" style={{ width: '100%', marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 40, animation: 'slideUp 0.3s ease forwards' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><RiFlashlightFill color="var(--accent)" /> Send Gym Invite</h3>
            </div>
            <div className="input-group">
              <label className="input-label">LOCATION</label>
              <input type="text" className="input" placeholder="e.g. Basic-fit" value={inviteForm.location} onChange={e => setInviteForm({...inviteForm, location: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Time</label>
              <input type="text" className="input" placeholder="e.g. 10:10PM" value={inviteForm.time} onChange={e => setInviteForm({...inviteForm, time: e.target.value})} />
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={submitLightningInvite} disabled={!inviteForm.location.trim() || !inviteForm.time.trim()}>
              Drop Invite
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
