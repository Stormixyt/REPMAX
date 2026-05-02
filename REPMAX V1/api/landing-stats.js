const SUPABASE_URL = 'https://hqwnyzmipumhhqmvdzus.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd255em1pcHVtaGhxbXZkenVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzkxMjAsImV4cCI6MjA5MDQ1NTEyMH0.s6XMRJUli5vzyeGs8yBv5nQ7MGXhFJSLZDn_NdrFGKI'

const TRAINING_SPLIT_COUNT = 9
const EXERCISE_LIBRARY_COUNT = 48
const AI_PERSONALIZED_PERCENT = 100

async function fetchWaitlistCount() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_waitlist_count`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[REPMAX] Failed to fetch waitlist count:', response.status, errorText.slice(0, 200))
    return null
  }

  const payloadText = await response.text()
  try {
    const payload = JSON.parse(payloadText)
    const parsed = Number(payload?.count ?? payload?.get_waitlist_count ?? payload)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  } catch {
    const parsed = Number(payloadText)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const waitlist = await fetchWaitlistCount()

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  return res.status(200).json({
    waitlist,
    trainingSplits: TRAINING_SPLIT_COUNT,
    exercises: EXERCISE_LIBRARY_COUNT,
    aiPersonalized: AI_PERSONALIZED_PERCENT,
    updatedAt: new Date().toISOString()
  })
}
