const env = import.meta?.env || {}

const PROMO_CODE = (env.VITE_SELLAPP_PROMO_CODE || 'REPMAXISOUT20').trim()
const CHECKOUT_FIELD_KEY = (env.VITE_SELLAPP_CHECKOUT_FIELD_KEY || '83db47d0036f01213da4cca3c11f9722').trim()

const STORE_SLUG = 'repmax'

const PRODUCT_SLUGS = {
  pro: 'product-1779286957',
  ultra: 'product-1779287005',
}

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

/**
 * Opens the Sell.app EMBED modal checkout (stays on REPMAX).
 * The embed script (cdn.sell.app/embed/script.js) listens for clicks
 * on elements with data-sell-* attributes and opens its modal.
 */
export function openSellAppCheckout(tier, { email, userId, coupon = PROMO_CODE } = {}) {
  const normalizedTier = normalizeTier(tier)
  const productSlug = PRODUCT_SLUGS[normalizedTier]

  if (!productSlug) {
    return { ok: false, error: 'Sell.app checkout is not configured yet.' }
  }

  // Create a temporary button with the right data-sell-* attributes
  // and click it so the Sell.app embed script opens the modal
  const btn = document.createElement('button')
  btn.setAttribute('data-sell-store', STORE_SLUG)
  btn.setAttribute('data-sell-product', productSlug)

  if (email) {
    btn.setAttribute('data-sell-email', String(email).trim().toLowerCase())
  }

  if (coupon) {
    btn.setAttribute('data-sell-coupon', coupon)
  }

  if (userId) {
    btn.setAttribute(`data-sell-checkout-${CHECKOUT_FIELD_KEY}`, String(userId).trim())
  }

  btn.setAttribute('data-sell-payment_method', 'STRIPE')

  // Must be in the DOM for the embed script to intercept the click
  btn.style.display = 'none'
  document.body.appendChild(btn)
  btn.click()

  // Clean up after a short delay (modal is already triggered)
  setTimeout(() => btn.remove(), 500)

  return { ok: true }
}

/**
 * Fallback: redirect to Sell.app checkout page (leaves REPMAX).
 */
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
