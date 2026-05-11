import { useState, useEffect, useRef } from 'react'

export default function KeystrokeToast() {
  const [visible, setVisible] = useState(false)
  const [keys, setKeys] = useState([])
  const [repeatCount, setRepeatCount] = useState(1)
  const fadeTimer = useRef(null)
  const lastDisplay = useRef('')

  useEffect(() => {
    if (!window.overlay) return

    function handleKeystroke({ keys: k, display: d }) {
      if (d === lastDisplay.current) {
        setRepeatCount((n) => n + 1)
      } else {
        lastDisplay.current = d
        setKeys(k.slice(0, 5))
        setRepeatCount(1)
      }

      setVisible(true)

      if (fadeTimer.current) clearTimeout(fadeTimer.current)
      fadeTimer.current = setTimeout(() => {
        setVisible(false)
        lastDisplay.current = ''
      }, 2000)
    }

    window.overlay.on('keystroke', handleKeystroke)

    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 8}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        borderRadius: 16,
        padding: '8px 14px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease, transform 150ms ease',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        minWidth: 0
      }}
    >
      {keys.map((key, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && (
            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 14 }}>+</span>
          )}
          <span
            style={{
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 6,
              padding: '4px 8px',
              fontFamily: 'monospace',
              fontSize: 14,
              color: '#fff',
              lineHeight: 1
            }}
          >
            {key}
          </span>
        </span>
      ))}
      {repeatCount > 1 && (
        <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 12, marginLeft: 2 }}>
          ×{repeatCount}
        </span>
      )}
    </div>
  )
}
