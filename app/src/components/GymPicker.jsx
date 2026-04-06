import { useState, useEffect, useRef } from 'react'
import { RiMapPin2Fill, RiSearchLine, RiLoader4Line, RiMapPinLine, RiArrowRightSLine } from '@remixicon/react'
import { getUserLocation, findNearbyGyms } from '../lib/gymFinder'

export default function GymPicker({ value, onChange }) {
  const [mode, setMode] = useState('loading') // loading | list | manual | error
  const [gyms, setGyms] = useState([])
  const [search, setSearch] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [loadingLabel, setLoadingLabel] = useState('Finding gyms near you...')
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadGyms()
  }, [])

  async function loadGyms() {
    setMode('loading')
    try {
      const loc = await getUserLocation()
      setUserLocation(loc)
      setLoadingLabel('Scanning gyms near you...')
      let results = await findNearbyGyms(loc.lat, loc.lon, 12000)
      if (results.length < 4) {
        setLoadingLabel('Checking a wider area too...')
        const widerResults = await findNearbyGyms(loc.lat, loc.lon, 25000)
        const merged = new Map()
        for (const gym of [...results, ...widerResults]) {
          if (!merged.has(gym.id)) {
            merged.set(gym.id, gym)
          }
        }
        results = [...merged.values()].sort((a, b) => a.distance - b.distance)
      }

      if (results.length > 0) {
        setGyms(results.slice(0, 16))
        setMode('list')
      } else {
        setMode('manual')
      }
    } catch {
      setMode('manual')
    }
  }

  const filtered = search
    ? gyms.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : gyms

  if (mode === 'loading') {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <div className="loading-dots"><span /><span /><span /></div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 12 }}>
          {loadingLabel}
        </p>
      </div>
    )
  }

  if (mode === 'manual' || (mode === 'list' && gyms.length === 0)) {
    return (
      <div className="input-group">
        <label className="input-label">Gym or Location</label>
        <input
          className="input"
          placeholder="e.g. Gold's Gym Downtown"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus
        />
        {gyms.length === 0 && userLocation && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
            No gyms found nearby. Type your gym name manually or try again from a spot with better location accuracy.
          </p>
        )}
      </div>
    )
  }

  // List mode — show nearby gyms
  return (
    <div>
      <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>
        <RiMapPin2Fill size={13} style={{ verticalAlign: -2, marginRight: 4, color: 'var(--accent)' }} />
        Gyms near you
      </label>

      {/* Search within results */}
      {gyms.length > 4 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '8px 12px', marginBottom: 10
        }}>
          <RiSearchLine size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="Search gyms..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '0.88rem', flex: 1
            }}
          />
        </div>
      )}

      {/* Gym list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        maxHeight: 220, overflowY: 'auto', overflowX: 'hidden',
        paddingRight: 4
      }}>
        {filtered.map(gym => {
          const isSelected = value === gym.name
          return (
            <button
              key={gym.id}
              onClick={() => onChange(gym.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: isSelected ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 14, padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s ease', width: '100%'
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <RiMapPinLine size={18} color={isSelected ? 'var(--text-on-accent)' : 'var(--text-secondary)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.9rem',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {gym.name}
                </div>
                {gym.address && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gym.address}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
                flexShrink: 0, background: 'rgba(212,255,0,0.1)',
                padding: '3px 8px', borderRadius: 6
              }}>
                {gym.distanceLabel}
              </div>
            </button>
          )
        })}
      </div>

      {/* Manual entry fallback */}
      <button
        onClick={() => setMode('manual')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 10, padding: '10px', width: '100%',
          background: 'transparent', border: '1px dashed var(--border)',
          borderRadius: 12, cursor: 'pointer',
          color: 'var(--text-tertiary)', fontSize: '0.82rem', fontWeight: 500
        }}
      >
        Or type a gym name manually <RiArrowRightSLine size={14} />
      </button>
    </div>
  )
}
