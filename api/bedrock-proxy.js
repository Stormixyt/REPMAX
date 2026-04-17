const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

const MODEL_MAP = {
  'anthropic/claude-opus-4': 'us.anthropic.claude-opus-4-0-20250514',
  'anthropic/claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514',
  'anthropic/claude-haiku-3.5': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
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

function hmacSha256(key, message) {
  const crypto = require('crypto')
  return crypto.createHmac('sha256', key).update(message).digest()
}

function sha256(data) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  let key = Buffer.from('AWS4' + secretKey, 'utf8')
  key = hmacSha256(key, dateStamp)
  key = hmacSha256(key, region)
  key = hmacSha256(key, service)
  key = hmacSha256(key, 'aws4_request')
  return key
}

function signRequest({ method, url, headers, body, region, accessKey, secretKey, sessionToken }) {
  const crypto = require('crypto')
  const parsedUrl = new URL(url)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const service = 'bedrock'
  const host = parsedUrl.hostname
  const path = parsedUrl.pathname

  const payloadHash = sha256(body || '')

  const canonicalHeaders = [
    `content-type:application/json`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    ...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
  ].join('\n') + '\n'

  const signedHeadersList = [
    'content-type',
    'host',
    'x-amz-content-sha256',
    'x-amz-date',
    ...(sessionToken ? ['x-amz-security-token'] : []),
  ].join(';')

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeadersList,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeadersList}, Signature=${signature}`

  return {
    'Content-Type': 'application/json',
    'Host': host,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
    'Authorization': authHeader,
    ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY
  const awsSessionToken = process.env.AWS_SESSION_TOKEN || null
  const awsRegion = process.env.AWS_BEDROCK_REGION || 'us-east-1'

  if (!awsAccessKey || !awsSecretKey) {
    return res.status(503).json({ error: 'AWS Bedrock is not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel.' })
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

  const bedrockUrl = `https://bedrock-runtime.${awsRegion}.amazonaws.com/model/${bedrockModelId}/invoke`
  const payloadStr = JSON.stringify(bedrockPayload)

  if (payloadStr.length > 3_000_000) {
    return res.status(413).json({ error: 'Payload too large.' })
  }

  const signedHeaders = signRequest({
    method: 'POST',
    url: bedrockUrl,
    body: payloadStr,
    region: awsRegion,
    accessKey: awsAccessKey,
    secretKey: awsSecretKey,
    sessionToken: awsSessionToken,
  })

  try {
    const upstreamRes = await fetch(bedrockUrl, {
      method: 'POST',
      headers: signedHeaders,
      body: payloadStr,
    })

    const text = await upstreamRes.text()
    let data = null
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

    if (!upstreamRes.ok) {
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
