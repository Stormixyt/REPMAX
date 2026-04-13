import { useState, useEffect, useRef } from 'react'
import { REST_DAY_TIPS } from '../data/homeExercises'
import RecoveryMoveDemo from './RecoveryMoveDemo'
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDropFill,
  RiMoonFill,
  RiPauseFill,
  RiPlayFill,
} from '@remixicon/react'

const STRETCHES = [
  { id: 'neck-roll', name: 'Neck Roll', duration: 30, cue: 'Move slowly and let your shoulders stay relaxed.' },
  { id: 'shoulder-stretch', name: 'Shoulder Stretch', duration: 30, cue: 'Keep the chest tall and pull just enough to feel it.' },
  { id: 'cat-cow', name: 'Cat-Cow', duration: 30, cue: 'Match the motion to your breathing instead of rushing reps.' },
  { id: 'hip-flexor', name: 'Hip Flexor Stretch', duration: 30, cue: 'Tuck the pelvis first, then glide forward.' },
  { id: 'hamstring', name: 'Hamstring Stretch', duration: 30, cue: 'Reach long through the spine before folding deeper.' },
]

export default function RestDayHub() {
  const [water, setWater] = useState(0)
  const [sleep, setSleep] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [stretchActive, setStretchActive] = useState(false)
  const [stretchIndex, setStretchIndex] = useState(0)
  const [timer, setTimer] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    setTipIndex(new Date().getDate() % REST_DAY_TIPS.length)
  }, [])

  useEffect(() => {
    if (!stretchActive) {
      window.clearInterval(intervalRef.current)
      return undefined
    }

    intervalRef.current = window.setInterval(() => {
      setTimer((currentTimer) => {
        const activeStretch = STRETCHES[stretchIndex]
        if (!activeStretch) return 0

        if (currentTimer >= activeStretch.duration) {
          if (stretchIndex < STRETCHES.length - 1) {
            setStretchIndex((currentIndex) => currentIndex + 1)
            return 0
          }

          setStretchActive(false)
          return 0
        }

        return currentTimer + 1
      })
    }, 1000)

    return () => window.clearInterval(intervalRef.current)
  }, [stretchActive, stretchIndex])

  const currentTip = REST_DAY_TIPS[tipIndex]
  const currentStretch = STRETCHES[stretchIndex]
  const remainingSeconds = Math.max(0, currentStretch.duration - timer)
  const stretchProgress = currentStretch.duration > 0 ? (timer / currentStretch.duration) * 100 : 0

  function startStretchFlow() {
    setStretchIndex(0)
    setTimer(0)
    setStretchActive(true)
  }

  function pauseStretchFlow() {
    setStretchActive(false)
  }

  function moveStretch(direction) {
    setStretchIndex((currentIndex) => {
      const nextIndex = Math.min(Math.max(currentIndex + direction, 0), STRETCHES.length - 1)
      return nextIndex
    })
    setTimer(0)
  }

  return (
    <div className="recovery-hub">
      <section className="recovery-hero-card">
        <div className="recovery-hero-icon">😴</div>
        <div className="recovery-card-kicker">Recovery & Rest Day</div>
        <h3>Let recovery feel guided, not skipped.</h3>
        <p>Your muscles grow during rest. Use today to restore range, hydrate well, and show up fresher for the next hard session.</p>
      </section>

      <section className="recovery-stretch-shell">
        <div className="recovery-stretch-head">
          <div>
            <div className="recovery-card-kicker">Guided Recovery Flow</div>
            <h3>{currentStretch.name}</h3>
            <p>{currentStretch.cue}</p>
          </div>
          <div className="recovery-countdown-badge">
            <span>{stretchIndex + 1}/{STRETCHES.length}</span>
            <strong>{remainingSeconds}s</strong>
          </div>
        </div>

        <RecoveryMoveDemo variant={currentStretch.id} />

        <div className="recovery-progress-row">
          <div className="recovery-progress-track">
            <div className="recovery-progress-fill" style={{ width: `${Math.min(stretchProgress, 100)}%` }} />
          </div>
          <span>{currentStretch.duration}s each move</span>
        </div>

        <div className="recovery-control-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm recovery-control-btn"
            onClick={() => moveStretch(-1)}
            disabled={stretchIndex === 0}
          >
            <RiArrowLeftSLine size={18} />
            Prev
          </button>
          {!stretchActive ? (
            <button
              type="button"
              className="btn btn-primary recovery-control-btn recovery-control-btn-primary"
              onClick={timer > 0 ? () => setStretchActive(true) : startStretchFlow}
            >
              <RiPlayFill size={18} />
              {timer > 0 ? 'Resume flow' : 'Start flow'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary recovery-control-btn"
              onClick={pauseStretchFlow}
            >
              <RiPauseFill size={18} />
              Pause
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm recovery-control-btn"
            onClick={() => moveStretch(1)}
            disabled={stretchIndex === STRETCHES.length - 1}
          >
            Next
            <RiArrowRightSLine size={18} />
          </button>
        </div>
      </section>

      <div className="recovery-support-grid">
        <section className="recovery-support-card">
          <div className="card-label">
            <RiDropFill size={14} style={{ color: '#60a5fa', verticalAlign: -2 }} /> Hydration Tracker
          </div>
          <div className="recovery-water-grid">
            {Array.from({ length: 8 }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`recovery-water-pill ${index < water ? 'filled' : ''}`}
                onClick={() => setWater(index + 1)}
              >
                {index < water ? '💧' : index + 1}
              </button>
            ))}
          </div>
          <p className="recovery-support-copy">
            {water}/8 glasses {water >= 8 ? '· goal reached' : `· ${8 - water} more to go`}
          </p>
        </section>

        <section className="recovery-support-card">
          <div className="card-label">
            <RiMoonFill size={14} style={{ color: '#a78bfa', verticalAlign: -2 }} /> Sleep Quality
          </div>
          <p className="recovery-support-copy">How did last night set up your recovery?</p>
          <div className="recovery-sleep-grid">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`recovery-sleep-pill ${value <= sleep ? 'active' : ''}`}
                onClick={() => setSleep(value)}
              >
                🌙
              </button>
            ))}
          </div>
          <p className="recovery-support-copy">
            {sleep === 0 ? 'Tap to rate' : sleep <= 2 ? 'Recovery still needs help tonight.' : sleep <= 4 ? 'Solid base for the next session.' : 'Excellent recovery signal.'}
          </p>
        </section>
      </div>

      <section
        className="recovery-tip-card"
        onClick={() => setTipIndex((current) => (current + 1) % REST_DAY_TIPS.length)}
      >
        <div className="recovery-tip-icon">{currentTip.icon}</div>
        <div>
          <div className="recovery-card-kicker">Recovery Tip</div>
          <h3>{currentTip.title}</h3>
          <p>{currentTip.desc}</p>
        </div>
      </section>
    </div>
  )
}
