import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { REST_DAY_TIPS } from '../data/homeExercises'
import { RiDropFill, RiMoonFill, RiTimerFill, RiArrowRightLine, RiPlayFill, RiPauseFill, RiCheckFill } from '@remixicon/react'

const STRETCHES = [
  { name: 'Neck Roll', duration: 30 },
  { name: 'Shoulder Stretch', duration: 30 },
  { name: 'Cat-Cow', duration: 30 },
  { name: 'Hip Flexor Stretch', duration: 30 },
  { name: 'Hamstring Stretch', duration: 30 },
]

export default function RestDayHub() {
  const navigate = useNavigate()
  const [water, setWater] = useState(0)
  const [sleep, setSleep] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [stretchActive, setStretchActive] = useState(false)
  const [stretchIndex, setStretchIndex] = useState(0)
  const [timer, setTimer] = useState(0)
  const intervalRef = useRef(null)

  // Rotate tips
  useEffect(() => {
    setTipIndex(new Date().getDate() % REST_DAY_TIPS.length)
  }, [])

  // Stretch timer
  useEffect(() => {
    if (!stretchActive) {
      clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setTimer(t => {
        if (t >= STRETCHES[stretchIndex].duration) {
          if (stretchIndex < STRETCHES.length - 1) {
            setStretchIndex(i => i + 1)
            return 0
          } else {
            setStretchActive(false)
            return 0
          }
        }
        return t + 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [stretchActive, stretchIndex])

  const currentTip = REST_DAY_TIPS[tipIndex]
  const nextTip = REST_DAY_TIPS[(tipIndex + 1) % REST_DAY_TIPS.length]

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Rest day banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
        border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20,
        padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>😴</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', margin: '0 0 4px', color: 'var(--text-primary)' }}>
            Rest & Recovery Day
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
            Your muscles grow during rest. Focus on recovery, nutrition, and mobility today.
          </p>
        </div>
      </div>

      {/* Quick stretching routine */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label">5-Minute Stretch Routine</div>
        {!stretchActive ? (
          <button
            className="btn btn-primary btn-full"
            onClick={() => { setStretchActive(true); setStretchIndex(0); setTimer(0) }}
            style={{ marginTop: 8 }}
          >
            <RiPlayFill size={18} /> Start Stretching
          </button>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {STRETCHES[stretchIndex].name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {stretchIndex + 1} of {STRETCHES.length}
                </div>
              </div>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--accent-glow)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: '1.2rem', color: 'var(--accent)'
              }}>
                {STRETCHES[stretchIndex].duration - timer}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2 }}>
              <div style={{
                height: '100%', background: 'var(--accent)', borderRadius: 2,
                width: `${(timer / STRETCHES[stretchIndex].duration) * 100}%`,
                transition: 'width 1s linear'
              }} />
            </div>
            <button
              className="btn btn-secondary btn-full btn-sm"
              onClick={() => setStretchActive(false)}
              style={{ marginTop: 8 }}
            >
              <RiPauseFill size={16} /> Pause
            </button>
          </div>
        )}
      </div>

      {/* Water tracker */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label">
          <RiDropFill size={14} style={{ color: '#60a5fa', verticalAlign: -2 }} /> Hydration Tracker
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={i}
              onClick={() => setWater(i + 1)}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: '1.5px solid',
                borderColor: i < water ? '#60a5fa' : 'var(--border)',
                background: i < water ? 'rgba(96,165,250,0.15)' : 'var(--bg-elevated)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.2s',
                fontSize: '0.9rem'
              }}
            >
              {i < water ? '💧' : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>{i + 1}</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
          {water}/8 glasses • {water >= 8 ? '✅ Goal reached!' : `${8 - water} more to go`}
        </p>
      </div>

      {/* Sleep check-in */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-label">
          <RiMoonFill size={14} style={{ color: '#a78bfa', verticalAlign: -2 }} /> Sleep Quality
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '4px 0 8px' }}>
          How was last night's sleep?
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setSleep(n)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: `1.5px solid ${n <= sleep ? '#a78bfa' : 'var(--border)'}`,
                background: n <= sleep ? 'rgba(167,139,250,0.15)' : 'var(--bg-elevated)',
                cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s'
              }}
            >
              🌙
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '6px 0 0', textAlign: 'center' }}>
          {sleep === 0 ? 'Tap to rate' : sleep <= 2 ? 'Try to improve tonight' : sleep <= 4 ? 'Solid rest!' : 'Excellent recovery!'}
        </p>
      </div>

      {/* Recovery tip */}
      <div
        className="card"
        onClick={() => setTipIndex((tipIndex + 1) % REST_DAY_TIPS.length)}
        style={{ cursor: 'pointer', marginBottom: 12 }}
      >
        <div className="card-label">💡 Recovery Tip</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>{currentTip.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{currentTip.title}</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {currentTip.desc}
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '10px 0 0', textAlign: 'center' }}>
          Tap for next tip →
        </p>
      </div>

    </div>
  )
}
