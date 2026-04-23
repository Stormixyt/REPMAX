const LB_TO_KG = 0.453592

export function convertWeight(valueLbs, unit) {
  if (unit === 'kg') return valueLbs * LB_TO_KG
  return valueLbs
}

export function convertToLbs(value, fromUnit) {
  if (fromUnit === 'kg') return value / LB_TO_KG
  return value
}

export function formatWeight(valueLbs, unit, decimal = 0) {
  const val = Number(valueLbs) || 0
  const converted = unit === 'kg' ? val * LB_TO_KG : val
  return decimal > 0 ? converted.toFixed(decimal) : Math.round(converted).toString()
}

export function weightLabel(unit) {
  return unit === 'kg' ? 'kg' : 'lbs'
}

export function formatVolume(volumeLbs, unit) {
  const val = Number(volumeLbs) || 0
  const converted = unit === 'kg' ? val * LB_TO_KG : val
  if (converted >= 1000000) return `${(converted / 1000000).toFixed(1)}M`
  if (converted >= 1000) return `${(converted / 1000).toFixed(1)}k`
  return Math.round(converted).toString()
}
