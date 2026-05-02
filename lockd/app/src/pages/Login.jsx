import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: username } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__glow auth-screen__glow--top" />
      <div className="auth-screen__glow auth-screen__glow--bottom" />

      <div className="auth-card stagger-item">
        <div className="auth-badge">
          <span className="auth-badge__dot" />
          Proof-first accountability
        </div>

        <h1 className="auth-brand">
          lockd<span className="auth-brand__dot" />
        </h1>

        <p className="auth-copy">
          {mode === 'login'
            ? 'Welcome back. Show up, post proof, keep the streak alive.'
            : 'Create your account. Then set the daily rules you are not allowed to break.'}
        </p>

        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-switch__button${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => { setMode('login'); setError(null) }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`auth-switch__button${mode === 'signup' ? ' is-active' : ''}`}
            onClick={() => { setMode('signup'); setError(null) }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack-md">
          {mode === 'signup' && (
            <div className="field-group">
              <label className="input-label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="your handle"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
              />
            </div>
          )}

          <div className="field-group">
            <label className="input-label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="field-group">
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className="status-pill status-pill--danger" style={{ justifyContent: 'center', padding: '12px 14px' }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Locking in...' : mode === 'login' ? 'Lock In' : 'Create Account'}
          </button>
        </form>

        <div className="glass-row" style={{ marginTop: 16, marginBottom: 16 }}>
          <span className="mini-pill">📸 Proof required</span>
          <span className="mini-pill">🔥 Streak tracked</span>
          <span className="mini-pill">⚔️ Squad pressure</span>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-3)' }}>
          {mode === 'login' ? "don't have an account? " : 'already locked in? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            style={{
              background: 'none',
              color: 'var(--text)',
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {mode === 'login' ? 'sign up' : 'log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
