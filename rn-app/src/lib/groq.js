import { invokeServerApi, invokeEdgeFunction, supabase } from './supabase'

export const COACH_MODEL_OPTIONS = [
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', tier: 'free', provider: 'openrouter' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', tier: 'pro', provider: 'openrouter', paidOnly: true },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', tier: 'pro', provider: 'openrouter', paidOnly: true },
]

export const COACH_RESPONSE_STYLE_OPTIONS = [
  { id: 'quick', label: 'Quick', maxTokens: 300 },
  { id: 'balanced', label: 'Balanced', maxTokens: 800 },
  { id: 'deep', label: 'Deep Dive', maxTokens: 2000 },
]

export const DEFAULT_COACH_MODEL = 'llama-3.3-70b'
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
  const { model = DEFAULT_COACH_MODEL, style = 'balanced', isPaid = false } = options
  const styleConfig = COACH_RESPONSE_STYLE_OPTIONS.find(s => s.id === style) || COACH_RESPONSE_STYLE_OPTIONS[1]
  const modelConfig = COACH_MODEL_OPTIONS.find(m => m.id === model) || COACH_MODEL_OPTIONS[0]
  const system = buildCoachSystemPrompt(context)

  const messages = [
    ...(context.history || []).slice(-12),
    { role: 'user', content: message },
  ]

  if (modelConfig.paidOnly) {
    const data = await invokeServerApi('/api/bedrock-proxy', {
      messages,
      system,
      model: `anthropic/${modelConfig.id}`,
      max_tokens: styleConfig.maxTokens,
      feature: 'coach',
    }, { timeoutMs: 30000 })
    return data?.choices?.[0]?.message?.content || data?.content || data?.response || data?.raw || ''
  }

  const data = await invokeServerApi('/api/ai-proxy', {
    messages,
    model: modelConfig.id,
    max_tokens: styleConfig.maxTokens,
    system,
  }, { timeoutMs: 30000 })
  return data?.content || data?.choices?.[0]?.message?.content || data?.raw || ''
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
    { model: 'claude-sonnet-4', style: 'deep', isPaid: true }
  )
}

export async function callGroq(messages, system, model = DEFAULT_COACH_MODEL) {
  return askCoach(messages[messages.length - 1]?.content || '', { history: messages.slice(0, -1) }, { model })
}
