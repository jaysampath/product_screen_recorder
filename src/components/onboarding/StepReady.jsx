import React, { useState, useEffect } from 'react'

export default function StepReady({ onComplete }) {
  const [recordingsDir, setRecordingsDir] = useState('')
  const [checkVisible, setCheckVisible] = useState(false)
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')

  useEffect(() => {
    window.electron.invoke('get-recordings-dir').then(setRecordingsDir).catch(() => {})
    const t = setTimeout(() => setCheckVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const complete = async (mode) => {
    await window.electron.invoke('complete-onboarding')
    onComplete(mode)
  }

  const changeFolder = async () => {
    const dir = await window.electron.invoke('open-directory-picker')
    if (dir) {
      await window.electron.invoke('set-setting', { key: 'storage.outputDirectory', value: dir })
      setRecordingsDir(dir)
    }
  }

  const displayDir = recordingsDir
    ? recordingsDir.replace(window.electron.homedir || '', '~').replace(/\\/g, '/')
    : '…'

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated checkmark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          border: '2px solid rgba(34,197,94,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          transform: checkVisible ? 'scale(1)' : 'scale(0.4)',
          opacity: checkVisible ? 1 : 0,
          transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms'
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            d="M8 18l8 8 13-14"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 40,
              strokeDashoffset: checkVisible ? 0 : 40,
              transition: 'stroke-dashoffset 500ms ease 200ms'
            }}
          />
        </svg>
      </div>

      <h2 className="text-[28px] font-semibold text-white mb-2 tracking-tight">You're all set!</h2>
      <p className="text-gray-400 text-[14px] mb-7">RecordQA is ready to capture your workflow</p>

      {/* Recordings folder */}
      <div
        className="w-full rounded-xl px-4 py-3.5 mb-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg flex-shrink-0">📁</span>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs text-gray-500 mb-0.5">Recordings saved to</p>
            <p className="text-sm text-white font-mono truncate">{displayDir}</p>
          </div>
          <button
            onClick={changeFolder}
            className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Change
          </button>
        </div>
      </div>

      {/* Shortcut tip */}
      <div
        className="w-full rounded-xl px-4 py-3.5 mb-7"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">⌨️</span>
          <div className="text-left">
            <p className="text-xs font-medium text-gray-300 mb-1">Quick tip</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Press{' '}
              <kbd
                className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              >
                {isMac ? 'Cmd' : 'Ctrl'}+Shift+R
              </kbd>{' '}
              anywhere to start recording instantly
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 w-full">
        <button
          onClick={() => complete('record')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          style={{ height: 48, fontSize: 15 }}
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="6" />
          </svg>
          Start Recording Now
        </button>
        <button
          onClick={() => complete('library')}
          className="w-full flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-colors"
          style={{ height: 44, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}
        >
          Browse Library →
        </button>
      </div>
    </div>
  )
}
