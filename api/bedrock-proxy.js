const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

const MODEL_MAP = {
  'anthropic/claude-opus-4': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'anthropic/claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic/claude-haiku-3.5': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
}

const BEDROCK_REGION = process.env.AWS_BEDROCK_REGION || 'us-east-1'

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const bedrockApiKey = process.env.AWS_BEARER_TOKEN_BEDROCK
  if (!bedrockApiKey) {
    return res.status(503).json({
      error: 'AWS Bedrock is not configured. Add AWS_BEARER_TOKEN_BEDROCK in Vercel.'
    })
  }

  const accessToken = parseBearerToken(req.headers.authorization || req.headers.Authorization)
  if (!accessToken) return res.status(401).json({ error: 'Missing session token' })

  const user = await getAuthenticatedUser(accessToken)
  if (!user?.id) return res.status(401).json({ error: 'Invalid session token' })

  const tier = await getUserSubscriptionTier(user.id)
  if (tier !== 'ultra') {
    return res.status(403).json({ error: 'Claude models require ULTRA subscription.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing request body' })

  const requestedModel = body.model || 'anthropic/claude-sonnet-4'
  const bedrockModelId = MODEL_MAP[requestedModel] || MODEL_MAP['anthropic/claude-sonnet-4']

  const messages = (body.messages || []).filter(m => m.role !== 'system')
  const systemMessages = (body.messages || []).filter(m => m.role === 'system')
  const systemPrompt = systemMessages.map(m => m.content).join('\n\n')

  const bedrockPayload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: body.max_tokens || 2048,
    temperature: body.temperature ?? 0.55,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    ...(systemPrompt ? { system: systemPrompt } : {}),
  }

  const bedrockUrl = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com/model/${bedrockModelId}/invoke`
  const payloadStr = JSON.stringify(bedrockPayload)

  if (payloadStr.length > 3_000_000) {
    return res.status(413).json({ error: 'Payload too large.' })
  }

  try {
    const upstreamRes = await fetch(bedrockUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bedrockApiKey}`,
      },
      body: payloadStr,
    })

    const text = await upstreamRes.text()
    let data = null
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

    if (!upstreamRes.ok) {
      console.error('[REPMAX] Bedrock error:', upstreamRes.status, text.slice(0, 500))
      return res.status(upstreamRes.status).json({
        error: data?.message || data?.error?.message || `Bedrock request failed: ${upstreamRes.status}`,
        details: data,
      })
    }

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
    }

    return res.status(200).json(openAiFormat)
  } catch (err) {
    console.error('[REPMAX] Bedrock proxy error:', err)
    return res.status(500).json({ error: 'Bedrock request failed: ' + (err.message || 'Unknown error') })
  }
}
