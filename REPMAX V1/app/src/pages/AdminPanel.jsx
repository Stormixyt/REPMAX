import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiArrowLeftLine, RiDashboardFill, RiTeamFill, RiVipCrownFill, RiCheckFill, RiCloseLine, RiSearchLine, RiRefreshLine, RiBarChart2Fill, RiTimerFlashFill, RiFireFill, RiTrophyFill, RiRocketFill, RiLoader4Fill, RiShieldCheckFill } from '@remixicon/react'

export default function AdminPanel() {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [requests, setRequests] = useState([])
  const [requestsError, setRequestsError] = useState('')
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (isAdmin) loadAll()
    return () => { mounted.current = false }
  }, [isAdmin])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadRequests(), loadUsers()])
    if (mounted.current) setLoading(false)
  }

  async function loadStats() {
    const [profilesRes, workoutsRes, prsRes, recentWorkouts] = await Promise.all([
      supabase.from('profiles').select('id, created_at, subscription_tier, updated_at, current_streak', { count: 'exact' }),
      supabase.from('workouts').select('id, completed_at, total_volume, duration_seconds, created_at', { count: 'exact' }).not('completed_at', 'is', null),
      supabase.from('personal_records').select('id', { count: 'exact' }),
      supabase.from('workouts').select('completed_at').not('completed_at', 'is', null).gte('completed_at', new Date(Date.now() - 7 * 86400000).toISOString())
    ])

    const profiles = profilesRes.data || []
    const workouts = workoutsRes.data || []
    const now = new Date()
    const weekAgo = new Date(now - 7 * 86400000)

    const newUsers7d = profiles.filter(p => new Date(p.created_at) > weekAgo).length
    const activeUsers7d = profiles.filter(p => p.updated_at && new Date(p.updated_at) > weekAgo).length
    const proUsers = profiles.filter(p => p.subscription_tier === 'pro').length
    const ultraUsers = profiles.filter(p => p.subscription_tier === 'ultra').length
    const totalVolume = workouts.reduce((s, w) => s + (w.total_volume || 0), 0)
    const avgDuration = workouts.length > 0
      ? Math.round(workouts.reduce((s, w) => s + (w.duration_seconds || 0), 0) / workouts.length / 60)
      : 0
    const topStreak = Math.max(0, ...profiles.map(p => p.current_streak || 0))

    // Daily signups last 14 days
    const dailySignups = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const count = profiles.filter(p => p.created_at?.split('T')[0] === dateStr).length
      dailySignups.push({ date: dateStr, count, label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) })
    }

    if (!mounted.current) return
    setStats({
      totalUsers: profiles.length,
      newUsers7d,
      activeUsers7d,
      totalWorkouts: workouts.length,
      workouts7d: (recentWorkouts.data || []).length,
      proUsers,
      ultraUsers,
      totalVolume,
      avgDuration,
      totalPRs: prsRes.count || 0,
      topStreak,
      dailySignups
    })
  }

  async function loadRequests() {
    setRequestsError('')

    const { data: requestRows, error: requestError } = await supabase
      .from('subscription_requests')
      .select('id, user_id, requested_tier, status, reason, reviewed_by, reviewed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!mounted.current) return

    if (requestError) {
      console.warn('[REPMAX] Failed to load subscription requests:', requestError)
      setRequests([])
      setRequestsError(requestError.message || 'Could not load requests')
      return
    }

    const baseRows = requestRows || []
    if (baseRows.length === 0) {
      setRequests([])
      return
    }

    const userIds = Array.from(new Set(baseRows.map(r => r.user_id).filter(Boolean)))
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, username, created_at, current_streak')
      .in('id', userIds)

    if (!mounted.current) return

    if (profileError) {
      console.warn('[REPMAX] Failed to load profiles for requests:', profileError)
    }

    const profileById = new Map((profileRows || []).map(p => [p.id, p]))
    const enriched = baseRows.map((row) => ({
      ...row,
      profiles: profileById.get(row.user_id) || null
    }))

    setRequests(enriched)
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (mounted.current) setUsers(data || [])
  }

  async function approveRequest(request) {
    await supabase.from('subscription_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', request.id)

    await supabase.from('profiles').update({
      subscription_tier: request.requested_tier,
      pro_request_status: 'approved',
      pro_approved_by: user.id
    }).eq('id', request.user_id)

    showToast(`✅ ${request.requested_tier.toUpperCase()} approved!`)
    await loadRequests()
    await loadUsers()
    await loadStats()
  }

  async function rejectRequest() {
    if (!rejectModal) return
    await supabase.from('subscription_requests').update({
      status: 'rejected',
      reason: rejectReason || 'Not approved at this time.',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', rejectModal.id)

    await supabase.from('profiles').update({
      pro_request_status: 'rejected',
      pro_rejection_reason: rejectReason || 'Not approved at this time.'
    }).eq('id', rejectModal.user_id)

    setRejectModal(null)
    setRejectReason('')
    showToast('Request rejected')
    await loadRequests()
  }

  if (!isAdmin) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 100 }}>
        <RiShieldCheckFill size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You don't have permission to view this page.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/app')}>Go Home</button>
      </div>
    )
  }

  const filteredUsers = users.filter(u =>
    !search || (u.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  )

  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <div className="page">
      <button onClick={() => navigate(-1)} className="back-btn">
        <RiArrowLeftLine size={20} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RiShieldCheckFill size={24} style={{ color: 'var(--accent)' }} />
          Admin <span className="accent">Panel</span>
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 4 }}>
        {[
          { id: 'dashboard', icon: RiDashboardFill, label: 'Stats' },
          { id: 'requests', icon: RiVipCrownFill, label: `Requests${pendingRequests.length ? ` (${pendingRequests.length})` : ''}` },
          { id: 'users', icon: RiTeamFill, label: 'Users' },
        ].map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : ''}`}
            style={{ flex: 1, background: tab === t.id ? '' : 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.78rem' }}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <RiLoader4Fill size={32} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {/* ===== DASHBOARD TAB ===== */}
          {tab === 'dashboard' && stats && (
            <>
              <div className="stat-row">
                <div className="stat-box">
                  <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.totalUsers}</div>
                  <div className="stat-desc">Total Users</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ color: '#3b82f6' }}>+{stats.newUsers7d}</div>
                  <div className="stat-desc">New (7d)</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.activeUsers7d}</div>
                  <div className="stat-desc">Active (7d)</div>
                </div>
              </div>

              <div className="stat-row" style={{ marginTop: 8 }}>
                <div className="stat-box">
                  <div className="stat-value">{stats.totalWorkouts}</div>
                  <div className="stat-desc">Workouts</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.workouts7d}</div>
                  <div className="stat-desc">This Week</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.avgDuration}m</div>
                  <div className="stat-desc">Avg Session</div>
                </div>
              </div>

              {/* Subscription stats */}
              <div className="card" style={{ marginTop: 16, marginBottom: 12 }}>
                <div className="card-label">Subscriptions</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: 'rgba(204,255,0,0.08)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>{stats.proUsers}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>PRO</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,42,133,0.08)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ff2a85' }}>{stats.ultraUsers}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>ULTRA</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{stats.totalUsers - stats.proUsers - stats.ultraUsers}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Free</div>
                  </div>
                </div>
              </div>

              {/* Growth chart */}
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-label">Signups — Last 14 Days</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 12 }}>
                  {stats.dailySignups.map((d, i) => {
                    const max = Math.max(1, ...stats.dailySignups.map(x => x.count))
                    const h = (d.count / max) * 100
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: `${h}%`, background: 'linear-gradient(to top, var(--accent), rgba(204,255,0,0.3))', borderRadius: '3px 3px 0 0', minHeight: d.count > 0 ? 4 : 1, transition: 'height 0.4s ease' }} />
                        {i % 3 === 0 && <span style={{ fontSize: '0.5rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{d.label.split(' ')[1]}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Extra stats */}
              <div className="stat-row" style={{ marginTop: 8 }}>
                <div className="stat-box">
                  <div className="stat-value">{stats.totalPRs}</div>
                  <div className="stat-desc">Total PRs</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.topStreak}🔥</div>
                  <div className="stat-desc">Top Streak</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.totalVolume > 1000000 ? `${(stats.totalVolume / 1000000).toFixed(1)}M` : stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(0)}k` : stats.totalVolume}</div>
                  <div className="stat-desc">Total Volume</div>
                </div>
              </div>

              <button className="btn btn-secondary btn-full" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={loadAll}>
                <RiRefreshLine size={16} /> Refresh Data
              </button>
            </>
          )}

          {/* ===== REQUESTS TAB ===== */}
          {tab === 'requests' && (
            <>
              {pendingRequests.length > 0 && (
                <div className="card card-accent" style={{ marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>{pendingRequests.length}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending Request{pendingRequests.length !== 1 ? 's' : ''}</div>
                </div>
              )}

              {requestsError ? (
                <div className="empty-state">
                  <div className="empty-emoji">⚠️</div>
                  <h3 className="empty-title">Couldn't load requests</h3>
                  <p className="empty-text">{requestsError}</p>
                  <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={loadRequests}>
                    <RiRefreshLine size={16} /> Retry
                  </button>
                </div>
              ) : requests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-emoji">📭</div>
                  <h3 className="empty-title">No requests yet</h3>
                  <p className="empty-text">Subscription requests will appear here.</p>
                </div>
              ) : (
                requests.map(req => {
                  const isPending = req.status === 'pending'
                  const isApproved = req.status === 'approved'
                  const tierColor = req.requested_tier === 'ultra' ? '#ff2a85' : 'var(--accent)'

                  return (
                    <div key={req.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${isPending ? tierColor : isApproved ? '#22c55e' : '#ef4444'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {req.profiles?.display_name || req.profiles?.username || 'Unknown'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Requesting <span style={{ color: tierColor, fontWeight: 700 }}>{req.requested_tier?.toUpperCase()}</span> · {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '4px 10px', borderRadius: 20,
                          background: isPending ? 'rgba(204,255,0,0.12)' : isApproved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: isPending ? 'var(--accent)' : isApproved ? '#22c55e' : '#ef4444'
                        }}>
                          {req.status}
                        </div>
                      </div>

                      {isPending && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button
                            className="btn btn-sm"
                            style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            onClick={() => approveRequest(req)}
                          >
                            <RiCheckFill size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            onClick={() => setRejectModal(req)}
                          >
                            <RiCloseLine size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}

          {/* ===== USERS TAB ===== */}
          {tab === 'users' && (
            <>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <RiSearchLine size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px 12px 40px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none'
                  }}
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </div>

              {filteredUsers.map(u => (
                <div key={u.id} className="card" style={{ marginBottom: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.display_name || u.username || 'No Name'}
                        {u.subscription_tier === 'ultra' && <span style={{ fontSize: '0.6rem', background: '#ff2a85', color: '#fff', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>ULTRA</span>}
                        {u.subscription_tier === 'pro' && <span style={{ fontSize: '0.6rem', background: 'var(--accent)', color: '#000', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>PRO</span>}
                        {u.is_admin && <span style={{ fontSize: '0.6rem', background: '#8b5cf6', color: '#fff', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>ADMIN</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        @{u.username || '—'} · Joined {new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {u.current_streak || 0}🔥
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>streak</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRejectModal(null) }}>
          <div className="modal">
            <h2 className="modal-title">Reject Request</h2>
            <p className="modal-subtitle" style={{ marginBottom: 12 }}>
              Rejecting {rejectModal.profiles?.display_name || 'user'}'s request for {rejectModal.requested_tier?.toUpperCase()}.
            </p>
            <textarea
              placeholder="Reason (optional)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{
                width: '100%', padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.88rem',
                minHeight: 80, resize: 'vertical', outline: 'none', marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setRejectModal(null); setRejectReason('') }}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={rejectRequest}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast fade-in">{toast}</div>}
    </div>
  )
}
