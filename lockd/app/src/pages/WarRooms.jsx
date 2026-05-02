import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, LogIn, Users, ChevronRight } from 'lucide-react'

export default function WarRooms() {
  const { user, isPro } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => { loadRooms() }, [user])

  async function loadRooms() {
    if (!user) return
    const { data: memberships } = await supabase
      .from('lockd_war_room_members')
      .select('room_id, lockd_war_rooms(*)')
      .eq('user_id', user.id)

    setRooms(memberships?.map(m => m.lockd_war_rooms).filter(Boolean) || [])
    setLoading(false)
  }

  async function createRoom() {
    if (!roomName.trim()) return
    setError(null)

    const { data: room, error: err } = await supabase
      .from('lockd_war_rooms')
      .insert({ name: roomName.trim(), created_by: user.id })
      .select()
      .single()

    if (err) { setError(err.message); return }

    await supabase.from('lockd_war_room_members').insert({
      room_id: room.id,
      user_id: user.id,
    })

    setRoomName('')
    setShowCreate(false)
    await loadRooms()
    navigate(`/war-rooms/${room.id}`)
  }

  async function joinRoom() {
    if (!joinCode.trim()) return
    setError(null)

    const { data: room } = await supabase
      .from('lockd_war_rooms')
      .select('*')
      .eq('code', joinCode.trim().toUpperCase())
      .single()

    if (!room) { setError('room not found. check the code.'); return }

    const { data: members } = await supabase
      .from('lockd_war_room_members')
      .select('id')
      .eq('room_id', room.id)

    if (members && members.length >= room.max_members) {
      setError('room is full.')
      return
    }

    const { error: joinErr } = await supabase
      .from('lockd_war_room_members')
      .insert({ room_id: room.id, user_id: user.id })

    if (joinErr) {
      if (joinErr.code === '23505') setError("you're already in this room.")
      else setError(joinErr.message)
      return
    }

    setJoinCode('')
    setShowJoin(false)
    await loadRooms()
    navigate(`/war-rooms/${room.id}`)
  }

  if (loading) return <div className="loading-spinner" />

  if (!isPro) {
    return (
      <div className="page">
        <div className="empty-state stagger-item" style={{ paddingTop: 80 }}>
          <div className="emoji">🔒</div>
          <h3>War Rooms are Pro</h3>
          <p>Upgrade to join squads, share proof in real time, and keep pressure on every day.</p>
          <Link to="/settings" className="btn btn-primary btn-small" style={{ marginTop: 20, width: 'auto' }}>
            Upgrade
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="hero-surface stagger-item">
        <p className="page-kicker">Squad accountability</p>
        <div className="page-header page-header--compact">
          <div>
            <h1 className="page-title">War Rooms</h1>
            <p className="page-subtitle">
              Build a room with people who notice when you go missing and celebrate when you show up.
            </p>
          </div>
          <div className="streak-badge">⚔️ {rooms.length} active</div>
        </div>

        {!showCreate && !showJoin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowCreate(true); setShowJoin(false) }}>
              <Plus size={18} /> Create
            </button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowJoin(true); setShowCreate(false) }}>
              <LogIn size={18} /> Join
            </button>
          </div>
        )}
      </section>

      {rooms.length === 0 && !showCreate && !showJoin && (
        <div className="empty-state stagger-item" style={{ animationDelay: '90ms' }}>
          <div className="emoji">⚔️</div>
          <h3>No squads yet</h3>
          <p>Create a war room or join one with a code to start tracking together.</p>
        </div>
      )}

      {rooms.map((room, index) => (
        <Link
          key={room.id}
          to={`/war-rooms/${room.id}`}
          className="card stagger-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textDecoration: 'none',
            animationDelay: `${90 + index * 70}ms`,
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 16,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.1), rgba(255,141,87,0.12))', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)',
          }}>
            <Users size={20} color="var(--text)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '0.98rem' }}>{room.name}</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Invite code: {room.code}</p>
          </div>
          <ChevronRight size={18} color="var(--text-3)" />
        </Link>
      ))}

      {showCreate && (
        <div className="card stagger-item" style={{ marginTop: 12 }}>
          <div className="section-title-row">
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.98rem' }}>Create War Room</p>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Start a private squad and invite people with the auto-generated room code.
              </p>
            </div>
          </div>
          <input
            className="input"
            placeholder="room name..."
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createRoom()}
            maxLength={30}
            autoFocus
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-outline btn-small" onClick={() => { setShowCreate(false); setError(null) }}>Cancel</button>
            <button className="btn btn-primary btn-small" onClick={createRoom}>Create</button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="card stagger-item" style={{ marginTop: 12 }}>
          <div className="section-title-row">
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.98rem' }}>Join War Room</p>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Paste the 6-letter invite code and step into the room.
              </p>
            </div>
          </div>
          <input
            className="input"
            placeholder="6-letter code..."
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            maxLength={6}
            autoFocus
            style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-outline btn-small" onClick={() => { setShowJoin(false); setError(null) }}>Cancel</button>
            <button className="btn btn-primary btn-small" onClick={joinRoom}>Join</button>
          </div>
        </div>
      )}
    </div>
  )
}
