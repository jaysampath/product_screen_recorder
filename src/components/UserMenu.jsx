import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

export default function UserMenu({ onSignInClick, onUpgradeClick, onSignOut }) {
  const { user, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  if (!user) {
    return (
      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={onSignInClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#aaa',
            fontSize: 13,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <UserIcon />
          <span>Sign in / Sign up</span>
        </button>
      </div>
    )
  }

  const isPro = user.plan === 'pro'

  return (
    <div style={{ padding: '0 12px 12px', position: 'relative' }} ref={menuRef}>
      {/* Dropdown (renders above) */}
      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 12,
          right: 12,
          background: '#1e1e1e',
          border: '1px solid #333',
          borderRadius: 8,
          padding: 4,
          marginBottom: 4,
          zIndex: 50
        }}>
          <button
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderRadius: 6,
              color: '#ccc',
              fontSize: 13,
              cursor: 'default'
            }}
          >
            Account
          </button>
          <div style={{ height: 1, background: '#333', margin: '4px 0' }} />
          <button
            onClick={() => { setDropdownOpen(false); signOut().then(() => onSignOut?.()) }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderRadius: 6,
              color: '#ccc',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Sign out
          </button>
        </div>
      )}

      {/* Main menu item */}
      <div style={{
        padding: '10px 12px',
        background: '#1a1a1a',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: 'white', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </span>
          </div>
          {isPro && (
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 6 }}
            >
              <ChevronDown />
            </button>
          )}
        </div>

        {isPro ? (
          <span style={{ color: '#666', fontSize: 11, paddingLeft: 15 }}>Pro Plan ✨</span>
        ) : (
          <div style={{ paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: '#666', fontSize: 11 }}>Free Plan</span>
            <button
              onClick={onUpgradeClick}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: 11, fontWeight: 500, padding: 0, textAlign: 'left' }}
            >
              Upgrade to Pro →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
