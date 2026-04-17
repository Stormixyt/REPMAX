const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime')

const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

const MODEL_MAP = {
  'anthropic/claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic/claude-haiku-4.5': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
}

const DAILY_LIMITS = {
  coach: { pro: 3, ultra: 25 },
  photo_scan: { pro: 3, ultra: 20 },
}

const VALID_FEATURES = ['coach', 'photo_scan']

const BEDROCK_REGION = process.env.AWS_BEDROCK_REGION || 'us-east-1'

let bedrockClient = null

function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: BEDROCK_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  return bedrockClient
}

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

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return res.status(503).json({
      error: 'AWS Bedrock is not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel.'
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
  const bedrockModelId = MODEL_MAP[requestedModel] || MODEL_MAP['anthropic/claude-sonnet-4']

  const messages = (body.messages || []).filter(m => m.role !== 'system')
  const systemMessages = (body.messages || []).filter(m => m.role === 'system')
  const systemPrompt = systemMessages.map(m => m.content).join('\n\n')

  function convertContent(content) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return JSON.stringify(content)
    return content.map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      if (block.type === 'image_url' && block.image_url?.url) {
        const dataUrlMatch = block.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/)
        if (dataUrlMatch) {
          return {
            type: 'image',
            source: { type: 'base64', media_type: dataUrlMatch[1], data: dataUrlMatch[2] },
          }
        }
        return { type: 'text', text: '[unsupported image URL]' }
      }
      return block
    })
  }

  const bedrockPayload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: body.max_tokens || 2048,
    temperature: body.temperature ?? 0.55,
    messages: messages.map(m => ({
      role: m.role,
      content: convertContent(m.content),
    })),
    ...(systemPrompt ? { system: systemPrompt } : {}),
  }

  const payloadStr = JSON.stringify(bedrockPayload)

  if (payloadStr.length > 3_000_000) {
    return res.status(413).json({ error: 'Payload too large.' })
  }

  try {
    const client = getBedrockClient()
    const command = new InvokeModelCommand({
      modelId: bedrockModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: payloadStr,
    })

    const response = await client.send(command)
    const data = JSON.parse(new TextDecoder().decode(response.body))

    await incrementDailyUsage(user.id, feature)

    const openAiFormat = {
      id: `bedrock-${Date.now()}`,
      object: 'chat.completion',
      model: requestedModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data?.content?.[0]?.text || data?.completion || '',
        },
        finish_reason: data?.stop_reason || 'stop',
      }],
      usage: {
        prompt_tokens: data?.usage?.input_tokens || 0,
        completion_tokens: data?.usage?.output_tokens || 0,
        total_tokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
      },
      claude_daily_usage: {
        used: used + 1,
        limit: dailyLimit,
      },
    }

    return res.status(200).json(openAiFormat)
  } catch (err) {
    console.error('[REPMAX] Bedrock proxy error:', err.name, err.message)
    const status = err.$metadata?.httpStatusCode || 500
    return res.status(status).json({
      error: err.message || 'Bedrock request failed',
    })
  }
}
