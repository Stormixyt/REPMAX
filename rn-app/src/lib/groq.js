import { invokeServerApi, invokeEdgeFunction, supabase } from './supabase'

export const COACH_MODEL_OPTIONS = [
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', tier: 'free', provider: 'openrouter', description: 'Free: 1/day · Pro: 5/day · Ultra: 10/day' },
]

export const COACH_RESPONSE_STYLE_OPTIONS = [
  { id: 'quick', label: 'Quick', maxTokens: 300 },
  { id: 'balanced', label: 'Balanced', maxTokens: 800 },
  { id: 'deep', label: 'Deep Dive', maxTokens: 2000 },
]

export const DEFAULT_COACH_MODEL = 'claude-haiku-4.5'
export const MODEL = DEFAULT_COACH_MODEL

function buildCoachSystemPrompt(context = {}) {
  const parts = [
    'You are REPMAX Coach, an expert fitness and nutrition AI assistant.',
    'Be concise, actionable, and motivating. Use fitness terminology naturally.',
    'Format responses with clear structure when needed.',
  ]
  if (context.goal) parts.push(`User goal: ${context.goal}`)
  if (context.experience) parts.push(`Experience level: ${context.experience}`)
  if (context.split) parts.push(`Training split: ${context.split}`)
  if (context.recentWorkouts?.length) {
    parts.push(`Recent workouts: ${context.recentWorkouts.map(w => w.day_name || 'Workout').join(', ')}`)
  }
  if (context.recentPRs?.length) {
    parts.push(`Recent PRs: ${context.recentPRs.slice(0, 5).map(p => `${p.exercise_name} ${p.weight}x${p.reps}`).join(', ')}`)
  }
  return parts.join('\n')
}

export async function askCoach(message, context = {}, options = {}) {
  const { style = 'balanced' } = options
  const styleConfig = COACH_RESPONSE_STYLE_OPTIONS.find(s => s.id === style) || COACH_RESPONSE_STYLE_OPTIONS[1]
  const system = buildCoachSystemPrompt(context)

  const chatMessages = [
    ...(context.history || []).slice(-12),
    { role: 'user', content: message },
  ]

  const data = await invokeServerApi('/api/bedrock-proxy', {
    messages: chatMessages,
    system,
    model: 'anthropic/claude-haiku-4.5',
    max_tokens: styleConfig.maxTokens,
    feature: 'coach',
  }, { timeoutMs: 30000 })
  return data?.choices?.[0]?.message?.content || data?.content || data?.response || data?.raw || ''
}

export async function scanFoodPhoto(base64DataUrl, options = {}) {
  const { isPaid = false } = options
  try {
    const data = await invokeServerApi('/api/bedrock-proxy', {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this food photo. Return JSON with: { "success": true, "food": { "name": "...", "calories": N, "protein": N, "carbs": N, "fat": N, "serving": "..." } } or { "success": false, "error": { "message": "..." }, "suggestedQuery": "..." }' },
          { type: 'image_url', image_url: { url: base64DataUrl } },
        ],
      }],
      model: 'anthropic/claude-haiku-4.5',
      max_tokens: 500,
      feature: 'photo_scan',
    }, { timeoutMs: 20000 })

    const text = data?.choices?.[0]?.message?.content || data?.content || data?.response || ''
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
    } catch {}
    return { success: false, error: { message: 'Could not parse the response.' } }
  } catch (err) {
    return { success: false, error: { message: err.message || 'Scan failed.' } }
  }
}

export function canAttemptRoutineChange(profile) {
  return !!(profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'ultra')
}

export async function requestRoutineChange(request, programId) {
  return askCoach(
    `I want to change my routine: ${request}. My current program ID is ${programId}. Suggest specific changes.`,
    {},
    { style: 'deep' }
  )
}

export async function callGroq(messages, system, model = DEFAULT_COACH_MODEL) {
  return askCoach(messages[messages.length - 1]?.content || '', { history: messages.slice(0, -1) }, {})
}
