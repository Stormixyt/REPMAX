const { createHmac } = require('node:crypto')

const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'
const TOKEN_TTL_SECONDS = 60 * 60 * 2

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function jsonBase64Url(value) {
  return base64UrlEncode(JSON.stringify(value))
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = jsonBase64Url(header)
  const encodedPayload = jsonBase64Url(payload)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url')
  return `${signingInput}.${signature}`
}

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null
  if (!headerValue.startsWith('Bearer ')) return null
  return headerValue.slice(7).trim() || null
}

async function getAuthenticatedUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[REPMAX] LiveKit auth validation failed:', response.status, errorText.slice(0, 200))
    return null
  }

  return response.json()
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const livekitUrl = process.env.LIVEKIT_URL
  const livekitApiKey = process.env.LIVEKIT_API_KEY
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return res.status(503).json({
      error: 'LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Vercel.'
    })
  }

  const accessToken = parseBearerToken(req.headers.authorization || req.headers.Authorization)
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing session token' })
  }

  const user = await getAuthenticatedUser(accessToken)
  if (!user?.id) {
    return res.status(401).json({ error: 'Invalid session token' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  body = body || {}

  const roomName = String(body.room_name || '').trim()
  if (!roomName || !roomName.startsWith('repmax-')) {
    return res.status(400).json({ error: 'Invalid room name' })
  }

  const participantName = String(
    body.participant_name ||
    user.user_metadata?.display_name ||
    user.email ||
    'REPMAX User'
  ).slice(0, 80)

  const metadata = body.participant_metadata
    ? String(body.participant_metadata).slice(0, 1000)
    : ''

  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload = {
    iss: livekitApiKey,
    sub: user.id,
    iat: nowSeconds,
    nbf: nowSeconds - 10,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    name: participantName,
    metadata,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  }

  const participantToken = signJwt(payload, livekitApiSecret)

  return res.status(201).json({
    server_url: livekitUrl,
    participant_token: participantToken
  })
}
