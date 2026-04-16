import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiArrowLeftLine, RiFootprintFill, RiMapPin2Fill, RiPauseCircleFill, RiPlayCircleFill, RiStopCircleFill, RiTimerFlashFill } from '@remixicon/react'
import { useLanguage } from '../context/LanguageContext'

const RUN_HISTORY_KEY = 'repmax-run-history'

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatPace(distanceKm, elapsedSeconds) {
  if (!distanceKm || !elapsedSeconds) return '--'
  const secondsPerKm = elapsedSeconds / distanceKm
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

function loadRunHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export default function RunTracker() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [distanceKm, setDistanceKm] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0)
  const [lastAccuracy, setLastAccuracy] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(() => loadRunHistory())
  const watchIdRef = useRef(null)
  const timerRef = useRef(null)
  const lastPointRef = useRef(null)
  const startedAtRef = useRef(null)
  const pausedAtRef = useRef(null)

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const estimatedSteps = useMemo(() => Math.round((distanceKm * 1000) / 0.78), [distanceKm])
  const pace = useMemo(() => formatPace(distanceKm, elapsedSeconds), [distanceKm, elapsedSeconds])

  function resetRun() {
    setIsRunning(false)
    setIsPaused(false)
    setDistanceKm(0)
    setElapsedSeconds(0)
    setCurrentSpeedKmh(0)
    setLastAccuracy(null)
    setError('')
    lastPointRef.current = null
    startedAtRef.current = null
    pausedAtRef.current = null
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!startedAtRef.current) return
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)))
    }, 1000)
  }

  function beginLocationWatch() {
    if (!navigator.geolocation) {
      setError('Location tracking is not supported on this device.')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords
        setLastAccuracy(accuracy || null)
        setCurrentSpeedKmh(speed && speed > 0 ? speed * 3.6 : 0)

        const nextPoint = { latitude, longitude, accuracy: accuracy || 0 }
        const previousPoint = lastPointRef.current

        if (previousPoint) {
          const delta = haversineDistance(
            previousPoint.latitude,
            previousPoint.longitude,
            nextPoint.latitude,
            nextPoint.longitude
          )

          if (delta > 0.003 && delta < 0.4 && (accuracy || 0) < 120) {
            setDistanceKm((current) => current + delta)
          }
        }

        lastPointRef.current = nextPoint
      },
      (positionError) => {
        setError(positionError.message || 'Could not track your run.')
      },
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
    )
  }

  function handleStartRun() {
    setError('')
    setDistanceKm(0)
    setElapsedSeconds(0)
    setCurrentSpeedKmh(0)
    setLastAccuracy(null)
    lastPointRef.current = null
    startedAtRef.current = Date.now()
    pausedAtRef.current = null
    setIsRunning(true)
    setIsPaused(false)
    startTimer()
    beginLocationWatch()
  }

  function handlePauseRun() {
    if (!isRunning) return
    setIsPaused(true)
    pausedAtRef.current = Date.now()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  function handleResumeRun() {
    if (!isRunning || !isPaused) return
    const pausedDuration = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0
    startedAtRef.current = (startedAtRef.current || Date.now()) + pausedDuration
    pausedAtRef.current = null
    // Clear last GPS point to prevent drift — first reading after resume sets new anchor
    lastPointRef.current = null
    setIsPaused(false)
    startTimer()
    beginLocationWatch()
  }

  function handleFinishRun() {
    const endTime = pausedAtRef.current || Date.now()
    const finalElapsedSeconds = startedAtRef.current
      ? Math.max(0, Math.round((endTime - startedAtRef.current) / 1000))
      : elapsedSeconds

    const completedRun = {
      id: crypto.randomUUID(),
      finishedAt: new Date().toISOString(),
      elapsedSeconds: finalElapsedSeconds,
      distanceKm,
      estimatedSteps,
      averagePace: formatPace(distanceKm, finalElapsedSeconds),
    }

    if (completedRun.distanceKm > 0.05 || completedRun.elapsedSeconds > 60) {
      const nextHistory = [completedRun, ...history].slice(0, 8)
      setHistory(nextHistory)
      try {
        localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(nextHistory))
      } catch {}
    }

    resetRun()
  }

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <RiArrowLeftLine size={20} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title">{t('run_title')}</h1>
        <p className="page-subtitle" style={{ maxWidth: 460 }}>{t('run_subtitle')}</p>
      </div>

      <div className="run-tracker-shell">
        <div className="run-tracker-hero">
          <div className="run-tracker-kicker">OUTDOOR BETA</div>
          <div className="run-tracker-distance">{distanceKm.toFixed(2)} km</div>
          <div className="run-tracker-pace">{pace}</div>
          <div className="run-tracker-meta">
            <span>{t('run_duration')}: {formatDuration(elapsedSeconds)}</span>
            <span>{t('run_steps')}: {estimatedSteps}</span>
            <span>{t('run_pace')}: {pace}</span>
          </div>
        </div>

        <div className="run-tracker-stats">
          <div className="run-stat-card">
            <div className="run-stat-icon"><RiTimerFlashFill size={18} /></div>
            <div className="run-stat-label">{t('run_duration')}</div>
            <div className="run-stat-value">{formatDuration(elapsedSeconds)}</div>
          </div>
          <div className="run-stat-card">
            <div className="run-stat-icon"><RiMapPin2Fill size={18} /></div>
            <div className="run-stat-label">{t('run_distance')}</div>
            <div className="run-stat-value">{distanceKm.toFixed(2)} km</div>
          </div>
          <div className="run-stat-card">
            <div className="run-stat-icon"><RiFootprintFill size={18} /></div>
            <div className="run-stat-label">{t('run_steps')}</div>
            <div className="run-stat-value">{estimatedSteps}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">Live Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div className="run-live-box">
              <span>Speed</span>
              <strong>{currentSpeedKmh > 0 ? `${currentSpeedKmh.toFixed(1)} km/h` : '--'}</strong>
            </div>
            <div className="run-live-box">
              <span>GPS Accuracy</span>
              <strong>{lastAccuracy ? `${Math.round(lastAccuracy)}m` : '--'}</strong>
            </div>
          </div>
          <p style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            {t('run_beta_note')}
          </p>
        </div>

        {error && (
          <div className="card" style={{ marginTop: 16, borderColor: 'rgba(255, 94, 94, 0.22)', background: 'rgba(255, 94, 94, 0.06)' }}>
            <div style={{ color: '#ff8a8a', fontWeight: 700, marginBottom: 6 }}>Tracking issue</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{error}</div>
          </div>
        )}

        <div className="run-tracker-actions">
          {!isRunning && (
            <button className="btn btn-primary btn-full btn-lg" onClick={handleStartRun}>
              <RiPlayCircleFill size={20} /> {t('run_start')}
            </button>
          )}

          {isRunning && !isPaused && (
            <>
              <button className="btn btn-secondary btn-full" onClick={handlePauseRun}>
                <RiPauseCircleFill size={20} /> {t('run_pause')}
              </button>
              <button className="btn btn-primary btn-full btn-lg" onClick={handleFinishRun}>
                <RiStopCircleFill size={20} /> {t('run_finish')}
              </button>
            </>
          )}

          {isRunning && isPaused && (
            <>
              <button className="btn btn-secondary btn-full" onClick={handleResumeRun}>
                <RiPlayCircleFill size={20} /> {t('run_resume')}
              </button>
              <button className="btn btn-primary btn-full btn-lg" onClick={handleFinishRun}>
                <RiStopCircleFill size={20} /> {t('run_finish')}
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ fontSize: '1rem' }}>{t('run_history')}</div>
          {history.length === 0 ? (
            <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Your outdoor runs will show up here after you finish one.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {history.map((run) => (
                <div key={run.id} className="run-history-item">
                  <div>
                    <div className="run-history-date">{new Date(run.finishedAt).toLocaleDateString()}</div>
                    <div className="run-history-meta">{formatDuration(run.elapsedSeconds)} · {run.averagePace}</div>
                  </div>
                  <div className="run-history-distance">{Number(run.distanceKm || 0).toFixed(2)} km</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
