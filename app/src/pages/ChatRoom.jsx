import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiArrowLeftLine, RiSendPlaneFill, RiFlashlightFill, RiCheckDoubleFill } from '@remixicon/react'

export default function ChatRoom() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [chatMeta, setChatMeta] = useState(null)
  const [text, setText] = useState('')
  const [showInviteMenu, setShowInviteMenu] = useState(false)
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

  async function sendLightningInvite() {
    setShowInviteMenu(false)
    // Create an invite object first (mock or real)
    const { data: invite } = await supabase.from('training_invites').insert({
      sender_id: user.id,
      receiver_id: null, // null means it's a group/chat invite
      title: 'Training Session',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      workout_type: 'Gym',
      status: 'pending'
    }).select().single()

    if (invite) {
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        content: `⚡ Let's hit the gym!`,
        type: 'invite',
        invite_id: invite.id
      })
    }
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
        {messages.map(msg => (
          <div key={msg.id} style={{ alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
            {msg.type === 'text' ? (
              <div style={{
                background: msg.sender_id === user.id ? 'var(--accent)' : 'var(--bg-card)',
                color: msg.sender_id === user.id ? 'var(--text-on-accent)' : 'var(--text-primary)',
                padding: '12px 16px',
                borderRadius: '20px',
                borderBottomRightRadius: msg.sender_id === user.id ? '4px' : '20px',
                borderBottomLeftRadius: msg.sender_id === user.id ? '20px' : '4px',
                fontSize: '0.95rem'
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
                border: '2px solid var(--accent)',
                padding: 16,
                borderRadius: 16,
                textAlign: 'center'
              }}>
                <RiFlashlightFill size={32} color="var(--accent)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700 }}>{msg.content}</div>
                <button className="btn btn-sm" style={{ marginTop: 12, background: 'var(--accent)', color: 'var(--text-on-accent)', width: '100%' }}>
                  <RiCheckDoubleFill size={16} /> Accept Invite
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} style={{ height: 1 }} />
      </div>

      <div className="chat-input-area" style={{ background: 'var(--bg-primary)', padding: '16px 24px', margin: '0 -24px -24px -24px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button 
          onClick={sendLightningInvite}
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
    </div>
  )
}
