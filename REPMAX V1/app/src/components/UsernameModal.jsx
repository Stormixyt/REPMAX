import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { RiCheckFill, RiCloseLine, RiAtLine, RiLoader4Line } from '@remixicon/react'

export default function UsernameModal({ onComplete }) {
  const { user, updateProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  function handleChange(val) {
    // Enforce: lowercase, alphanumeric + underscores, max 15 chars
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15)
    setUsername(cleaned)

    if (!cleaned || cleaned.length < 2) {
      setStatus(cleaned.length === 1 ? 'invalid' : 'idle')
      return
    }

    setStatus('checking')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkAvailability(cleaned), 400)
  }

  async function checkAvailability(name) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', name)
      .neq('id', user.id)
      .limit(1)

    if (data && data.length > 0) {
      setStatus('taken')
    } else {
      setStatus('available')
    }
  }

  async function submit() {
    if (status !== 'available' || !username || username.length < 2) return
    setSaving(true)
    const { error } = await updateProfile({ username })
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        setStatus('taken')
      }
      setSaving(false)
      return
    }
    onComplete?.()
  }

  const statusConfig = {
    idle: { color: 'var(--text-tertiary)', text: '' },
    checking: { color: 'var(--text-tertiary)', text: 'Checking...' },
    available: { color: '#4ade80', text: 'Available!' },
    taken: { color: '#f87171', text: 'Already taken' },
    invalid: { color: '#fbbf24', text: 'Min 2 characters' }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 24,
        border: '1px solid var(--border)', padding: 32,
        width: '100%', maxWidth: 380,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--accent)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16
          }}>
            <RiAtLine size={28} color="var(--text-on-accent)" />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: '1.3rem', margin: '0 0 8px'
          }}>Choose your username</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            This is how friends will find you.<br />
            Lowercase letters, numbers & underscores only.
          </p>
        </div>

        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'var(--bg-elevated)', borderRadius: 14,
          border: `2px solid ${status === 'available' ? '#4ade80' : status === 'taken' ? '#f87171' : 'var(--border)'}`,
          padding: '0 14px', marginBottom: 8,
          transition: 'border-color 0.2s ease'
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.05rem', marginRight: 2 }}>@</span>
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={e => handleChange(e.target.value)}
            placeholder="your_name"
            maxLength={15}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600,
              padding: '14px 0', fontFamily: 'var(--font-mono, monospace)'
            }}
          />
          <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {status === 'checking' && <RiLoader4Line size={18} className="spin" style={{ color: 'var(--text-tertiary)' }} />}
            {status === 'available' && <RiCheckFill size={18} style={{ color: '#4ade80' }} />}
            {status === 'taken' && <RiCloseLine size={18} style={{ color: '#f87171' }} />}
          </div>
        </div>

        {/* Status text */}
        <div style={{
          fontSize: '0.78rem', fontWeight: 600, minHeight: 20,
          color: statusConfig[status]?.color, marginBottom: 20,
          paddingLeft: 4, transition: 'color 0.2s ease'
        }}>
          {statusConfig[status]?.text}
          {username && status !== 'checking' && (
            <span style={{ float: 'right', color: 'var(--text-tertiary)' }}>{username.length}/15</span>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={status !== 'available' || saving}
          style={{
            width: '100%', padding: '14px 0',
            background: status === 'available' ? 'var(--accent)' : 'var(--bg-elevated)',
            color: status === 'available' ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
            border: 'none', borderRadius: 14,
            fontSize: '0.95rem', fontWeight: 700,
            cursor: status === 'available' ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-display)'
          }}
        >
          {saving ? 'Saving...' : 'Claim @' + (username || '...')}
        </button>
      </div>
    </div>
  )
}
