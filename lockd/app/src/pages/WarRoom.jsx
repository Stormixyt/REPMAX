import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Copy, LogOut, Check } from 'lucide-react'
import { format } from 'date-fns'

export default function WarRoom() {
  const { roomId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [members, setMembers] = useState([])
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { loadRoom() }, [roomId])

  async function loadRoom() {
    if (!roomId) return

    const [{ data: roomData }, { data: memberData }] = await Promise.all([
      supabase.from('lockd_war_rooms').select('*').eq('id', roomId).single(),
      supabase.from('lockd_war_room_members')
        .select('user_id, lockd_profiles(id, username, display_name, avatar_url, current_streak)')
        .eq('room_id', roomId),
    ])

    setRoom(roomData)
    const memberProfiles = memberData?.map(m => m.lockd_profiles).filter(Boolean) || []
    setMembers(memberProfiles)

    const memberIds = memberProfiles.map(m => m.id)
    if (memberIds.length > 0) {
      const { data: proofData } = await supabase
        .from('lockd_proofs')
        .select('*, lockd_tasks(emoji, title)')
        .in('user_id', memberIds)
        .eq('proof_date', today)
        .order('created_at', { ascending: false })

      setFeed(proofData || [])
    }

    setLoading(false)
  }

  async function copyCode() {
    if (!room?.code) return
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function leaveRoom() {
    await supabase
      .from('lockd_war_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)
    navigate('/war-rooms', { replace: true })
  }

  if (loading) return <div className="loading-spinner" />
  if (!room) return <div className="page"><p>Room not found.</p></div>

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link to="/war-rooms" style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-elevated)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ArrowLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>{room.name}</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{members.length}/{room.max_members} members</p>
        </div>
        <button onClick={copyCode} className="btn btn-outline btn-small" style={{ gap: 6 }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {room.code}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
        {members.map(m => {
          const memberProofs = feed.filter(f => f.user_id === m.id)
          return (
            <div key={m.id} style={{
              minWidth: 80,
              textAlign: 'center',
              padding: '12px 8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              flexShrink: 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px',
                fontSize: '0.75rem', fontWeight: 700,
                border: memberProofs.length > 0 ? '2px solid var(--success)' : '2px solid var(--border)',
              }}>
                {(m.display_name || m.username || '?')[0].toUpperCase()}
              </div>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>
                {m.username || 'anon'}
              </p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                🔥 {m.current_streak || 0}
              </p>
            </div>
          )
        })}
      </div>

      <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 12 }}>Today's Proof Feed</p>

      {feed.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 20px' }}>
          <div className="emoji">👀</div>
          <h3>No proofs yet today</h3>
          <p>be the first to prove yourself</p>
        </div>
      ) : (
        feed.map(proof => (
          <div key={proof.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {proof.photo_url && (
              <img src={proof.photo_url} alt="" style={{
                width: 56, height: 56, borderRadius: 10, objectFit: 'cover',
                border: '1px solid var(--border)',
              }} />
            )}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {proof.lockd_tasks?.emoji} {proof.lockd_tasks?.title}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {format(new Date(proof.created_at), 'h:mm a')}
              </p>
            </div>
          </div>
        ))
      )}

      <button
        onClick={leaveRoom}
        className="btn btn-ghost"
        style={{ marginTop: 24, color: 'var(--danger)', justifyContent: 'center' }}
      >
        <LogOut size={16} /> Leave Room
      </button>
    </div>
  )
}
