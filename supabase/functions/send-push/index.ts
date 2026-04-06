import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const VAPID_PUBLIC_KEY = 'BNBo_jz-q5KOGSbK1Y43HB_UoZim9DwFNVOPGmUThMBDYihvSnX2zPCpqtck6NSiUE--C7ag2p5N4vv97aXh_Hg'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'onCjTbHt0Zzz041u7Tu7cg9uw5Mj8DRJey3UzLP5rvQ'
const DEFAULT_ICON = '/icon-192.png'
const DEFAULT_BADGE = '/icon-192.png'

const ENGAGEMENT_LINES = [
  { title: 'REPMAX Check-In', body: 'Open the app and get one solid session in today.' },
  { title: 'Stay Consistent', body: 'A quick workout today keeps the streak alive.' },
  { title: 'Small Session, Big Progress', body: 'Even 20 focused minutes still count. Lock in.' },
  { title: 'Your Next Rep Is Waiting', body: 'Jump back in and move your training forward today.' },
  { title: 'REPMAX Reminder', body: 'Hydrate, eat, train. You already know the mission.' }
]

function configureWebPush() {
  webpush.setVapidDetails(
    'mailto:support@repmax-app.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function uniqStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values.filter((value) => typeof value === 'string' && value.length > 0)
    ),
  ) as string[]
}

function buildPushPayload(payload: Record<string, unknown>) {
  return JSON.stringify({
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    ...payload,
  })
}

async function cleanupInvalidSubscriptions(userIds: string[]) {
  const uniqueIds = uniqStrings(userIds)
  if (uniqueIds.length === 0) return

  await supabase
    .from('profiles')
    .update({ push_subscription: null })
    .in('id', uniqueIds)
}

async function pushToProfiles(
  profiles: Array<Record<string, unknown>>,
  payload: Record<string, unknown>,
  preferenceKey: string | null = null,
  dryRun = false,
) {
  const eligibleProfiles = profiles.filter((profile) => {
    if (!profile?.push_subscription) return false
    if (!preferenceKey) return true
    return profile?.[preferenceKey] !== false
  })

  if (dryRun) {
    return {
      matched: eligibleProfiles.length,
      sent: 0,
      failed: 0,
      recipients: eligibleProfiles.slice(0, 10).map((profile) => ({
        id: profile.id,
        display_name: profile.display_name,
      })),
    }
  }

  const staleSubscriptions: string[] = []
  configureWebPush()

  const results = await Promise.allSettled(
    eligibleProfiles.map(async (profile) => {
      try {
        await webpush.sendNotification(
          profile.push_subscription,
          buildPushPayload(payload),
        )
        return { id: profile.id }
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleSubscriptions.push(String(profile.id))
        }
        throw error
      }
    }),
  )

  await cleanupInvalidSubscriptions(staleSubscriptions)

  return {
    matched: eligibleProfiles.length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  }
}

async function handleMessagePush(msg: Record<string, unknown>, dryRun = false) {
  if (!msg?.chat_id || !msg?.sender_id) {
    return jsonResponse({ error: 'No message data' }, 400)
  }

  const { data: members, error: membersError } = await supabase
    .from('chat_members')
    .select('user_id, profiles!inner(id, push_subscription, display_name)')
    .eq('chat_id', msg.chat_id)
    .neq('user_id', msg.sender_id)

  if (membersError) {
    console.error('[REPMAX] Failed to load chat members for push:', membersError)
    return jsonResponse({ error: membersError.message }, 500)
  }

  const profiles = (members || [])
    .map((member) => member.profiles)
    .filter(Boolean)

  if (profiles.length === 0) {
    return jsonResponse({ ok: true, mode: 'message', matched: 0, sent: 0, failed: 0 })
  }

  const { data: sender } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', msg.sender_id)
    .single()

  const senderName = sender?.display_name || 'Someone'

  let title = senderName
  let body = typeof msg.content === 'string' ? msg.content : 'New message'

  if (msg.type === 'invite') {
    title = `${senderName} - Gym Invite`
    body = 'Tap to check the workout invite.'
  } else if (msg.type === 'status') {
    title = 'REPMAX'
    body = typeof msg.content === 'string' ? msg.content : 'New update'
  }

  const summary = await pushToProfiles(
    profiles,
    {
      title,
      body,
      tag: `chat-${msg.chat_id}`,
      data: {
        url: `/chat/${msg.chat_id}`,
        chat_id: msg.chat_id,
      },
    },
    null,
    dryRun,
  )

  return jsonResponse({ ok: true, mode: 'message', ...summary })
}

