import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  async function checkWaitlistApproval(emailToCheck) {
    const { data, error } = await supabase
      .from('waitlist')
      .select('approved')
      .eq('email', emailToCheck.toLowerCase().trim())
      .maybeSingle()

    if (error) {
      console.error('Waitlist check failed:', error)
      return false
    }

    // No entry found or not approved
    if (!data) return false
    return data.approved === true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.toLowerCase().trim()

    try {
      // Check waitlist approval first
      const isApproved = await checkWaitlistApproval(cleanEmail)
      if (!isApproved) {
        setError('Your access has not been approved yet. Please join the waitlist and wait for approval.')
        setLoading(false)
        return
      }

      if (mode === 'signup') {
        if (!name.trim()) { setError('Enter your name'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
        const { error } = await signUp(cleanEmail, password, name.trim())
        if (error) throw error
      } else {
        const { error } = await signIn(cleanEmail, password)
        if (error) throw error
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">REPMAX<span className="dot" /></div>
      <p className="auth-tagline">Train smarter. Get stronger.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="input-group">
            <label className="input-label" htmlFor="auth-name">Your name</label>
            <input
              id="auth-name"
              className="input"
              type="text"
              placeholder="What should we call you?"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        <div className="input-group">
          <label className="input-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className={`input ${error ? 'input-error' : ''}`}
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            className={`input ${error ? 'input-error' : ''}`}
            type="password"
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
        </div>

        {error && (
          <div className="auth-error-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : mode === 'signup' ? 'Create Account' : 'Sign In'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account? <button type="button" onClick={() => { setMode('signup'); setError('') }}>Sign up</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => { setMode('login'); setError('') }}>Sign in</button></>
          )}
        </div>

        <p className="auth-waitlist-note">
          Access is invite-only. <a href="/" target="_blank" rel="noopener">Join the waitlist</a> to request access.
        </p>
      </form>
    </div>
  )
}
