import React, { useState, useEffect, useRef, useCallback } from 'react'
import SourcePicker from './components/SourcePicker'
import Library from './pages/Library'
import Settings from './pages/Settings'
import UpdateBanner from './components/UpdateBanner'
import Onboarding from './pages/Onboarding'
import Auth from './pages/Auth'
import UserMenu from './components/UserMenu'
import UpgradeModal from './components/UpgradeModal'
import { useRecorder } from './hooks/useRecorder'
import { AuthProvider, useAuth } from './hooks/useAuth'

const NAV_ITEMS = [
  {
    id: 'library',
    label: 'Library',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    )
  },
  {
    id: 'review',
    label: 'Review',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
]

function formatDuration(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const [view, setView] = useState('loading')
  const [activeNav, setActiveNav] = useState('library')
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [overlayActive, setOverlayActive] = useState(false)

  const { user, isLoading: authLoading, signOut } = useAuth()

  const {
    status,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    outputPath
  } = useRecorder()

  const handleSourceSelected = useCallback(
    async (source) => {
      setShowSourcePicker(false)
      await startRecording(source.id)
    },
    [startRecording]
  )

  // After a recording saves: switch to library and trigger its refresh
  useEffect(() => {
    if (status === 'done' && outputPath) {
      setActiveNav('library')
      window.dispatchEvent(new Event('processing-complete'))
    }
  }, [status, outputPath])

  const isRecording = status === 'recording' || status === 'paused'
  const isProcessing = status === 'processing'

  const handleStop = async () => {
    try {
      await stopRecording()
    } catch {
      // error is tracked in hook state
    }
  }

  // Show/hide the floating control bar window based on recording state
  useEffect(() => {
    if (status === 'recording') {
      window.electron.send('show-control-bar')
    } else if (status === 'idle' || status === 'done') {
      window.electron.send('hide-control-bar')
    }
  }, [status])

  // Check onboarding on first mount — session restore runs in AuthProvider
  useEffect(() => {
    window.electron.invoke('get-onboarding-status').then((completed) => {
      setView(completed ? 'app' : 'onboarding')
    })
  }, [])

  // Handle control commands forwarded from the control bar window (via main process)
  // statusRef avoids stale closure in the pause-toggle handler
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  useEffect(() => {
    const l1 = window.electron.on('control-pause', () => pauseRecording())
    const l2 = window.electron.on('control-resume', () => resumeRecording())
    const l3 = window.electron.on('control-pause-toggle', () => {
      if (statusRef.current === 'recording') pauseRecording()
      else if (statusRef.current === 'paused') resumeRecording()
    })
    const l4 = window.electron.on('control-stop', () => stopRecording().catch(() => {}))
    const l5 = window.electron.on('control-discard', () => discardRecording())
    return () => {
      window.electron.off('control-pause', l1)
      window.electron.off('control-resume', l2)
      window.electron.off('control-pause-toggle', l3)
      window.electron.off('control-stop', l4)
      window.electron.off('control-discard', l5)
    }
  }, [pauseRecording, resumeRecording, stopRecording, discardRecording])

  if (view === 'loading' || authLoading) {
    return (
      <div style={{ background: '#0f0f0f', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg style={{ width: 32, height: 32, animation: 'spin 2s linear infinite', color: '#a78bfa' }} fill="none" viewBox="0 0 24 24">
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (view === 'onboarding') {
    return (
      <Onboarding
        onComplete={(mode) => {
          setView('app')
          if (mode === 'record') setTimeout(() => setShowSourcePicker(true), 50)
        }}
      />
    )
  }

  if (view === 'auth') {
    return <Auth onSuccess={() => setView('app')} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0f0f0f' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 py-5 px-3"
        style={{
          width: 240,
          background: '#1a1a1a',
          borderRight: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="6" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">ReplayFlow</span>
        </div>

        <p className="px-2 mb-1.5 text-[10px] font-medium tracking-widest text-gray-600 uppercase">
          Menu
        </p>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={[
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left w-full',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                ].join(' ')}
              >
                {item.icon}
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            )
          })}
        </nav>

        {/* New Recording button */}
        <button
          onClick={() => setShowSourcePicker(true)}
          disabled={isRecording || isProcessing}
          className="flex items-center gap-2.5 mx-2 mt-4 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="6" />
          </svg>
          New Recording
        </button>

        {/* Error notice */}
        {error && (
          <div
            className="mx-2 mt-3 px-3 py-2.5 rounded-lg text-xs text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {error}
          </div>
        )}

        <div className="mt-auto">
          <div className="px-2 mb-2">
            <div
              className="rounded-lg p-3 text-xs text-gray-500"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <p className="font-medium text-gray-400 mb-0.5">ReplayFlow</p>
              <p>v1.0.0 — ready</p>
            </div>
            <button
              onClick={() => {
                if (overlayActive) {
                  window.electron.send('hide-overlay')
                  setOverlayActive(false)
                } else {
                  window.electron.send('show-overlay')
                  setTimeout(() => {
                    window.electron.send('overlay-event', { type: 'test-circle' })
                  }, 150)
                  setOverlayActive(true)
                }
              }}
              className="w-full mt-2 px-3 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors text-left"
            >
              {overlayActive ? 'Stop Overlay' : 'Test Overlay'}
            </button>
          </div>

          <UserMenu
            onSignInClick={() => setView('auth')}
            onUpgradeClick={() => setShowUpgrade(true)}
            onSignOut={() => setActiveNav('library')}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar — hidden for library and settings which have their own headers */}
        {activeNav !== 'library' && activeNav !== 'settings' && (
          <header
            className="flex items-center px-6 flex-shrink-0"
            style={{
              height: 56,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.015)'
            }}
          >
            <h1 className="text-sm font-medium text-white capitalize">{activeNav}</h1>
          </header>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {activeNav === 'library' ? (
            <Library
              onNavigate={(to) => {
                if (to === 'record') setShowSourcePicker(true)
              }}
            />
          ) : activeNav === 'settings' ? (
            <Settings />
          ) : (
            <div className="flex items-center justify-center h-full select-none">
              <p className="text-gray-600 text-sm">
                {activeNav.charAt(0).toUpperCase() + activeNav.slice(1)} — coming soon
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Floating recording control bar */}
      {(isRecording || isProcessing) && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl"
          style={{
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)'
          }}
        >
          {isProcessing ? (
            <>
              <div className="w-3 h-3 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-gray-300">Saving recording…</span>
            </>
          ) : (
            <>
              {/* Pulsing dot */}
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span
                  className={[
                    'absolute inline-flex h-full w-full rounded-full opacity-75',
                    status === 'paused' ? 'bg-yellow-400' : 'bg-red-500 animate-ping'
                  ].join(' ')}
                />
                <span
                  className={[
                    'relative inline-flex rounded-full h-3 w-3',
                    status === 'paused' ? 'bg-yellow-400' : 'bg-red-500'
                  ].join(' ')}
                />
              </span>

              <span className="text-sm text-white font-mono w-12">
                {formatDuration(duration)}
              </span>

              <div
                className="w-px h-4 flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              />

              {/* Pause / Resume */}
              <button
                onClick={status === 'paused' ? resumeRecording : pauseRecording}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {status === 'paused' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Resume
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                    Pause
                  </>
                )}
              </button>

              {/* Stop */}
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>

              {/* Discard */}
              <button
                onClick={discardRecording}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors"
                title="Discard recording"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Source picker modal */}
      {showSourcePicker && (
        <SourcePicker
          onSelect={handleSourceSelected}
          onClose={() => setShowSourcePicker(false)}
        />
      )}

      <UpdateBanner />

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />

    </div>
  )
}
