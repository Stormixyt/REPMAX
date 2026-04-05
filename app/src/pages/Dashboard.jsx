import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { shareDNACard } from '../lib/shareDNA'
import { subscribeToPush, showLocalNotification } from '../lib/pushNotifications'
import { RiFlashlightFill, RiMoonClearFill, RiTrophyFill, RiMedalFill, RiArrowRightLine, RiVipCrownFill, RiNotification3Fill, RiSwordFill, RiFireFill, RiWaterFlashFill, RiRunFill, RiScalesFill, RiShareLine, RiSparklingFill, RiStarFill } from '@remixicon/react'
import ProBadge from '../components/ProBadge'

function generateDailyChallenge(profile) {
  const day = new Date().getDate()
  const challenges = [
    { icon: <RiFireFill size={20} />, title: 'Complete today\'s workout', desc: 'Finish every set in your session' },
    { icon: <RiWaterFlashFill size={20} />, title: 'Drink 8 glasses of water', desc: 'Stay hydrated throughout the day' },
    { icon: <RiScalesFill size={20} />, title: `Hit ${profile?.goal === 'hypertrophy' ? '150' : '120'}g protein`, desc: 'Reach your daily protein target' },
    { icon: <RiRunFill size={20} />, title: 'Train under 50 minutes', desc: 'Tight rest times = more gains' },
    { icon: <RiTrophyFill size={20} />, title: 'Beat a previous set', desc: 'Lift heavier or more reps than last time' },
    { icon: <RiFlashlightFill size={20} />, title: 'Start within 30 minutes', desc: 'No procrastination — gym NOW' },
  ]
  return challenges[day % challenges.length]
}

function getAuraLevel(streak) {
  if (streak >= 30) return 'fire'
  if (streak >= 14) return 'high'
  if (streak >= 7) return 'medium'
  if (streak >= 3) return 'low'
  return ''
}

