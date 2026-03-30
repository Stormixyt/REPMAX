import { useState, useEffect, useRef, useCallback } from 'react'

export default function RestTimer({ duration, onClose, onDurationChange }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            // Vibrate on timer complete
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(intervalRef.current)
  }, [running, timeLeft])

  function toggleTimer() {
    if (timeLeft === 0) {
      setTimeLeft(duration)
      setRunning(true)
    } else {
      setRunning(!running)
    }
  }

  function adjustTime(delta) {
    const newDuration = Math.max(30, (duration + delta))
    onDurationChange(newDuration)
    setTimeLeft(prev => Math.max(0, prev + delta))
  }

  const radius = 100
  const circumference = 2 * Math.PI * radius
  const progress = duration > 0 ? ((duration - timeLeft) / duration) : 0
  const dashOffset = circumference * (1 - progress)

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className="timer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="timer-ring">
        <svg viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={radius} className="timer-ring-bg" />
          <circle
            cx="110" cy="110" r={radius}
            className="timer-ring-progress"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="timer-time">
          <div className="timer-seconds">
            {minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : seconds}
          </div>
          <div className="timer-label">
            {timeLeft === 0 ? 'Time\'s up!' : running ? 'Resting...' : 'Paused'}
          </div>
        </div>
      </div>

      <div className="timer-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => adjustTime(-15)}>-15s</button>
        <button className="btn btn-primary" onClick={toggleTimer} style={{ minWidth: 100 }}>
          {timeLeft === 0 ? 'Reset' : running ? 'Pause' : 'Resume'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => adjustTime(15)}>+15s</button>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={onClose}>
        Skip Rest
      </button>

      {/* Quick presets */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {[60, 90, 120, 180, 300].map(t => (
          <button
            key={t}
            className={`btn btn-sm ${duration === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { onDurationChange(t); setTimeLeft(t); setRunning(true) }}
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            {t >= 60 ? `${t / 60}m` : `${t}s`}
          </button>
        ))}
      </div>
    </div>
  )
}
