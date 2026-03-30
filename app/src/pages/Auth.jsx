import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Enter your name'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
        const { error } = await signUp(email, password, name.trim())
        if (error) throw error
      } else {
        const { error } = await signIn(email, password)
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

        {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

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
      </form>
    </div>
  )
}
