const crypto = require('crypto')

const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase()
  if (tier === 'pro' || tier === 'ultra') return tier
  return null
}

function getQueryTier(req) {
  if (req?.query?.tier) return normalizeTier(req.query.tier)

  try {
    const url = new URL(req.url, 'https://www.rep-max.app')
    return normalizeTier(url.searchParams.get('tier'))
  } catch {
    return null
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function getMissingProfileColumn(errorPayload) {
  const message =
    String(
      errorPayload?.message ||
      errorPayload?.error ||
      errorPayload?.details ||
      ''
    )

  const match = message.match(/Could not find the '([^']+)' column of 'profiles'/i)
  return match?.[1] || null
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')

  return await new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(String(left || '').trim().toLowerCase(), 'utf8')
  const b = Buffer.from(String(right || '').trim().toLowerCase(), 'utf8')

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function getByPath(source, path) {
  const parts = path.split('.')
  let current = source

  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = current[part]
  }

  return current
}

function findFieldValue(node, targetKeys) {
  if (!node) return null

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFieldValue(item, targetKeys)
      if (found) return found
    }
    return null
  }

  if (typeof node !== 'object') return null

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.toLowerCase()
    if (targetKeys.includes(normalizedKey) && value != null && value !== '') {
      return String(value)
    }
  }

  const descriptor = [
    node.key,
    node.name,
    node.label,
    node.title,
    node.slug,
    node.id,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())

  if (descriptor.some((value) => targetKeys.includes(value))) {
    const fieldValue =
      node.value ??
      node.answer ??
      node.content ??
      node.text ??
      node.input ??
      null

    if (fieldValue != null && fieldValue !== '') {
      return String(fieldValue)
    }
  }

  for (const value of Object.values(node)) {
    const found = findFieldValue(value, targetKeys)
    if (found) return found
  }

  return null
}

function detectTierFromPayload(body) {
  const directTier =
    normalizeTier(
      findFieldValue(body, ['tier', 'subscription_tier', 'requested_tier'])
    )

  if (directTier) return directTier

  const candidates = [
    getByPath(body, 'product.title'),
    getByPath(body, 'product.name'),
    getByPath(body, 'variant.title'),
    getByPath(body, 'variant.name'),
    getByPath(body, 'invoice.product_title'),
    getByPath(body, 'invoice.product_name'),
    getByPath(body, 'title'),
    getByPath(body, 'name'),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  if (candidates.some((value) => value.includes('ultra'))) return 'ultra'
  if (candidates.some((value) => value.includes('pro'))) return 'pro'
  return null
}

function extractUserId(body) {
  return findFieldValue(body, [
    'repmax_user_id',
    'repmax user id',
    'user_id',
    'supabase_user_id',
    'repmaxuserid',
    'supabaseuserid',
    '83db47d0036f01213da4cca3c11f9722',
  ])
}

function extractEmail(body) {
  return (
    getByPath(body, 'customer.email') ||
    getByPath(body, 'invoice.customer_email') ||
    getByPath(body, 'invoice.email') ||
    getByPath(body, 'customer_email') ||
    getByPath(body, 'email') ||
    findFieldValue(body, ['email', 'customer_email'])
  )
}

function getServiceRoleHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function updateProfileWithFallback(userId, updates, serviceRoleKey) {
  const headers = getServiceRoleHeaders(serviceRoleKey)
  let nextUpdates = { ...updates }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(nextUpdates),
      }
    )

    if (response.ok) {
      const payload = await response.json().catch(() => [])
      return { ok: true, data: payload }
    }

    const errorPayload = await response.json().catch(() => ({}))
    const missingColumn = getMissingProfileColumn(errorPayload)

    if (!missingColumn || !(missingColumn in nextUpdates)) {
      return { ok: false, status: response.status, error: errorPayload }
    }

    delete nextUpdates[missingColumn]
  }

  return {
    ok: false,
    status: 500,
    error: { message: 'Profile update failed after fallback attempts.' },
  }
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Sell.app webhook endpoint is live.',
      proWebhookUrl: 'https://www.rep-max.app/api/sellapp-webhook?tier=pro',
      ultraWebhookUrl: 'https://www.rep-max.app/api/sellapp-webhook?tier=ultra',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret = process.env.SELLAPP_WEBHOOK_SECRET

  if (!serviceRoleKey) {
    return res.status(503).json({
      error: 'Missing SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    })
  }

  if (!webhookSecret) {
    return res.status(503).json({
      error: 'Missing SELLAPP_WEBHOOK_SECRET in Vercel.',
    })
  }

  const rawBody = await readRawBody(req)
  const signature = req.headers.signature

  if (!signature) {
    return res.status(401).json({ error: 'Missing Sell.app signature header.' })
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  if (!timingSafeEqualHex(expectedSignature, signature)) {
    return res.status(401).json({ error: 'Invalid Sell.app signature.' })
  }

  const body = safeJsonParse(rawBody)
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON payload.' })
  }

  const tier = getQueryTier(req) || detectTierFromPayload(body)
  const userId = extractUserId(body)
  const email = extractEmail(body)
  const orderId =
    getByPath(body, 'invoice.id') ||
    getByPath(body, 'order.id') ||
    getByPath(body, 'id') ||
    null

  if (!tier) {
    return res.status(400).json({
      message: 'Payment received, but REPMAX could not determine whether this was PRO or ULTRA.',
      orderId,
      email,
    })
  }

  if (!userId) {
    return res.status(400).json({
      message: 'Payment received, but the REPMAX user id was missing from checkout info.',
      hint: 'Pass the buyer Supabase user id as a Sell.app checkout field named repmax_user_id.',
      orderId,
      email,
    })
  }

  const nowIso = new Date().toISOString()
  const result = await updateProfileWithFallback(
    userId,
    {
      subscription_tier: tier,
      subscription_status: tier,
      pro_request_status: 'approved',
      pro_requested_at: nowIso,
      updated_at: nowIso,
    },
    serviceRoleKey
  )

  if (!result.ok) {
    return res.status(result.status || 500).json({
      message: 'Payment verified, but REPMAX could not update the user profile.',
      orderId,
      email,
      userId,
      details: result.error,
    })
  }

  if (!Array.isArray(result.data) || result.data.length === 0) {
    return res.status(404).json({
      message: 'Payment verified, but no REPMAX profile was found for that user id.',
      orderId,
      email,
      userId,
    })
  }

  return res.status(200).json({
    ok: true,
    message: `REPMAX ${tier.toUpperCase()} activated successfully.`,
    tier,
    userId,
    orderId,
  })
}

module.exports = handler
module.exports.config = {
  api: {
    bodyParser: false,
  },
}
