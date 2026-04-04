import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  try {
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || 'onCjTbHt0Zzz041u7Tu7cg9uw5Mj8DRJey3UzLP5rvQ='

    webpush.setVapidDetails(
      'mailto:support@repmax-app.com',
      'BNBo_jz-q5KOGSbK1Y43HB_UoZim9DwFNVOPGmUThMBDYihvSnX2zPCpqtck6NSiUE--C7ag2p5N4vv97aXh_Hg',
      vapidPrivateKey
    )
    const payload = await req.json()
    // This is triggered from a Database Webhook on "messages" table
    const { record: msg } = payload

    if (!msg || !msg.chat_id || !msg.sender_id) {
      return new Response('No message data', { status: 400 })
    }

    // 1. Get the members of the chat
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id, profiles!inner(push_subscription, notify_messages, display_name)')
      .eq('chat_id', msg.chat_id)
      .neq('user_id', msg.sender_id)

    if (!members) return new Response('No listeners found', { status: 200 })

    // 2. Get sender info
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', msg.sender_id)
      .single()

    const senderName = sender?.display_name || 'Someone'

    let title = senderName
    let bodyText = msg.content
    if (msg.type === 'invite') {
       bodyText = '⚡ Sent a gym invite. Tap to view.'
       title = `${senderName} — Gym Invite`
    } else if (msg.type === 'status') {
       bodyText = msg.content
       title = 'REPMAX'
    }

    // 3. Send Web Push to all members
    const notifications = members
      .filter(m => m.profiles?.push_subscription && m.profiles?.notify_messages !== false)
      .map(m => {
        const sub = m.profiles.push_subscription
        return webpush.sendNotification(sub, JSON.stringify({
          title,
          body: bodyText,
          icon: '/icons/icon-192.png',
          data: { url: `/chat/${msg.chat_id}` }
        })).catch(err => {
          console.error(`Failed to push to ${m.user_id}:`, err)
        })
      })

    await Promise.allSettled(notifications)

    return new Response('Pushes triggered successfully', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
