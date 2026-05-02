import { getCurrentPosition } from './native'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const GYM_BRAND_REGEX = 'Basic[ -]?Fit|TrainMore|Anytime Fitness|David Lloyd|SportCity|Fit For Free|Vondelgym|BigGym|Club Pellikaan|Snap Fitness|The Gym'
const GYM_NAME_REGEX = 'gym|fitness|sportschool|fitclub|crossfit|basic[ -]?fit'

// Cache to avoid repeated API calls
let gymCache = { key: null, gyms: [], timestamp: 0 }
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getUserLocation() {
  const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
  return { lat: pos.coords.latitude, lon: pos.coords.longitude }
}

export async function findNearbyGyms(lat, lon, radiusMeters = 15000) {
  // Check cache
  const now = Date.now()
  const cacheKey = `${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusMeters}`
  if (gymCache.key === cacheKey && gymCache.gyms.length > 0 && now - gymCache.timestamp < CACHE_TTL) {
    return gymCache.gyms
  }

  try {
    const radii = Array.from(new Set([5000, 10000, radiusMeters].filter(radius => radius <= radiusMeters || radius === radiusMeters)))
    const combinedElements = []

    for (const radius of radii) {
      const query = buildOverpassQuery(lat, lon, radius)
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      if (!res.ok) throw new Error('Overpass API error')

      const data = await res.json()
      combinedElements.push(...(data.elements || []))
    }

    const gyms = combinedElements
      .map((element) => mapGymElement(element, lat, lon))
      .filter(Boolean)

    const uniqueGyms = dedupeGyms(gyms)
      .sort((a, b) => a.distance - b.distance)

    // Update cache
    gymCache = { key: cacheKey, gyms: uniqueGyms, timestamp: now }
    return uniqueGyms
  } catch (err) {
    console.warn('[REPMAX] Gym finder error:', err)
    return []
  }
}

function buildOverpassQuery(lat, lon, radiusMeters) {
  return `
    [out:json][timeout:16];
    (
      node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});
      node["leisure"="sports_centre"](around:${radiusMeters},${lat},${lon});
      node["amenity"="gym"](around:${radiusMeters},${lat},${lon});
      node["sport"="fitness"](around:${radiusMeters},${lat},${lon});
      node["name"~"${GYM_NAME_REGEX}",i](around:${radiusMeters},${lat},${lon});
      node["brand"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
      node["operator"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
      way["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});
      way["leisure"="sports_centre"](around:${radiusMeters},${lat},${lon});
      way["amenity"="gym"](around:${radiusMeters},${lat},${lon});
      way["sport"="fitness"](around:${radiusMeters},${lat},${lon});
      way["name"~"${GYM_NAME_REGEX}",i](around:${radiusMeters},${lat},${lon});
      way["brand"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
      way["operator"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
      relation["amenity"="gym"](around:${radiusMeters},${lat},${lon});
      relation["name"~"${GYM_NAME_REGEX}",i](around:${radiusMeters},${lat},${lon});
      relation["brand"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
      relation["operator"~"${GYM_BRAND_REGEX}",i](around:${radiusMeters},${lat},${lon});
    );
    out center 80;
  `
}

function mapGymElement(element, originLat, originLon) {
  const gymLat = element.lat || element.center?.lat
  const gymLon = element.lon || element.center?.lon
  const tags = element.tags || {}
  const name = tags.name || tags['name:en'] || tags.brand || tags.operator || null
  if (!name || !gymLat || !gymLon) return null

  const distance = haversineDistance(originLat, originLon, gymLat, gymLon)
  const address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
    .filter(Boolean)
    .join(' ')

  return {
    id: `${element.type || 'element'}-${element.id}`,
    name,
    address: address || null,
    lat: gymLat,
    lon: gymLon,
    distance,
    distanceLabel: distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`
  }
}

function normalizeGymName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function dedupeGyms(gyms = []) {
  const uniqueGyms = []
  const seen = new Set()

  for (const gym of gyms) {
    const roundedLat = Number(gym.lat).toFixed(3)
    const roundedLon = Number(gym.lon).toFixed(3)
    const dedupeKey = `${normalizeGymName(gym.name)}:${roundedLat}:${roundedLon}`

    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    uniqueGyms.push(gym)
  }

  return uniqueGyms
}

// Haversine formula — distance between two coordinates in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg) { return deg * Math.PI / 180 }