export default function Dashboard() {
  const { user, profile, isPro } = useAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [recentPRs, setRecentPRs] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [stats, setStats] = useState({ total: 0, streak: 0, volume: 0 })
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadDashboard()
    checkNotifPermission()
    return () => { mounted.current = false }
  }, [])

  async function checkNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => setShowNotifPrompt(true), 3000)
    }
  }

  async function enableNotifications() {
    setShowNotifPrompt(false)
    const sub = await subscribeToPush()
    if (sub) showLocalNotification('REPMAX', 'Notifications enabled! 💪')
  }

  async function loadDashboard() {
    try {
      const [progRes, prsRes, workoutsRes, notifsRes] = await Promise.all([
        supabase.from('programs').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(3),
        supabase.from('workouts').select('completed_at, total_volume').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', user.id).eq('read', false)
      ])

      if (progRes.data) {
        setProgram(progRes.data)
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const dayMap = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
        const shortDay = dayMap[today]
        const trainingDays = profile?.training_days || []
        const dayIndex = trainingDays.indexOf(shortDay)
        if (dayIndex !== -1 && progRes.data.program_data?.weeks) {
          const currentWeek = progRes.data.program_data.weeks[(progRes.data.current_week || 1) - 1]
          if (currentWeek?.days?.[dayIndex]) {
            setTodayWorkout({ ...currentWeek.days[dayIndex], weekNumber: progRes.data.current_week || 1 })
          }
        }
      }

      if (!mounted.current) return
      setRecentPRs(prsRes.data || [])
      setUnreadNotifs(notifsRes.count || 0)

      if (workoutsRes.data) {
        const totalVol = workoutsRes.data.reduce((s, w) => s + (w.total_volume || 0), 0)
        setStats({ total: workoutsRes.data.length, streak: profile?.current_streak || 0, volume: Math.round(totalVol) })
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  async function startWorkout() {
    if (!todayWorkout || !program) return
    const { data: workout, error } = await supabase.from('workouts').insert({ user_id: user.id, program_id: program.id, day_name: todayWorkout.day_name, week_number: todayWorkout.weekNumber, started_at: new Date().toISOString() }).select().single()
    if (!error && workout) {
      const setInserts = []
      todayWorkout.exercises?.forEach(ex => {
        for (let i = 1; i <= (ex.sets || 3); i++) {
          setInserts.push({ workout_id: workout.id, exercise_name: ex.name, set_number: i, target_reps: ex.reps || 8, target_weight: ex.weight || 0, completed: false })
        }
      })
      if (setInserts.length > 0) await supabase.from('sets').insert(setInserts)
      navigate(`/workout/${workout.id}`)
    }
  }

  async function handleShareDNA() {
    setSharing(true)
    try {
      await shareDNACard(profile, stats, profile?.theme_color || 'green')
    } catch {}
    setSharing(false)
  }

  const greeting = getGreeting()
  const firstName = profile?.display_name?.split(' ')[0] || 'Athlete'
  const unit = profile?.units || 'kg'
  const challenge = generateDailyChallenge(profile)
  const auraLevel = getAuraLevel(stats.streak)
  const avatarSeed = profile?.avatar_seed || user?.id || 'default'
  const avatarUrl = profile?.image_url || `https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}&backgroundColor=transparent`

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 200, height: 28 }} />
        </div>
        <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 12 }} />
        <div className="stat-row">
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 80, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Notification permission prompt */}
      {showNotifPrompt && (
        <div className="notif-prompt" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RiNotification3Fill size={20} color="var(--text-on-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Enable Notifications</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Get notified when friends message you</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowNotifPrompt(false)}>Later</button>
            <button className="btn btn-sm btn-primary" onClick={enableNotifications}>Enable</button>
          </div>
        </div>
      )}

      {/* Header with Aura Avatar */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`aura-ring ${auraLevel}`} style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={avatarUrl}
                alt="" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-card)' }}
              />
            </div>
            <div>
              <p className="page-greeting">{greeting}</p>
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {firstName} {isPro && <ProBadge size="md" />}
              </h1>
            </div>
          </div>
          <button className="notif-badge" onClick={() => navigate('/notifications')}>
            <RiNotification3Fill size={20} />
            {unreadNotifs > 0 && <span className="notif-count">{unreadNotifs}</span>}
          </button>
        </div>
      </div>

      {/* Daily Challenge */}
      <div className="challenge-card">
        <div className="challenge-icon">{challenge.icon}</div>
        <div className="challenge-text">
          <div className="challenge-title">{challenge.title}</div>
          <div className="challenge-desc">{challenge.desc}</div>
          <div className="challenge-progress">
            <div className="challenge-progress-fill" style={{ width: '0%' }} />
          </div>
        </div>
      </div>

      {/* PRO Promotion — Always visible for free users */}
      {!isPro && (
        <div className="pro-banner" onClick={() => navigate('/subscribe')}>
          <div className="pro-banner-glow" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 32 }}><RiVipCrownFill size={28} color="#ffd700" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>Upgrade to PRO</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI Coach · Custom Themes · Unlimited Friends</div>
            </div>
            <RiArrowRightLine size={20} style={{ color: '#ffd700' }} />
          </div>
        </div>
      )}

      {/* Today's Workout */}
      {todayWorkout ? (
        <div className="card card-accent" style={{ marginBottom: 16, marginTop: !isPro ? 12 : 0 }}>
          <div className="card-label">Today's Workout</div>
          <div className="card-title">{todayWorkout.day_name}</div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.length || 0} exercises · Week {todayWorkout.weekNumber}
            {todayWorkout.target_muscles && ` · ${todayWorkout.target_muscles.join(', ')}`}
          </div>
          <div style={{ marginBottom: 16 }}>
            {todayWorkout.exercises?.slice(0, 3).map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{ex.name}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.8rem' }}>{ex.sets}×{ex.reps}</span>
              </div>
            ))}
            {todayWorkout.exercises?.length > 3 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingTop: 8 }}>+{todayWorkout.exercises.length - 3} more exercises</p>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={startWorkout}>
            <RiFlashlightFill size={18} /> Start Workout
          </button>
        </div>
      ) : (
        <div className="card card-accent" style={{ marginTop: !isPro ? 12 : 0, cursor: 'pointer' }} onClick={() => navigate('/recovery')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-label" style={{ margin: 0, color: 'var(--text-on-accent)', opacity: 0.8 }}>Rest Day</div>
              <h3 style={{ margin: '4px 0 0', fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-on-accent)' }}>Recovery Hub</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-on-accent)', opacity: 0.8 }}>Stretches, hydration & sleep</p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.1)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RiArrowRightLine size={20} style={{ color: 'var(--text-on-accent)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-desc">Workouts</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.streak}</div>
          <div className="stat-desc">Day Streak</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.volume > 1000 ? `${(stats.volume / 1000).toFixed(1)}k` : stats.volume}</div>
          <div className="stat-desc">{unit} Lifted</div>
        </div>
      </div>

      {/* Shareable Workout DNA Card */}
      <div className="dna-card" style={{ marginTop: 16 }}>
        <div className="dna-header">
          <div className={`aura-ring ${auraLevel}`} style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${avatarSeed}`} alt="" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="dna-name">{profile?.display_name || 'Athlete'}</div>
            {isPro && <div className="dna-badge">⭐ PRO</div>}
          </div>
          <button
            onClick={handleShareDNA}
            disabled={sharing}
            className="dna-share-btn"
          >
            {sharing ? <span className="spinner-sm" /> : <><RiShareLine size={16} /> Share</>}
          </button>
        </div>
        <div className="dna-stats">
          <div className="dna-stat">
            <div className="dna-stat-value">{stats.total}</div>
            <div className="dna-stat-label">Sessions</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{stats.streak}</div>
            <div className="dna-stat-label">Streak</div>
          </div>
          <div className="dna-stat">
            <div className="dna-stat-value">{profile?.preferred_split?.replace('_', '/').toUpperCase() || '—'}</div>
            <div className="dna-stat-label">Split</div>
          </div>
        </div>
        <div className="dna-watermark">REPMAX</div>
      </div>

      {/* Current Program */}
      {program && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">Current Program</div>
          <div className="card-title">{program.name}</div>
          <div className="card-subtitle">Week {program.current_week || 1} of {program.total_weeks || 4} · {program.split_type?.replace('_', '/').toUpperCase()}</div>
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${((program.current_week || 1) / (program.total_weeks || 4)) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 className="section-title"><RiTrophyFill size={16} /> Recent PRs</h3>
          {recentPRs.map(pr => (
            <div key={pr.id} className="pr-item">
              <div className="pr-badge"><RiMedalFill size={18} /></div>
              <div className="pr-info">
                <div className="pr-exercise">{pr.exercise_name}</div>
                <div className="pr-details">{pr.weight} {unit} × {pr.reps} reps</div>
              </div>
              <div className="pr-date">{new Date(pr.achieved_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
