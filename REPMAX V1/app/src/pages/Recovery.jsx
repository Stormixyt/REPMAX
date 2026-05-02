import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  RiArrowLeftLine, RiHeartPulseFill, RiMoonClearFill,
  RiDropFill, RiFireFill, RiRunFill, RiZzzFill,
  RiBodyScanFill, RiSparklingFill, RiAlertFill
} from '@remixicon/react'

const SORENESS_OPTIONS = [
  { value: 1, label: 'Fresh', emoji: '💚', color: '#00dc82' },
  { value: 2, label: 'Mild', emoji: '💛', color: '#fbbf24' },
  { value: 3, label: 'Moderate', emoji: '🟠', color: '#f97316' },
  { value: 4, label: 'Heavy', emoji: '🔴', color: '#ef4444' },
  { value: 5, label: 'Wrecked', emoji: '💀', color: '#dc2626' },
]

const MOBILITY_DRILLS = [
  { name: '90/90 Hip Stretch', duration: '60s each side', target: 'Hips' },
  { name: 'Wall Slides', duration: '2×12 reps', target: 'Shoulders' },
  { name: 'Cat-Cow', duration: '10 reps', target: 'Spine' },
  { name: 'World\'s Greatest Stretch', duration: '5 each side', target: 'Full Body' },
  { name: 'Couch Stretch', duration: '60s each side', target: 'Quads/Hip Flexors' },
  { name: 'Dead Hang', duration: '30-45s', target: 'Shoulders/Spine' },
  { name: 'Foam Roll Thoracic', duration: '2 min', target: 'Upper Back' },
  { name: 'Pigeon Stretch', duration: '60s each side', target: 'Glutes' },
]

