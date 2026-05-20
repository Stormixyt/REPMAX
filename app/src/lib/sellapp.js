const env = import.meta?.env || {}

const PROMO_CODE = (env.VITE_SELLAPP_PROMO_CODE || 'REPMAXISOUT20').trim()
const CHECKOUT_FIELD_KEY = (env.VITE_SELLAPP_CHECKOUT_FIELD_KEY || '83db47d0036f01213da4cca3c11f9722').trim()

export const SELLAPP_STORE = 'repmax'

export const SELLAPP_PRODUCTS = {
  pro: 'product-1779286957',
  ultra: 'product-1779287005',
}

function normalizeTier(tier) {
  return tier === 'ultra' ? 'ultra' : 'pro'
}

/**
 * Build the data-sell-* attributes for an embed checkout button.
 * Spread these onto a <button> element in JSX.
 */
export function getSellAppEmbedAttrs(tier, { email, userId, coupon = PROMO_CODE } = {}) {
  const normalizedTier = normalizeTier(tier)
  const attrs = {
    'data-sell-store': SELLAPP_STORE,
    'data-sell-product': SELLAPP_PRODUCTS[normalizedTier],
    'data-sell-payment_method': 'STRIPE',
  }

  if (email) {
    attrs['data-sell-email'] = String(email).trim().toLowerCase()
  }

  if (coupon) {
    attrs['data-sell-coupon'] = coupon
  }

  if (userId) {
    attrs[`data-sell-checkout-${CHECKOUT_FIELD_KEY}`] = String(userId).trim()
  }

  return attrs
}