async function handleDirectNotification(notification: Record<string, unknown>) {
  const userIds = uniqStrings([
    ...(Array.isArray(notification.userIds) ? notification.userIds : []),
    ...(Array.isArray(notification.user_ids) ? notification.user_ids : []),
    notification.userId,
    notification.user_id,
  ])

  if (userIds.length === 0) {
    return jsonResponse({ error: 'No user ids provided' }, 400)
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, push_subscription, notify_nudges, notify_invites, notify_reminders')
    .in('id', userIds)

  if (error) {
    console.error('[REPMAX] Failed to load push profiles:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  const preferenceKey = typeof notification.preferenceKey === 'string'
    ? notification.preferenceKey
    : typeof notification.preference_key === 'string'
      ? notification.preference_key
      : null

  const summary = await pushToProfiles(
    profiles || [],
    {
      title: String(notification.title || 'REPMAX'),
      body: String(notification.body || 'You have a new notification'),
      tag: String(notification.tag || `notification-${Date.now()}`),
      requireInteraction: notification.requireInteraction === true,
      renotify: notification.renotify === true,
      data: {
        url: '/app',
        ...(notification.data || {}),
      },
      actions: Array.isArray(notification.actions) ? notification.actions : [],
    },
    preferenceKey,
    notification.dryRun === true || notification.dry_run === true,
  )

  return jsonResponse({ ok: true, mode: 'notification', ...summary })
}

function buildEngagementNotification(profile: Record<string, unknown>, batchId: string) {
  const line = ENGAGEMENT_LINES[Math.floor(Math.random() * ENGAGEMENT_LINES.length)]
  const streak = Number(profile?.current_streak || 0)

  if (streak >= 3) {
    return {
      title: 'Keep The Streak Alive',
      body: `You're on a ${streak}-day streak. Open REPMAX and protect it today.`,
      tag: `engagement-${batchId}`,
      data: { url: '/app' },
    }
  }

  return {
    title: line.title,
    body: line.body,
    tag: `engagement-${batchId}`,
    data: { url: '/app' },
  }
}

async function handleEngagementPush(engagement: Record<string, unknown>) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, current_streak, push_subscription, notify_reminders')
    .not('push_subscription', 'is', null)

  if (error) {
    console.error('[REPMAX] Failed to load engagement push profiles:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  const eligibleProfiles = (profiles || []).filter((profile) => profile.notify_reminders !== false)
  const batchId = new Date().toISOString().slice(0, 13)
  const dryRun = engagement?.dryRun === true || engagement?.dry_run === true

  if (dryRun) {
    return jsonResponse({
      ok: true,
      mode: 'engagement',
      matched: eligibleProfiles.length,
      recipients: eligibleProfiles.slice(0, 10).map((profile) => ({
        id: profile.id,
        display_name: profile.display_name,
      })),
    })
  }

  const staleSubscriptions: string[] = []
  configureWebPush()

  const results = await Promise.allSettled(
    eligibleProfiles.map(async (profile) => {
      try {
        await webpush.sendNotification(
          profile.push_subscription,
          buildPushPayload(buildEngagementNotification(profile, batchId)),
        )
        return { id: profile.id }
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleSubscriptions.push(String(profile.id))
        }
        throw error
      }
    }),
  )

  await cleanupInvalidSubscriptions(staleSubscriptions)

  return jsonResponse({
    ok: true,
    mode: 'engagement',
    matched: eligibleProfiles.length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json().catch(() => ({}))

    if (payload?.engagement) {
      return await handleEngagementPush(payload.engagement)
    }

    if (payload?.notification) {
      return await handleDirectNotification(payload.notification)
    }

    if (payload?.record) {
      return await handleMessagePush(
        payload.record,
        payload?.dryRun === true || payload?.dry_run === true,
      )
    }

    return jsonResponse({ error: 'Invalid push payload' }, 400)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error.message }, 500)
  }
})
