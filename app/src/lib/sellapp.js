const env = import.meta?.env || {}

const PROMO_CODE = (env.VITE_SELLAPP_PROMO_CODE || 'REPMAXISOUT20').trim()
const CHECKOUT_FIELD_KEY = (env.VITE_SELLAPP_CHECKOUT_FIELD_KEY || '83db47d0036f01213da4cca3c11f9722').trim()

const PRODUCT_URLS = {
  pro: (env.VITE_SELLAPP_PRO_URL || 'https://repmax.sell.app/product/product-1779286957').trim(),
  ultra: (env.VITE_SELLAPP_ULTRA_URL || 'https://repmax.sell.app/product/product-1779287005').trim(),
}

function normalizeTier(tier) {
  return tier === 'ultra' ? 'ultra' : 'pro'
}

export function getSellAppMissingConfig(tier) {
  return []
}

export function isSellAppConfigured(tier) {
  return true
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
