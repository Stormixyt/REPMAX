import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'
import GymPicker from '../components/GymPicker'
import { startCall, answerCall } from '../lib/webrtc'
import { RiArrowLeftLine, RiSendPlaneFill, RiFlashlightFill, RiCheckLine, RiDeleteBinLine, RiTeamFill, RiCheckDoubleLine, RiMapPin2Fill, RiTimeFill, RiPhoneFill, RiVideoOnFill, RiCloseLine } from '@remixicon/react'

function sortChatMessagesChronologically(items = []) {
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export default function ChatRoom() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isPro } = useAuth()
  const { activeCall, setActiveCall: setGlobalActiveCall, setCallMinimized, showCallToast } = useCall()
  const [messages, setMessages] = useState([])
  const [chatMeta, setChatMeta] = useState(null)
  const [text, setText] = useState('')
  const [showInviteMenu, setShowInviteMenu] = useState(false)
  const [inviteForm, setInviteForm] = useState({ location: '', time: '' })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [tappedMsgId, setTappedMsgId] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const channelRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [reactionMsgId, setReactionMsgId] = useState(null)
  const [reactions, setReactions] = useState({}) // { msgId: [{emoji, user_id}...] }
  const REACTION_EMOJIS = ['💪', '🔥', '👏', '🤣', '❤️']
  const SUPER_EMOJIS = ['⚡', '🏆', '💎', '🫡', '☠️']

  function showToast(message) {
    setToast(message)
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => {
      setToast('')
    }, 3000)
  }

  const upsertIncomingCall = useCallback((call) => {
    setIncomingCall(prev => {
      if (!prev) return call
      if (prev.callId === call.callId) {
        return { ...prev, ...call }
      }
      return call
    })
  }, [])

  // Use AbortController pattern to prevent stale state updates on unmount
  useEffect(() => {
    let cancelled = false

    async function init() {
      const [metaRes, msgRes] = await Promise.all([
        supabase.from('chats').select('*, chat_members(user_id, profiles(display_name, avatar_seed, image_url))').eq('id', chatId).single(),
        supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(200)
      ])

      if (cancelled) return

      if (metaRes.data) {
        if (metaRes.data.type === 'direct') {
          const other = metaRes.data.chat_members?.find(m => m.user_id !== user.id)
          setChatMeta({ type: 'direct', title: other?.profiles?.display_name || 'User', avatar: other?.profiles?.avatar_seed || 'default', image_url: other?.profiles?.image_url, members: metaRes.data.chat_members })
        } else {
          setChatMeta({ type: 'group', title: metaRes.data.name || 'Group Chat', members: metaRes.data.chat_members })
        }
      }
      setMessages(msgRes.data || [])

      const { data: pendingCallNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'incoming_call')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!cancelled) {
        const pendingCall = (pendingCallNotifications || []).find((notif) => {
          const expiresAt = notif.data?.expires_at
          const stillActive = !expiresAt || new Date(expiresAt).getTime() > Date.now()
          return stillActive && notif.data?.chat_id === chatId && notif.data?.offer
        })

        if (pendingCall) {
          upsertIncomingCall({
            chatId,
            callId: pendingCall.data.call_id,
            notificationId: pendingCall.id,
            offer: pendingCall.data.offer,
            callerId: pendingCall.data.caller_id,
            callerName: pendingCall.data.caller_name || 'Gym Buddy',
            withVideo: pendingCall.data.with_video === true,
            expiresAt: pendingCall.data.expires_at
          })
        }
      }

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
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.callerId !== user.id) {
          upsertIncomingCall({
            chatId,
            callId: payload.callId,
            offer: payload.offer,
            callerId: payload.callerId,
            callerName: payload.callerName || 'Gym Buddy',
            withVideo: payload.withVideo,
            expiresAt: payload.expiresAt
          })
        }
      })
      .on('broadcast', { event: 'cancel-call' }, ({ payload }) => {
        if (payload.callerId !== user.id) {
          let notificationId = null
          let dismissedPrompt = false
          setIncomingCall(prev => {
            if (!prev || prev.callId !== payload.callId) return prev
            notificationId = prev.notificationId
            dismissedPrompt = true
            return null
          })
          if (notificationId) {
            markCallNotificationReadSafely(notificationId)
          }
          if (dismissedPrompt) {
            showCallToast(`${payload.callerName || 'Caller'} ended the call`)
          }
        }
      })
      .on('broadcast', { event: 'end-call' }, ({ payload }) => {
        if (payload.callerId !== user.id) {
          let notificationId = null
          let dismissedPrompt = false
          setIncomingCall(prev => {
            if (!prev || prev.callId !== payload.callId) return prev
            notificationId = prev.notificationId
            dismissedPrompt = true
            return null
          })
          if (notificationId) {
            markCallNotificationReadSafely(notificationId)
          }
          if (dismissedPrompt) {
            showCallToast(payload.message || `${payload.callerName || 'Caller'} ended the call`)
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[REPMAX] Chat ${chatId} realtime connected`)
        }
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [chatId, user.id, upsertIncomingCall, showCallToast])

  async function markCallNotificationRead(notificationId) {
    if (!notificationId) return
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
  }

  async function clearPendingIncomingCalls(targetUserId) {
    if (!targetUserId) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', targetUserId)
      .eq('type', 'incoming_call')
      .eq('read', false)
  }

  async function markCallNotificationReadSafely(notificationId) {
    if (!notificationId) return
    try {
      await markCallNotificationRead(notificationId)
    } catch {}
  }

  async function declineIncomingCall() {
    if (!incomingCall) return
    const declinedCall = incomingCall
    setIncomingCall(null)
    await markCallNotificationRead(declinedCall.notificationId)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-declined',
      payload: {
        callId: declinedCall.callId,
        callerId: declinedCall.callerId,
        message: `${profile?.display_name || 'Your friend'} declined the call`
      }
    })
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return

    if (incomingCall.expiresAt && new Date(incomingCall.expiresAt).getTime() <= Date.now()) {
      await markCallNotificationRead(incomingCall.notificationId)
      setIncomingCall(null)
      showCallToast('Call expired')
      return
    }

    try {
      const result = await answerCall(chatId, incomingCall.offer, incomingCall.withVideo, incomingCall.callId)
      await markCallNotificationRead(incomingCall.notificationId)
      setGlobalActiveCall({
        chatId,
        callId: incomingCall.callId,
        roomName: result.roomName,
        callerName: incomingCall.callerName || chatMeta?.title || 'Gym Buddy',
        isVideo: incomingCall.withVideo,
        direction: 'incoming'
      })
      setIncomingCall(null)
    } catch (err) {
      console.error('Answer failed:', err)
      showCallToast('Could not answer the call')
    }
  }

  function getChatRecipientIds() {
    return (chatMeta?.members || [])
      .map((member) => member.user_id)
      .filter((memberId) => memberId && memberId !== user.id)
  }

  function buildChatNotificationPayload(messageType, content) {
    const senderName = profile?.display_name || 'Someone'

    if (messageType === 'invite') {
      return {
        type: 'invite',
        title: `${senderName} - Gym Invite`,
        body: 'Tap to check the workout invite.'
      }
    }

    if (messageType === 'status') {
      return {
        type: 'message',
        title: 'REPMAX',
        body: typeof content === 'string' ? content : 'New update'
      }
    }

    return {
      type: 'message',
      title: senderName,
      body: typeof content === 'string' ? content : 'New message'
    }
  }

  async function notifyChatRecipients(messageId, messageType, content) {
    const recipientIds = getChatRecipientIds()
    if (recipientIds.length === 0) return

    const payload = buildChatNotificationPayload(messageType, content)

    await sendNotification({
      userIds: recipientIds,
      ...payload,
      data: {
        url: `/chat/${chatId}`,
        chat_id: chatId,
        message_id: messageId
      },
      tag: `chat-${chatId}`
    })
  }

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
      return
    }

    notifyChatRecipients(tempId, 'text', content).catch((notifyError) => {
      console.warn('[REPMAX] Failed to notify chat recipients:', notifyError)
    })
  }

  async function deleteMessage(msgId) {
    const messageToDelete = messages.find(m => m.id === msgId)
    if (!messageToDelete) return

    if (messageToDelete.sender_id !== user.id) {
      showToast('You can only delete your own messages')
      return
    }

    if (messageToDelete._pending) {
      setMessages(prev => prev.filter(m => m.id !== msgId))
      setTappedMsgId(null)
      return
    }

    setMessages(prev => prev.filter(m => m.id !== msgId))
    setTappedMsgId(null)
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('id', msgId)
      .eq('sender_id', user.id)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      console.error('[REPMAX] Message delete failed:', error)
      setMessages(prev => {
        if (prev.some(m => m.id === msgId)) return prev
        return sortChatMessagesChronologically([...prev, messageToDelete])
      })
      showToast(error?.message || 'Could not delete message for everyone')
      return
    }

    setReactions(prev => {
      if (!prev[msgId]) return prev
      const next = { ...prev }
      delete next[msgId]
      return next
    })
  }

  async function initiateCall(withVideo) {
    try {
      const calleeId = chatMeta?.members?.find(member => member.user_id !== user.id)?.user_id
      const expiresAt = new Date(Date.now() + 60_000).toISOString()
      let offerPayload = null

      const result = await startCall(chatId, user.id, withVideo, (payload) => {
        offerPayload = {
          ...payload,
          callerName: profile?.display_name || chatMeta?.title || 'Gym Buddy',
          expiresAt
        }
        if (!channelRef.current) {
          throw new Error('Chat connection unavailable')
        }
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: offerPayload
        }).catch((error) => {
          console.error('[REPMAX] Failed to broadcast offer:', error)
        })
      })

      if (calleeId && offerPayload) {
        await clearPendingIncomingCalls(calleeId).catch(() => {})
        const { error: notificationError } = await sendNotification({
          userId: calleeId,
          type: 'incoming_call',
          title: withVideo ? 'Incoming video call' : 'Incoming call',
          body: `${profile?.display_name || 'Someone'} is calling you`,
          data: {
            url: `/chat/${chatId}`,
            chat_id: chatId,
            call_id: offerPayload.callId,
            caller_id: user.id,
            caller_name: profile?.display_name || 'Gym Buddy',
            with_video: withVideo,
            offer: offerPayload.offer,
            expires_at: expiresAt
          },
          tag: `call-${offerPayload.callId}`,
          requireInteraction: true,
          renotify: true
        })

        if (notificationError) {
          console.error('[REPMAX] Failed to store incoming call notification:', notificationError)
        }
      }

      setGlobalActiveCall({
        chatId,
        callId: result.callId,
        roomName: result.roomName,
        callerName: chatMeta?.title || 'Gym Buddy',
        isVideo: withVideo,
        direction: 'outgoing',
        callerId: user.id,
        calleeId,
        callerNameForRemote: profile?.display_name || 'Gym Buddy'
      })
    } catch (err) {
      console.error('Call failed:', err)
      showCallToast(err?.message || 'Could not start the call')
    }
  }

  function handleCallButton(withVideo) {
    if (activeCall) {
      if (activeCall.chatId === chatId) {
        setCallMinimized(false)
        return
      }

      showCallToast('Finish your current call first')
      return
    }

    if (!isPro) {
      navigate('/subscribe')
      return
    }

    initiateCall(withVideo)
  }

  async function addReaction(msgId, emoji) {
    setReactionMsgId(null)
    const isSuper = SUPER_EMOJIS.includes(emoji)
    // Optimistic update
    setReactions(prev => {
      const existing = prev[msgId] || []
      if (existing.find(r => r.emoji === emoji && r.user_id === user.id)) return prev
      return { ...prev, [msgId]: [...existing, { emoji, user_id: user.id, is_super: isSuper }] }
    })
    await supabase.from('message_reactions').upsert({
      message_id: msgId, user_id: user.id, emoji, is_super: isSuper
    }, { onConflict: 'message_id,user_id,emoji' })
  }

  function getMemberName(senderId) {
    if (senderId === user.id) return 'You'
    if (chatMeta?.type === 'direct') return chatMeta.title
    const member = chatMeta?.members?.find(m => m.user_id === senderId)
    return member?.profiles?.display_name || 'Someone'
  }

  function formatInviteTime(dateStr) {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      let dayPart
      if (d.toDateString() === now.toDateString()) dayPart = 'Today'
      else if (d.toDateString() === tomorrow.toDateString()) dayPart = 'Tomorrow'
      else dayPart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      return `${dayPart} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    } catch { return dateStr }
  }

  async function submitLightningInvite() {
    if (!inviteForm.location.trim() || !inviteForm.time.trim()) return
    setShowInviteMenu(false)

    const loc = inviteForm.location.trim()
    const friendlyTime = formatInviteTime(inviteForm.time)

    // Insert gym appointments for all other members
    const membersToInvite = chatMeta?.members?.filter(m => m.user_id !== user.id) || []
    if (membersToInvite.length > 0) {
      try {
        await supabase.from('gym_appointments').insert(
          membersToInvite.map(m => ({
            creator_id: user.id,
            guest_id: m.user_id,
            gym_name: loc,
            scheduled_at: new Date(inviteForm.time).toISOString(),
            status: 'pending'
          }))
        )
      } catch {}
    }

    const payload = { location: loc, time: friendlyTime, acceptedBy: [] }
    const contentStr = JSON.stringify(payload)
    const tempId = crypto.randomUUID()

    setMessages(prev => [...prev, { id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite', created_at: new Date().toISOString() }])
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }))

    const { error } = await supabase.from('messages').insert({ id: tempId, chat_id: chatId, sender_id: user.id, content: contentStr, type: 'invite' })
    if (!error) {
      notifyChatRecipients(tempId, 'invite', contentStr).catch((notifyError) => {
        console.warn('[REPMAX] Failed to notify invite recipients:', notifyError)
      })
    }
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

    // Automatically mark the gym appointment as accepted if it exists!
    await supabase.from('gym_appointments')
      .update({ status: 'accepted' })
      .eq('creator_id', msg.sender_id)
      .eq('guest_id', user.id)
      .eq('status', 'pending')

    // Persist to DB — this triggers realtime UPDATE for ALL clients
    await supabase.from('messages').update({ content: updated }).eq('id', msg.id)

    // Status message visible to ALL
    const statusMessageId = crypto.randomUUID()
    const { error: statusError } = await supabase.from('messages').insert({
      id: statusMessageId,
      chat_id: chatId, sender_id: user.id,
      content: `${myName} is in! ⚡`, type: 'status'
    })
    if (!statusError) {
      notifyChatRecipients(statusMessageId, 'status', `${myName} is in! ⚡`).catch((notifyError) => {
        console.warn('[REPMAX] Failed to notify status recipients:', notifyError)
      })
    }
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
      {toast && <div className="toast fade-in">{toast}</div>}

      {/* Header */}
      <div className="chat-header">
        <button className="chat-header-back" onClick={() => navigate('/social')}>
          <RiArrowLeftLine size={22} />
        </button>
        {chatMeta?.type === 'direct' && (
          <img src={chatMeta.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${chatMeta.avatar}&backgroundColor=transparent`} alt="" className="chat-header-avatar" style={{ objectFit: 'cover' }} />
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
        {/* Call buttons — Pro only, direct chats only */}
        {chatMeta?.type === 'direct' && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              className="icon-btn"
              onClick={() => handleCallButton(false)}
              style={{ opacity: isPro ? 1 : 0.4 }}
            >
              <RiPhoneFill size={18} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleCallButton(true)}
              style={{ opacity: isPro ? 1 : 0.4 }}
            >
              <RiVideoOnFill size={18} />
            </button>
          </div>
        )}
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
                onDoubleClick={() => msg.type === 'text' && setReactionMsgId(prev => prev === msg.id ? null : msg.id)}
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

                {/* Reaction bar — appears on double tap */}
                {reactionMsgId === msg.id && (
                  <div style={{
                    display: 'flex', gap: 6, padding: '6px 10px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 20, position: 'absolute',
                    top: -44, left: isMe ? 'auto' : 0, right: isMe ? 0 : 'auto',
                    zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    animation: 'scaleIn 0.15s ease'
                  }}>
                    {REACTION_EMOJIS.map(em => (
                      <button
                        key={em}
                        onClick={(e) => { e.stopPropagation(); addReaction(msg.id, em) }}
                        style={{
                          background: 'none', border: 'none', fontSize: '1.3rem',
                          cursor: 'pointer', padding: '2px 4px', borderRadius: 8,
                          transition: 'transform 0.15s'
                        }}
                        onMouseOver={e => e.target.style.transform = 'scale(1.3)'}
                        onMouseOut={e => e.target.style.transform = 'scale(1)'}
                      >
                        {em}
                      </button>
                    ))}
                    {isPro && SUPER_EMOJIS.map(em => (
                      <button
                        key={em}
                        onClick={(e) => { e.stopPropagation(); addReaction(msg.id, em) }}
                        style={{
                          background: 'none', border: 'none', fontSize: '1.3rem',
                          cursor: 'pointer', padding: '2px 4px', borderRadius: 8,
                          transition: 'transform 0.15s',
                          filter: 'drop-shadow(0 0 4px rgba(212,255,0,0.5))'
                        }}
                        onMouseOver={e => e.target.style.transform = 'scale(1.4)'}
                        onMouseOut={e => e.target.style.transform = 'scale(1)'}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reaction pills */}
                {reactions[msg.id]?.length > 0 && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 4,
                    marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start'
                  }}>
                    {Object.entries(
                      reactions[msg.id].reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc }, {})
                    ).map(([emoji, count]) => (
                      <span key={emoji} style={{
                        fontSize: '0.75rem', padding: '2px 6px',
                        background: 'var(--bg-elevated)', borderRadius: 10,
                        border: '1px solid var(--border)',
                        animation: reactions[msg.id].find(r => r.emoji === emoji)?.is_super ? 'pulse 1s ease infinite' : 'none'
                      }}>
                        {emoji} {count > 1 && count}
                      </span>
                    ))}
                  </div>
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
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Plan a Workout</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Send an invite to the chat</p>
              </div>
            </div>
            <GymPicker value={inviteForm.location} onChange={loc => setInviteForm({ ...inviteForm, location: loc })} />
            <div className="input-group">
              <label className="input-label">Date & Time</label>
              <input type="datetime-local" className="input" value={inviteForm.time} onChange={e => setInviteForm({ ...inviteForm, time: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-full btn-lg" onClick={submitLightningInvite} disabled={!inviteForm.location.trim() || !inviteForm.time.trim()} style={{ marginTop: 8 }}>
              <RiFlashlightFill size={18} /> Send Invite
            </button>
          </div>
        </div>
      )}

      {tappedMsgId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setTappedMsgId(null)} />
      )}

      {reactionMsgId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setReactionMsgId(null)} />
      )}

      {incomingCall && (!activeCall || activeCall.callId !== incomingCall.callId) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            width: '100%',
            maxWidth: 360,
            background: 'linear-gradient(180deg, rgba(24,26,32,0.98), rgba(14,16,20,0.98))',
            border: '1px solid rgba(212,255,0,0.18)',
            borderRadius: 28,
            padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              margin: '0 auto 18px',
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              animation: 'pulse 1.8s ease-in-out infinite'
            }}>
              {incomingCall.withVideo ? '📹' : '📞'}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Incoming {incomingCall.withVideo ? 'Video' : 'Voice'} Call
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              {incomingCall.callerName || chatMeta?.title || 'Gym Buddy'}
            </h2>
            <p style={{ margin: '0 0 22px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Answer now to join the call.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={declineIncomingCall}
                style={{ flex: 1, justifyContent: 'center', padding: '14px 0', borderRadius: 16 }}
              >
                <RiCloseLine size={18} /> Decline
              </button>
              <button
                className="btn btn-primary"
                onClick={acceptIncomingCall}
                style={{ flex: 1, justifyContent: 'center', padding: '14px 0', borderRadius: 16 }}
              >
                {incomingCall.withVideo ? <RiVideoOnFill size={18} /> : <RiPhoneFill size={18} />} Answer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
