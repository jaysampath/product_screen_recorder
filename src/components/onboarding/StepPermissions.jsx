import React, { useState, useEffect, useRef, useCallback } from 'react'

function StatusIcon({ status }) {
  if (status === 'granted') {
    return (
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5l3 3 5-5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (status === 'denied') {
    return (
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 2l7 7M9 2l-7 7" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <div
      className="flex-shrink-0 w-7 h-7 rounded-full"
      style={{ border: '2px solid rgba(255,255,255,0.15)' }}
    />
  )
}

function PermissionCard({ icon, title, subtitle, status, isOptional, onAllow, onSkip }) {
  const borderColor =
    status === 'granted'
      ? 'rgba(34,197,94,0.18)'
      : status === 'denied'
      ? 'rgba(239,68,68,0.18)'
      : 'rgba(255,255,255,0.08)'

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white leading-tight">{title}</p>
          {isOptional && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
            >
              Optional
            </span>
          )}
          {!isOptional && status === 'denied' && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
            >
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {status !== 'granted' && onAllow && (
          <button
            onClick={onAllow}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
          >
            Allow →
          </button>
        )}
        {status !== 'granted' && isOptional && onSkip && (
          <button
            onClick={onSkip}
            className="text-xs transition-colors whitespace-nowrap"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Skip
          </button>
        )}
        <StatusIcon status={status} />
      </div>
    </div>
  )
}

export default function StepPermissions({ onNext }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
  const [permissions, setPermissions] = useState({ screen: 'unknown', mic: 'unknown', accessibility: 'unknown' })
  const [micSkipped, setMicSkipped] = useState(false)
  const intervalRef = useRef(null)

  const checkPerms = useCallback(async () => {
    const result = await window.electron.invoke('check-permissions')
    setPermissions(result)
  }, [])

  useEffect(() => {
    if (!isMac) {
      setPermissions({ screen: 'granted', mic: 'granted', accessibility: 'granted' })
      const t = setTimeout(onNext, 350)
      return () => clearTimeout(t)
    }

    checkPerms()
    intervalRef.current = setInterval(checkPerms, 2000)
    return () => clearInterval(intervalRef.current)
  }, [isMac, checkPerms, onNext])

  const openPref = (pane) => window.electron.invoke('open-system-preferences', { pane })

  const canContinue =
    permissions.screen === 'granted' && permissions.accessibility === 'granted'

  return (
    <div className="flex flex-col">
      <h2 className="text-[26px] font-semibold text-white mb-1.5 tracking-tight text-center">
        Quick setup needed
      </h2>
      <p className="text-gray-400 text-[14px] mb-7 text-center">
        ReplayFlow needs a few permissions to work
      </p>

      <div className="flex flex-col gap-2.5 mb-7">
        <PermissionCard
          icon="🖥️"
          title="Screen Recording"
          subtitle="Required · Captures your screen"
          status={permissions.screen}
          onAllow={() => openPref('screen')}
        />
        <PermissionCard
          icon="♿"
          title="Accessibility"
          subtitle="Required · Enables click & key tracking"
          status={permissions.accessibility}
          onAllow={() => openPref('accessibility')}
        />
        <PermissionCard
          icon="🎙️"
          title="Microphone"
          subtitle="Optional · Records your voice narration"
          status={micSkipped ? 'granted' : permissions.mic}
          isOptional
          onAllow={() => openPref('mic')}
          onSkip={() => setMicSkipped(true)}
        />
      </div>

      {isMac && (
        <>
          <button
            onClick={onNext}
            disabled={!canContinue}
            className="w-full flex items-center justify-center gap-2 rounded-xl font-medium transition-colors"
            style={{
              height: 48,
              fontSize: 15,
              background: canContinue ? '#3b82f6' : 'rgba(255,255,255,0.07)',
              color: canContinue ? 'white' : 'rgba(255,255,255,0.3)',
              cursor: canContinue ? 'pointer' : 'not-allowed'
            }}
          >
            Continue
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          {!canContinue && (
            <p className="text-center text-xs text-gray-600 mt-3">
              Mic is optional — you can enable it later in Settings
            </p>
          )}
        </>
      )}
    </div>
  )
}
