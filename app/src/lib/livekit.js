import { supabase } from './supabase'

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

function normalizeServerUrl(serverUrl) {
  if (serverUrl.startsWith('https://')) return `wss://${serverUrl.slice(8)}`
  if (serverUrl.startsWith('http://')) return `ws://${serverUrl.slice(7)}`
  return serverUrl
}

export async function fetchLiveKitCredentials({ roomName, participantName, participantMetadata = '' }) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Please sign in again before starting a call.')
  }

  const response = await fetch('/api/livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      room_name: roomName,
      participant_name: participantName,
      participant_metadata: participantMetadata
    })
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {}

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not create the call.')
  }

  if (!payload?.server_url || !payload?.participant_token) {
    throw new Error('LiveKit returned incomplete call credentials.')
  }

  return {
    serverUrl: normalizeServerUrl(payload.server_url),
    participantToken: payload.participant_token
  }
}