export default function Recovery() {
  const navigate = useNavigate()
  const { user, profile, isPro, isUltra } = useAuth()
  const [soreness, setSoreness] = useState(0)
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [waterToday, setWaterToday] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecoveryData()
  }, [])

  async function loadRecoveryData() {
    try {
      const [workoutsRes, waterRes] = await Promise.all([
        supabase.from('workouts')
          .select('completed_at, total_volume, duration_seconds, day_name')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(14),
        supabase.from('water_logs')
          .select('glasses')
          .eq('user_id', user.id)
          .gte('date', new Date().toISOString().split('T')[0])
          .maybeSingle()
      ])
      setRecentWorkouts(workoutsRes.data || [])
      setWaterToday(waterRes.data?.glasses || 0)
    } catch {}
    setLoading(false)
  }

  // Compute recovery signals
  const now = Date.now()
  const DAY = 86400000
  const last7 = recentWorkouts.filter(w => now - new Date(w.completed_at).getTime() <= 7 * DAY)
  const last3 = recentWorkouts.filter(w => now - new Date(w.completed_at).getTime() <= 3 * DAY)
  const lastWorkout = recentWorkouts[0]
  const hoursSinceLast = lastWorkout ? (now - new Date(lastWorkout.completed_at).getTime()) / 3600000 : null

  const weeklyVolume = last7.reduce((s, w) => s + (w.total_volume || 0), 0)
  const recentLoad = last3.reduce((s, w) => s + (w.total_volume || 0), 0)
  const avgSessionDuration = last7.length > 0
    ? Math.round(last7.reduce((s, w) => s + (w.duration_seconds || 0), 0) / last7.length / 60)
    : 0

  const trainingTarget = profile?.training_days?.length || 4
  const weeklyFreq = last7.length

  // Recovery score (0-100)
  const timingScore = hoursSinceLast == null ? 50
    : hoursSinceLast >= 24 && hoursSinceLast <= 72 ? 85
    : hoursSinceLast > 72 ? 95
    : Math.max(20, 85 - (24 - hoursSinceLast) * 3)

  const loadScore = weeklyFreq <= trainingTarget ? 80
    : Math.max(30, 80 - (weeklyFreq - trainingTarget) * 12)

  const sorenessScore = soreness === 0 ? 70
    : Math.max(15, 100 - soreness * 18)

  const hydrationScore = waterToday >= 8 ? 90 : Math.max(20, waterToday * 11)

  const recoveryScore = Math.round(
    timingScore * 0.3 + loadScore * 0.25 + sorenessScore * 0.25 + hydrationScore * 0.2
  )

  const recoveryLabel = recoveryScore >= 80 ? 'Fully Recovered'
    : recoveryScore >= 60 ? 'Recovering'
    : recoveryScore >= 40 ? 'Fatigued'
    : 'Overreached'

  const recoveryColor = recoveryScore >= 80 ? '#00dc82'
    : recoveryScore >= 60 ? '#fbbf24'
    : recoveryScore >= 40 ? '#f97316'
    : '#ef4444'

  // Prescription
  const prescription = []
  if (recoveryScore >= 80) {
    prescription.push({ icon: '🟢', text: 'Green light — go hard today if scheduled' })
  } else if (recoveryScore >= 60) {
    prescription.push({ icon: '🟡', text: 'Normal intensity — stick to the plan' })
  } else {
    prescription.push({ icon: '🔴', text: 'Reduce volume by 20-30% today' })
  }
  if (soreness >= 3) prescription.push({ icon: '🧘', text: 'Prioritize mobility work below' })
  if (waterToday < 6) prescription.push({ icon: '💧', text: `Drink ${8 - waterToday} more glasses of water` })
  if (hoursSinceLast !== null && hoursSinceLast < 18) {
    prescription.push({ icon: '😴', text: 'Less than 18h since last session — consider rest' })
  }

  // Pick 4 relevant mobility drills
  const drills = MOBILITY_DRILLS.slice(0, 4)

  if (loading) return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}><RiArrowLeftLine size={22} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Recovery</h1>
      </div>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16, marginBottom: 12 }} />)}
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}><RiArrowLeftLine size={22} /></button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Recovery Autopilot</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Smart recovery signals from your training data
          </p>
        </div>
      </div>

      {/* Recovery Score Ring */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 16, padding: '28px 20px' }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', margin: '0 auto 16px',
          background: `conic-gradient(${recoveryColor} ${recoveryScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: recoveryColor }}>{recoveryScore}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>/ 100</div>
          </div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: recoveryColor, marginBottom: 4 }}>{recoveryLabel}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          Based on training load, timing, soreness, and hydration
        </div>
      </div>

      {/* Signal Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <RiFireFill size={20} color="var(--accent)" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{last7.length}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Sessions (7d)</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <RiMoonClearFill size={20} color="#a78bfa" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
            {hoursSinceLast !== null ? `${Math.round(hoursSinceLast)}h` : '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Since Last</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <RiDropFill size={20} color="#38bdf8" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{waterToday}/8</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Water Today</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <RiRunFill size={20} color="#fb923c" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{avgSessionDuration}m</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Avg Duration</div>
        </div>
      </div>

      {/* Soreness Check-in */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-label"><RiBodyScanFill size={14} style={{ verticalAlign: -2, marginRight: 6 }} />How sore are you?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {SORENESS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSoreness(opt.value)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${soreness === opt.value ? opt.color : 'var(--border)'}`,
                background: soreness === opt.value ? `${opt.color}15` : 'var(--bg-elevated)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{opt.emoji}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: soreness === opt.value ? opt.color : 'var(--text-tertiary)' }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prescription */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-label"><RiSparklingFill size={14} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--accent)' }} />Today's Recovery Prescription</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {prescription.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem', width: 28, textAlign: 'center' }}>{p.icon}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobility Drills */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-label"><RiZzzFill size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Suggested Mobility</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
          {drills.map((drill, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{drill.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{drill.target}</div>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)' }}>{drill.duration}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Load Chart (simple bar visualization) */}
      <div className="card">
        <div className="card-label"><RiHeartPulseFill size={14} style={{ verticalAlign: -2, marginRight: 6 }} />7-Day Load</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginTop: 12 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const dayStart = new Date()
            dayStart.setDate(dayStart.getDate() - (6 - i))
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(dayStart)
            dayEnd.setDate(dayEnd.getDate() + 1)

            const dayVolume = recentWorkouts
              .filter(w => {
                const t = new Date(w.completed_at).getTime()
                return t >= dayStart.getTime() && t < dayEnd.getTime()
              })
              .reduce((s, w) => s + (w.total_volume || 0), 0)

            const maxVol = Math.max(1, ...recentWorkouts.map(w => w.total_volume || 0))
            const height = dayVolume > 0 ? Math.max(8, (dayVolume / maxVol) * 70) : 4
            const dayLabel = dayStart.toLocaleDateString('en', { weekday: 'narrow' })
            const isToday = i === 6

            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height, borderRadius: 6,
                  background: isToday ? 'var(--accent)' : dayVolume > 0 ? 'rgba(204,255,0,0.3)' : 'rgba(255,255,255,0.05)',
                  transition: 'height 0.4s ease'
                }} />
                <span style={{ fontSize: '0.62rem', color: isToday ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 500 }}>
                  {dayLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
