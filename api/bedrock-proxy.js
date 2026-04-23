const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_SITE_URL = 'https://www.rep-max.app'
const OPENROUTER_SITE_NAME = 'REPMAX'

const MODEL_MAP = {
  'anthropic/claude-sonnet-4': 'anthropic/claude-sonnet-4',
  'anthropic/claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'claude-sonnet-4': 'anthropic/claude-sonnet-4',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
}

const DAILY_LIMITS = {
  coach: { pro: 3, ultra: 25 },
  photo_scan: { pro: 3, ultra: 20 },
}

const VALID_FEATURES = ['coach', 'photo_scan']

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null
  if (!headerValue.startsWith('Bearer ')) return null
  return headerValue.slice(7).trim() || null
}

function getServiceRoleHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function getAuthenticatedUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  })
  if (!response.ok) return null
  return response.json()
}

async function getUserSubscriptionTier(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })
  if (!response.ok) return 'free'
  const data = await response.json()
  return data?.[0]?.subscription_tier || 'free'
}

async function getDailyUsage(userId, feature) {
  const today = new Date().toISOString().slice(0, 10)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/claude_daily_usage?user_id=eq.${userId}&usage_date=eq.${today}&feature=eq.${feature}&select=message_count`,
    { headers: getServiceRoleHeaders() }
  )
  if (!response.ok) return 0
  const data = await response.json()
  return data?.[0]?.message_count || 0
}

async function incrementDailyUsage(userId, feature) {
  const today = new Date().toISOString().slice(0, 10)
  const headers = getServiceRoleHeaders()

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/claude_daily_usage?user_id=eq.${userId}&usage_date=eq.${today}&feature=eq.${feature}`,
    { headers: { ...headers, Prefer: 'return=representation' } }
  )
  const existing = response.ok ? await response.json() : []

  if (existing.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/claude_daily_usage?user_id=eq.${userId}&usage_date=eq.${today}&feature=eq.${feature}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          message_count: existing[0].message_count + 1,
          updated_at: new Date().toISOString(),
        }),
      }
    )
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/claude_daily_usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        usage_date: today,
        feature,
        message_count: 1,
      }),
    })
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({
      error: 'OpenRouter is not configured. Add OPENROUTER_API_KEY in Vercel.'
    })
  }

  const accessToken = parseBearerToken(req.headers.authorization || req.headers.Authorization)
  if (!accessToken) return res.status(401).json({ error: 'Missing session token' })

  const user = await getAuthenticatedUser(accessToken)
  if (!user?.id) return res.status(401).json({ error: 'Invalid session token' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing request body' })

  const feature = VALID_FEATURES.includes(body.feature) ? body.feature : 'coach'
  const tier = await getUserSubscriptionTier(user.id)
  const featureLimits = DAILY_LIMITS[feature]
  const dailyLimit = featureLimits?.[tier]
  if (!dailyLimit) {
    return res.status(403).json({ error: 'Claude models require a PRO or ULTRA subscription.' })
  }

  const used = await getDailyUsage(user.id, feature)
  if (used >= dailyLimit) {
    return res.status(429).json({
      error: `Daily ${feature === 'photo_scan' ? 'photo scan' : 'Claude'} limit reached (${dailyLimit}/${dailyLimit}). Resets at midnight UTC.`,
      limit: dailyLimit,
      used,
    })
  }

  const requestedModel = body.model || 'anthropic/claude-sonnet-4'
  const openRouterModel = MODEL_MAP[requestedModel] || MODEL_MAP['anthropic/claude-sonnet-4']

  const messages = body.messages || []
  const systemMessages = messages.filter(m => m.role === 'system')
  const systemPrompt = body.system || systemMessages.map(m => m.content).join('\n\n')
  const chatMessages = messages.filter(m => m.role !== 'system')

  // Prepend system prompt as a system message for OpenRouter
  const finalMessages = []
  if (systemPrompt) {
    finalMessages.push({ role: 'system', content: systemPrompt })
  }
  finalMessages.push(...chatMessages)

  const payload = {
    model: openRouterModel,
    messages: finalMessages,
    max_tokens: body.max_tokens || 2048,
    temperature: body.temperature ?? 0.55,
  }

  const payloadStr = JSON.stringify(payload)

  if (payloadStr.length > 3_000_000) {
    return res.status(413).json({ error: 'Payload too large.' })
  }

  try {
    const upstreamRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': OPENROUTER_SITE_URL,
        'X-Title': OPENROUTER_SITE_NAME,
      },
      body: payloadStr,
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
        error: data?.error?.message || `OpenRouter request failed with status ${upstreamRes.status}`,
        details: data,
      })
    }

    await incrementDailyUsage(user.id, feature)

    // Attach daily usage info to the response
    data.claude_daily_usage = {
      used: used + 1,
      limit: dailyLimit,
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('[REPMAX] OpenRouter proxy error:', err.message)
    return res.status(500).json({
      error: err.message || 'OpenRouter request failed',
    })
  }
}
