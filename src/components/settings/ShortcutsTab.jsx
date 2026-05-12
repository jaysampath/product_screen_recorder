import React, { useState, useEffect } from 'react'

const SHORTCUT_ROWS = [
  { key: 'startStop', label: 'Start / Stop Recording' },
  { key: 'pauseResume', label: 'Pause / Resume' },
  { key: 'discard', label: 'Discard Recording' },
]

const DEFAULTS = {
  startStop: 'CommandOrControl+Shift+R',
  pauseResume: 'CommandOrControl+Shift+P',
  discard: 'CommandOrControl+Shift+D',
}

function formatShortcut(str) {
  if (!str) return '—'
  return str
    .replace('CommandOrControl', 'Ctrl')
    .replace('Control', 'Ctrl')
    .replace('Command', '⌘')
    .split('+')
    .join(' + ')
}

function captureFromEvent(e) {
  e.preventDefault()
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const skip = new Set(['Control', 'Meta', 'Alt', 'Shift'])
  if (!skip.has(e.key)) {
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
    parts.push(key)
  }

  if (parts.length >= 2 || (parts.length === 1 && !['CommandOrControl', 'Alt', 'Shift'].includes(parts[0]))) {
    return parts.join('+')
  }
  return null
}

export default function ShortcutsTab({ settings, setSetting }) {
  const { shortcuts } = settings
  const [editing, setEditing] = useState(null)
  const [conflict, setConflict] = useState(null)

  useEffect(() => {
    if (!editing) return

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setEditing(null)
        setConflict(null)
        return
      }
      const shortcut = captureFromEvent(e)
      if (!shortcut) return

      const conflictEntry = Object.entries(shortcuts).find(([k, v]) => k !== editing && v === shortcut)
      if (conflictEntry) {
        const conflictRow = SHORTCUT_ROWS.find(r => r.key === conflictEntry[0])
        setConflict(`Conflicts with "${conflictRow?.label}"`)
        return
      }

      setSetting(`shortcuts.${editing}`, shortcut)
      setEditing(null)
      setConflict(null)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, shortcuts, setSetting])

  const handleReset = async () => {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      await setSetting(`shortcuts.${key}`, value)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">Click a shortcut to reassign it. Press Escape to cancel.</p>

      {conflict && (
        <div
          className="px-4 py-2.5 rounded-lg text-xs text-yellow-300"
          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}
        >
          ⚠ {conflict}
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {SHORTCUT_ROWS.map((row, i) => {
          const isEditing = editing === row.key
          return (
            <div
              key={row.key}
              className="flex items-center justify-between px-4 py-3"
              style={{
                background: isEditing
                  ? 'rgba(59,130,246,0.08)'
                  : i % 2 === 0
                  ? 'rgba(255,255,255,0.02)'
                  : 'transparent',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span className="text-sm text-gray-300">{row.label}</span>
              <button
                onClick={() => {
                  setConflict(null)
                  setEditing(isEditing ? null : row.key)
                }}
                className="px-3 py-1.5 rounded-md text-xs font-mono transition-colors"
                style={{
                  background: isEditing ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${isEditing ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: isEditing ? '#93c5fd' : 'rgba(209,213,219,1)',
                  minWidth: 120,
                }}
              >
                {isEditing ? 'Press keys…' : formatShortcut(shortcuts[row.key])}
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleReset}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  )
}
