// REPMAX Background Notification Engine
// Uses Supabase Realtime + Service Worker showNotification
// Works when app tab is in background (covers PWA on mobile)

import { supabase } from './supabase'

let notifChannel = null
let userId = null

export function startNotificationListener(currentUserId, displayName) {
  if (notifChannel) return // Already listening
  userId = currentUserId

  // Request permission immediately
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }

  // Listen for new messages across ALL chats the user is in
  notifChannel = supabase
    .channel('global-notifs-' + currentUserId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, async (payload) => {
      const msg = payload.new
      // Don't notify for own messages
      if (msg.sender_id === userId) return

      // Check if user is a member of this chat
      const { data: membership } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('chat_id', msg.chat_id)
        .eq('user_id', userId)
        .single()

      if (!membership) return // Not in this chat

      // Get sender name
      const { data: sender } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', msg.sender_id)
        .single()

      const senderName = sender?.display_name || 'Someone'

      // Determine notification content
      let body = msg.content
      let title = senderName

      if (msg.type === 'invite') {
        try {
          const invite = JSON.parse(msg.content)
          body = `⚡ Gym invite: ${invite.location} at ${invite.time}`
          title = `${senderName} — Gym Invite`
        } catch {
          body = '⚡ Sent a gym invite'
        }
      } else if (msg.type === 'status') {
        body = msg.content
        title = 'REPMAX'
      }

      // Only show system notification if app is NOT focused
      if (document.hidden || !document.hasFocus()) {
        showSystemNotification(title, body, {
          tag: `msg-${msg.chat_id}`,
          data: { url: `/chat/${msg.chat_id}` }
        })
      }

      // Also store in notifications table for the in-app bell
      await supabase.from('notifications').insert({
        user_id: userId,
        type: msg.type === 'invite' ? 'invite' : 'message',
        title: title,
        body: body,
        data: { chat_id: msg.chat_id, message_id: msg.id },
        read: false
      }).catch(() => {}) // Silently fail if table doesn't exist
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'friend_requests',
      filter: `to_user=eq.${currentUserId}`
    }, async (payload) => {
      const req = payload.new
      const { data: sender } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', req.from_user)
        .single()

      const name = sender?.display_name || 'Someone'

      if (document.hidden || !document.hasFocus()) {
        showSystemNotification('REPMAX', `${name} sent you a friend request`, {
          tag: 'friend-request',
          data: { url: '/social' }
        })
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[REPMAX] Background notification listener active')
      }
    })
}

export function stopNotificationListener() {
  if (notifChannel) {
    supabase.removeChannel(notifChannel)
    notifChannel = null
  }
}

function showSystemNotification(title, body, options = {}) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  // Use service worker for persistent notifications (survive tab close)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: options.tag || 'repmax-' + Date.now(),
        vibrate: [200, 100, 200],
        data: options.data || {},
        renotify: true,
        requireInteraction: false,
        silent: false
      })
    })
  } else {
    // Fallback: basic Notification API
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: options.tag
    })
  }
}
