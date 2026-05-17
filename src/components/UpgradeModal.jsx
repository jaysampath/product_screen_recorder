import React, { useEffect } from 'react'

const FEATURES = [
  'Unlimited shareable cloud links',
  'No watermark on exports',
  '10 GB cloud storage',
  'Team recording library',
  'Priority support'
]

export default function UpgradeModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414',
          border: '1px solid #2a2a2a',
          borderRadius: 16,
          width: 420,
          padding: 40,
          position: 'relative'
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#555',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRadius: 6,
            transition: 'color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
          onMouseLeave={e => e.currentTarget.style.color = '#555'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div style={{ marginBottom: 16 }}>
          <svg width="40" height="40" fill="none" stroke="#a78bfa" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>

        {/* Title */}
        <h2 style={{ color: 'white', fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
          Unlock ReplayFlow Pro
        </h2>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          Share recordings with your team and unlock all features.
        </p>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', fontSize: 14 }}>
              <span>✅</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>$24.99 / year</div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>That&apos;s just $2.08/month · cancel anytime</div>
        </div>

        {/* CTA */}
        <button
          onClick={() => window.electron.invoke('open-external', 'https://replayflow.io/upgrade')}
          style={{
            display: 'block',
            width: '100%',
            height: 48,
            background: '#a78bfa',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            marginBottom: 12,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#9167f0'}
          onMouseLeave={e => e.currentTarget.style.background = '#a78bfa'}
        >
          Upgrade Now →
        </button>

        {/* Secondary */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13 }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
