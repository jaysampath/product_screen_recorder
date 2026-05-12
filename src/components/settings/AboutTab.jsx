import React, { useState, useEffect } from 'react'

export default function AboutTab({ settings, setSetting }) {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    window.electron.invoke('get-app-version').then(v => setVersion(v || '1.0.0')).catch(() => setVersion('1.0.0'))
  }, [])

  const handleOpenFolder = () => window.electron.invoke('open-recordings-folder')
  const handleRestartOnboarding = () => setSetting('onboarding.completed', false)

  return (
    <div className="space-y-8">
      {/* App identity */}
      <div className="flex items-center gap-5">
        <div
          className="flex items-center justify-center rounded-2xl flex-shrink-0"
          style={{ width: 64, height: 64, background: '#dc2626' }}
        >
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="6" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">RecordQA</h2>
          <p className="text-sm text-gray-500 mt-0.5">Version {version}</p>
          <p className="text-xs text-gray-600 mt-1">Built for QA teams</p>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Action rows */}
      <div className="space-y-2">
        {/* Check for Updates */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          onClick={() => {}}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <div>
            <div className="text-sm text-gray-300">Check for Updates</div>
            <div className="text-xs text-gray-600 mt-0.5">You're on the latest version</div>
          </div>
        </button>

        {/* Open Recordings Folder */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-white/5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          onClick={handleOpenFolder}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="text-sm text-gray-300">Open Recordings Folder</span>
        </button>

        {/* Restart Onboarding */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-white/5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          onClick={handleRestartOnboarding}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          <span className="text-sm text-gray-300">Restart Onboarding</span>
        </button>
      </div>
    </div>
  )
}
