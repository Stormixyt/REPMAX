const env = import.meta?.env || {}

const PROMO_CODE = (env.VITE_SELLAPP_PROMO_CODE || 'REPMAXISOUT20').trim()
const CHECKOUT_FIELD_KEY = (
  env.VITE_SELLAPP_CHECKOUT_FIELD_KEY ||
  env.VITE_SELLAPP_PRO_FIELD_KEY ||
  ''
).trim()

const PRODUCT_URLS = {
  pro: (env.VITE_SELLAPP_PRO_URL || '').trim(),
  ultra: (env.VITE_SELLAPP_ULTRA_URL || '').trim(),
}

function normalizeTier(tier) {
  return tier === 'ultra' ? 'ultra' : 'pro'
}

export function getSellAppMissingConfig(tier) {
  const normalizedTier = normalizeTier(tier)
  const missing = []

  if (!PRODUCT_URLS[normalizedTier]) {
    missing.push(`VITE_SELLAPP_${normalizedTier.toUpperCase()}_URL`)
  }

  if (!CHECKOUT_FIELD_KEY) {
    missing.push('VITE_SELLAPP_CHECKOUT_FIELD_KEY')
  }

  return missing
}

export function isSellAppConfigured(tier) {
  return getSellAppMissingConfig(tier).length === 0
}

export function getSellAppCheckoutUrl(tier, { email, userId, coupon = PROMO_CODE } = {}) {
  const normalizedTier = normalizeTier(tier)
  const baseUrl = PRODUCT_URLS[normalizedTier]

  if (!baseUrl || !CHECKOUT_FIELD_KEY) return null

  const url = new URL(baseUrl)

  if (coupon) {
    url.searchParams.set('coupon', coupon)
  }

  if (email) {
    url.searchParams.set('email', String(email).trim().toLowerCase())
  }

  if (userId) {
    url.searchParams.set(`additional-${CHECKOUT_FIELD_KEY}`, String(userId).trim())
  }

  url.searchParams.set('payment_method', 'STRIPE')
  return url.toString()
}

export function openSellAppCheckout(tier, options) {
  const checkoutUrl = getSellAppCheckoutUrl(tier, options)
  if (!checkoutUrl) return { ok: false, error: 'Sell.app checkout is not configured yet.' }

  window.location.assign(checkoutUrl)
  return { ok: true }
}
