import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const ERROR_MAP = {
  'Invalid login credentials': 'Wrong email or password',
  'User already registered': 'Account already exists',
  'Password should be at least 6 characters': 'Password must be at least 8 characters'
}

function cleanError(msg) {
  return ERROR_MAP[msg] ?? msg
}

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function LogoMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="#a78bfa" strokeWidth="2" />
      <polygon points="16,13 16,27 30,20" fill="#a78bfa" />
      <line x1="6" y1="14" x2="10" y2="14" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="20" x2="10" y2="20" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="26" x2="10" y2="26" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

const inputBase = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: '12px 16px',
  color: 'white',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box'
}

const inputError = { ...inputBase, borderColor: '#ef4444' }

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ color: '#999', fontSize: 13, fontWeight: 500 }}>{label}</label>
      {children}
      {error && <span style={{ color: '#ef4444', fontSize: 12 }}>{error}</span>}
    </div>
  )
}

export default function Auth({ onSuccess }) {
  const [mode, setMode] = useState('signin')
  const [showSuccess, setShowSuccess] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { signUp, signIn } = useAuth()

  function validate() {
    const errs = {}
    if (mode === 'signup' && displayName.trim().length < 2) {
      errs.displayName = 'Name must be at least 2 characters'
    }
    if (!email.includes('@') || !email.includes('.')) {
      errs.email = 'Enter a valid email address'
    }
    if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    }
    if (mode === 'signup' && password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setApiError(null)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      let result
      if (mode === 'signup') {
        result = await signUp(email, password, displayName.trim())
        if (result.success) {
          setShowSuccess(true)
          return
        }
      } else {
        result = await signIn(email, password)
        if (result.success) {
          onSuccess()
          return
        }
      }
      if (!result.success) {
        setApiError(cleanError(result.error))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    await window.electron.invoke('set-local-only', true)
    onSuccess()
  }

  function switchMode(m) {
    setMode(m)
    setFieldErrors({})
    setApiError(null)
    setShowSuccess(false)
  }

  if (showSuccess) {
    return (
      <div style={{ background: '#0a0a0a', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 40, width: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Check your email
          </h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
            Confirm your account, then sign in.
          </p>
          <button
            onClick={() => switchMode('signin')}
            style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0a0a0a', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 40, width: 400 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <LogoMark />
          <span style={{ fontSize: 20 }}>
            <span style={{ fontWeight: 600, color: 'white' }}>replay</span>
            <span style={{ fontWeight: 300, color: '#a78bfa' }}>flow</span>
          </span>
        </div>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {mode === 'signup' && (
            <Field label="Your name" error={fieldErrors.displayName}>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Alex Chen"
                style={fieldErrors.displayName ? inputError : inputBase}
                onFocus={e => { if (!fieldErrors.displayName) e.target.style.borderColor = '#a78bfa' }}
                onBlur={e => { if (!fieldErrors.displayName) e.target.style.borderColor = '#2a2a2a' }}
              />
            </Field>
          )}

          <Field label="Email" error={fieldErrors.email}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={fieldErrors.email ? inputError : inputBase}
              onFocus={e => { if (!fieldErrors.email) e.target.style.borderColor = '#a78bfa' }}
              onBlur={e => { if (!fieldErrors.email) e.target.style.borderColor = '#2a2a2a' }}
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={{ ...(fieldErrors.password ? inputError : inputBase), paddingRight: 44 }}
                onFocus={e => { if (!fieldErrors.password) e.target.style.borderColor = '#a78bfa' }}
                onBlur={e => { if (!fieldErrors.password) e.target.style.borderColor = '#2a2a2a' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </Field>

          {mode === 'signup' && (
            <Field label="Confirm password" error={fieldErrors.confirmPassword}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  style={{ ...(fieldErrors.confirmPassword ? inputError : inputBase), paddingRight: 44 }}
                  onFocus={e => { if (!fieldErrors.confirmPassword) e.target.style.borderColor = '#a78bfa' }}
                  onBlur={e => { if (!fieldErrors.confirmPassword) e.target.style.borderColor = '#2a2a2a' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </Field>
          )}

          {apiError && (
            <div style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#a78bfa',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              height: 44,
              width: '100%',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#9167f0' }}
            onMouseLeave={e => { if (!loading) e.target.style.background = '#a78bfa' }}
          >
            {loading && <Spinner />}
            {loading
              ? mode === 'signup' ? 'Creating account…' : 'Signing in…'
              : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Mode toggle */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#555' }}>
          {mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => switchMode('signup')} style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => switchMode('signin')} style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Sign in
              </button>
            </>
          )}
        </p>

        {/* Divider + skip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: '#222' }} />
          <span style={{ color: '#444', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#222' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleSkip}
            style={{ color: '#888', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer', fontSize: 13, padding: '10px 20px', width: '100%', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
          >
            Continue without account
          </button>
          <p style={{ color: '#444', fontSize: 11, marginTop: 6 }}>Free tier · recordings saved locally</p>
        </div>
      </div>
    </div>
  )
}
