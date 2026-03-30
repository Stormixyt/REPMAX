import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiFlashlightFill, RiMoonClearFill, RiTrophyFill, RiMedalFill, RiArrowRightLine, RiVipCrownFill, RiNotification3Fill, RiSwordFill } from '@remixicon/react'
import ProBadge from '../components/ProBadge'

export default function Dashboard() {
  const { user, profile, isPro } = useAuth()
  const navigate = useNavigate()
  const [program, setProgram] = useState(null)
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [recentPRs, setRecentPRs] = useState([])
  const [upcomingInvites, setUpcomingInvites] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [stats, setStats] = useState({ total: 0, streak: 0, volume: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      const [progRes, prsRes, workoutsRes, invitesRes, notifsRes] = await Promise.all([
        supabase.from('programs').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(3),
        supabase.from('workouts').select('completed_at, total_volume').eq('user_id', user.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('training_invites').select('*, sender:sender_id(display_name)').eq('receiver_id', user.id).eq('status', 'accepted').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(3),
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

      setRecentPRs(prsRes.data || [])
      setUpcomingInvites(invitesRes.data || [])
      setUnreadNotifs(notifsRes.count || 0)

      if (workoutsRes.data) {
        const totalVol = workoutsRes.data.reduce((s, w) => s + (w.total_volume || 0), 0)
        setStats({ total: workoutsRes.data.length, streak: profile?.current_streak || 0, volume: Math.round(totalVol) })
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
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

  const greeting = getGreeting()
  const firstName = profile?.display_name?.split(' ')[0] || 'Athlete'
  const unit = profile?.units || 'lbs'

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
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="page-greeting">{greeting}</p>
            <h1 className="page-title">{firstName} {isPro && <ProBadge size="md" />}</h1>
          </div>
          <button className="notif-badge" onClick={() => navigate('/notifications')}>
            <RiNotification3Fill size={20} />
            {unreadNotifs > 0 && <span className="notif-count">{unreadNotifs}</span>}
          </button>
        </div>
      </div>

      {/* Upcoming Training Sessions */}
      {upcomingInvites.length > 0 && (
        <div className="card card-invite-preview" style={{ marginBottom: 12 }} onClick={() => navigate('/social')}>
          <RiSwordFill size={18} className="accent-icon" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Upcoming: {upcomingInvites[0].title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              with {upcomingInvites[0].sender?.display_name} · {new Date(upcomingInvites[0].scheduled_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <RiArrowRightLine size={18} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      )}

      {/* PRO Upsell Banner (for free users) */}
      {!isPro && stats.total >= 3 && (
        <div className="card card-pro-upsell" style={{ marginBottom: 12 }} onClick={() => navigate('/subscribe')}>
          <RiVipCrownFill size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Unlock PRO</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>AI Coach, unlimited friends, advanced analytics</div>
          </div>
          <RiArrowRightLine size={18} />
        </div>
      )}

      {/* Today's Workout */}
      {todayWorkout ? (
        <div className="card card-accent" style={{ marginBottom: 16 }}>
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
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', paddingTop: 8 }}>
                +{todayWorkout.exercises.length - 3} more exercises
              </p>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={startWorkout}>
            <RiFlashlightFill size={18} /> Start Workout
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <RiMoonClearFill size={36} className="empty-icon" style={{ marginBottom: 12 }} />
          <div className="card-title">Rest Day</div>
          <div className="card-subtitle">Recovery is where the gains happen. Come back tomorrow ready to crush it.</div>
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
          <div className="stat-desc">{unit.charAt(0).toUpperCase() + unit.slice(1)} Lifted</div>
        </div>
      </div>

      {/* Current Program */}
      {program && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">Current Program</div>
          <div className="card-title">{program.name}</div>
          <div className="card-subtitle">
            Week {program.current_week || 1} of {program.total_weeks || 4} · {program.split_type?.replace('_', '/').toUpperCase()}
          </div>
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${((program.current_week || 1) / (program.total_weeks || 4)) * 100}%`,
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.5s ease'
            }} />
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
