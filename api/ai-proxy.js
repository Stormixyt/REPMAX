const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_TEXT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.3-70b-instruct:exacto'
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || 'https://www.rep-max.app'
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME || 'REPMAX'

function getUpstreamErrorMessage(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload.error === 'string') return payload.error
  if (typeof payload.message === 'string') return payload.message
  if (typeof payload.raw === 'string') return payload.raw

  if (payload.error && typeof payload.error === 'object') {
    if (typeof payload.error.message === 'string') return payload.error.message
    if (typeof payload.error.metadata?.raw === 'string') return payload.error.metadata.raw
    if (typeof payload.error.code === 'string') return payload.error.code
  }

  return fallback
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
    console.error('[REPMAX] AI auth validation failed:', response.status, errorText.slice(0, 200))
    return null
  }

  return response.json()
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (!openRouterKey) {
    return res.status(503).json({
      error: 'OpenRouter is not configured. Add OPENROUTER_API_KEY in Vercel.'
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

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing request body' })
  }

  const payload = {
    ...body,
    model: body.model || DEFAULT_TEXT_MODEL,
  }

  if (JSON.stringify(payload).length > 3_000_000) {
    return res.status(413).json({ error: 'Payload too large. Maximum size exceeded.' })
  }

  const upstreamRes = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_SITE_NAME,
    },
    body: JSON.stringify(payload),
  })

  const text = await upstreamRes.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!upstreamRes.ok) {
    return res.status(upstreamRes.status).json({
      error: getUpstreamErrorMessage(
        data,
        `OpenRouter request failed with status ${upstreamRes.status}.`
      ),
      details: data,
    })
  }

  return res.status(upstreamRes.status).json(data)
}
