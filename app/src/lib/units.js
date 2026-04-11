// Unit conversion utility for REPMAX
// All weights are stored in lbs internally

export function convertWeight(valueLbs, unit = 'kg') {
  if (!valueLbs && valueLbs !== 0) return 0
  const v = Number(valueLbs)
  if (!Number.isFinite(v)) return 0
  return unit === 'kg' ? Math.round(v * 0.453592 * 10) / 10 : Math.round(v * 10) / 10
}

export function convertToLbs(value, fromUnit = 'kg') {
  if (!value && value !== 0) return 0
  const v = Number(value)
  if (!Number.isFinite(v)) return 0
  return fromUnit === 'kg' ? Math.round(v / 0.453592 * 10) / 10 : v
}

export function formatWeight(valueLbs, unit = 'kg', decimal = 0) {
  const converted = convertWeight(valueLbs, unit)
  return decimal > 0 ? converted.toFixed(decimal) : Math.round(converted)
}

export function weightLabel(unit = 'kg') {
  return unit === 'kg' ? 'kg' : 'lbs'
}

export function formatVolume(volumeLbs, unit = 'kg') {
  const converted = convertWeight(volumeLbs, unit)
  if (converted >= 1000000) return `${(converted / 1000000).toFixed(1)}M`
  if (converted >= 1000) return `${(converted / 1000).toFixed(0)}k`
  return Math.round(converted).toString()
}
