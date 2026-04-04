// Finds nearby gyms using OpenStreetMap Overpass API (free, no API key needed)
// Falls back to a simple search if geolocation is denied

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Cache to avoid repeated API calls
let gymCache = { lat: null, lon: null, gyms: [], timestamp: 0 }
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  })
}

export async function findNearbyGyms(lat, lon, radiusMeters = 15000) {
  // Check cache
  const now = Date.now()
  if (
    gymCache.lat === lat &&
    gymCache.lon === lon &&
    gymCache.gyms.length > 0 &&
    now - gymCache.timestamp < CACHE_TTL
  ) {
    return gymCache.gyms
  }

  const query = `
    [out:json][timeout:10];
    (
      node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});
      node["leisure"="sports_centre"](around:${radiusMeters},${lat},${lon});
      node["amenity"="gym"](around:${radiusMeters},${lat},${lon});
      node["sport"="fitness"](around:${radiusMeters},${lat},${lon});
      way["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lon});
      way["leisure"="sports_centre"](around:${radiusMeters},${lat},${lon});
      way["amenity"="gym"](around:${radiusMeters},${lat},${lon});
      way["sport"="fitness"](around:${radiusMeters},${lat},${lon});
    );
    out center 50;
  `

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    if (!res.ok) throw new Error('Overpass API error')

    const data = await res.json()
    const gyms = data.elements
      .map(el => {
        const elLat = el.lat || el.center?.lat
        const elLon = el.lon || el.center?.lon
        const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.brand || null
        if (!name || !elLat || !elLon) return null

        const dist = haversineDistance(lat, lon, elLat, elLon)
        const address = [el.tags?.['addr:street'], el.tags?.['addr:housenumber'], el.tags?.['addr:city']]
          .filter(Boolean).join(' ')

        return {
          id: el.id,
          name,
          address: address || null,
          lat: elLat,
          lon: elLon,
          distance: dist,
          distanceLabel: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`
        }
      })
      .filter(Boolean)

    // Deduplicate identical gyms (often OpenStreetMap maps the same building and POI twice)
    const uniqueGyms = []
    const seenNames = new Set()
    for (const gym of gyms) {
      if (!seenNames.has(gym.name)) {
        seenNames.add(gym.name)
        uniqueGyms.push(gym)
      }
    }

    uniqueGyms.sort((a, b) => a.distance - b.distance)

    // Update cache
    gymCache = { lat, lon, gyms: uniqueGyms, timestamp: now }
    return uniqueGyms
  } catch (err) {
    console.warn('[REPMAX] Gym finder error:', err)
    return []
  }
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
