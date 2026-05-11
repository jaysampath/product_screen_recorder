import React, { useState, useEffect, useCallback, useRef } from 'react'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes) {
  if (!bytes || bytes < 1024) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const BAR_STYLE = {
  width: 'calc(100% - 8px)',
  height: 'calc(100% - 8px)',
  background: 'rgba(16, 16, 16, 0.94)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.11)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
}

export default function ControlBar() {
  const [tick, setTick] = useState({ duration: 0, fileSize: 0, status: 'recording' })
  const [collapsed, setCollapsed] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const stopHoverRef = useRef(false)
  const discardTimerRef = useRef(null)

  useEffect(() => {
    const tickL = window.controlBar.on('recording-tick', (data) => setTick(data))
    const discardL = window.controlBar.on('show-discard-confirm', () => triggerDiscard())
    return () => {
      window.controlBar.off('recording-tick', tickL)
      window.controlBar.off('show-discard-confirm', discardL)
    }
  }, [])

  useEffect(() => {
    if (showDiscard) {
      discardTimerRef.current = setTimeout(() => setShowDiscard(false), 3000)
    }
    return () => {
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current)
    }
  }, [showDiscard])

  function triggerDiscard() {
    setShowDiscard(true)
  }

  const send = useCallback((ch) => window.controlBar.send(ch), [])

  const { duration, fileSize, status } = tick
  const isProcessing = status === 'processing'
  const isPaused = status === 'paused'

  // ── Discard confirmation ────────────────────────────────────────────
  if (showDiscard) {
    return (
      <Wrapper>
        <div
          style={{
            ...BAR_STYLE,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            WebkitAppRegion: 'drag',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 w-full"
            style={{ WebkitAppRegion: 'drag' }}
          >
            <span className="text-[11px] text-gray-300 flex-1 select-none">
              Discard recording?
            </span>
            <div
              className="flex items-center gap-1.5"
              style={{ WebkitAppRegion: 'no-drag' }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                onClick={() => {
                  setShowDiscard(false)
                  send('control-discard')
                }}
              >
                Discard
              </button>
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setShowDiscard(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Wrapper>
    )
  }

  // ── Processing ──────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <Wrapper>
        <div style={{ ...BAR_STYLE, WebkitAppRegion: 'drag' }}>
          <div className="flex items-center gap-2.5 px-4 w-full select-none">
            <div className="w-3 h-3 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin flex-shrink-0" />
            <span className="text-[11px] text-gray-400">Processing…</span>
          </div>
        </div>
      </Wrapper>
    )
  }

  // ── Collapsed ───────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <Wrapper>
        <div
          style={{ ...BAR_STYLE, WebkitAppRegion: 'drag' }}
          onDoubleClick={() => setCollapsed(false)}
        >
          <div className="flex items-center gap-2.5 px-3 flex-1 select-none">
            <StatusDot isPaused={isPaused} />
            <span className="text-[12px] font-mono text-white">{formatDuration(duration)}</span>
          </div>
          <div
            className="flex items-center pr-1.5"
            style={{ WebkitAppRegion: 'no-drag' }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <StopButton onClick={() => send('control-stop')} stopHoverRef={stopHoverRef} />
          </div>
        </div>
      </Wrapper>
    )
  }

  // ── Full bar ────────────────────────────────────────────────────────
  return (
    <Wrapper>
      <div
        style={{ ...BAR_STYLE, WebkitAppRegion: 'drag' }}
        onDoubleClick={() => setCollapsed(true)}
      >
        {/* Drag region: dot + timer + size */}
        <div
          className="flex items-center gap-2 pl-3 flex-1 select-none"
          style={{ WebkitAppRegion: 'drag', minWidth: 0 }}
        >
          <StatusDot isPaused={isPaused} />
          <span className="text-[12px] font-mono text-white flex-shrink-0">
            {formatDuration(duration)}
          </span>
          {formatSize(fileSize) && (
            <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
              {formatSize(fileSize)}
            </span>
          )}
        </div>

        {/* Controls — no-drag, stop propagation of dblclick */}
        <div
          className="flex items-center gap-0.5 pr-1.5"
          style={{ WebkitAppRegion: 'no-drag' }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Divider */}
          <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Pause / Resume */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            onClick={() => send(isPaused ? 'control-resume' : 'control-pause')}
            title={isPaused ? 'Resume (Ctrl+Shift+P)' : 'Pause (Ctrl+Shift+P)'}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </button>

          {/* Stop */}
          <StopButton onClick={() => send('control-stop')} stopHoverRef={stopHoverRef} />

          {/* Discard */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            onClick={() => setShowDiscard(true)}
            title="Discard (Ctrl+Shift+D)"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </Wrapper>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Wrapper({ children }) {
  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: 'transparent' }}
    >
      {children}
    </div>
  )
}

function StatusDot({ isPaused }) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {!isPaused && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
      )}
      <span
        className={[
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          isPaused ? 'bg-amber-400' : 'bg-red-500',
        ].join(' ')}
      />
    </span>
  )
}

function StopButton({ onClick, stopHoverRef }) {
  return (
    <button
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0"
      style={{ background: 'rgba(127, 29, 29, 0.9)' }}
      onMouseEnter={(e) => {
        stopHoverRef.current = true
        e.currentTarget.style.background = 'rgba(153, 27, 27, 1)'
      }}
      onMouseLeave={(e) => {
        stopHoverRef.current = false
        e.currentTarget.style.background = 'rgba(127, 29, 29, 0.9)'
      }}
      onClick={onClick}
      title="Stop (Ctrl+Shift+S)"
    >
      <StopIcon />
    </button>
  )
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
