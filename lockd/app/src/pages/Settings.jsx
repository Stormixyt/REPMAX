import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ArrowLeft, LogOut, Trash2 } from 'lucide-react'

export default function Settings() {
  const { user, profile, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  async function save() {
    setSaving(true)
    await supabase
      .from('lockd_profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() })
      .eq('id', user.id)
    await fetchProfile(user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  async function deleteAccount() {
    await supabase.from('lockd_tasks').delete().eq('user_id', user.id)
    await supabase.from('lockd_proofs').delete().eq('user_id', user.id)
    await supabase.from('lockd_pledges').delete().eq('user_id', user.id)
    await supabase.from('lockd_war_room_members').delete().eq('user_id', user.id)
    await supabase.from('lockd_profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-elevated)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <ArrowLeft size={18} color="var(--text)" />
        </button>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Display Name</label>
          <input
            className="input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={30}
          />
        </div>

        <div>
          <label className="input-label">Bio</label>
          <textarea
            className="input"
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            style={{ resize: 'vertical' }}
            placeholder="what drives you?"
          />
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ marginTop: 48 }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Account
        </p>

        <button
          className="btn btn-outline"
          onClick={logout}
          style={{ marginBottom: 8, justifyContent: 'center' }}
        >
          <LogOut size={16} /> Log Out
        </button>

        {!showDelete ? (
          <button
            className="btn btn-ghost"
            onClick={() => setShowDelete(true)}
            style={{ color: 'var(--danger)', justifyContent: 'center' }}
          >
            <Trash2 size={16} /> Delete Account
          </button>
        ) : (
          <div className="card" style={{ borderColor: 'var(--danger)', background: 'rgba(229,72,77,0.05)' }}>
            <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--danger)' }}>
              This will permanently delete all your data.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 12 }}>
              Tasks, proofs, streaks, pledges — everything gone. Cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-small" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-danger btn-small" onClick={deleteAccount}>Delete Everything</button>
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 48 }}>
        lockd. v1.0.0
      </p>
    </div>
  )
}
