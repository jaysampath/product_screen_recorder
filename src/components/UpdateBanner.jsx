import React, { useState, useEffect } from 'react'

function parseReleaseNotes(raw) {
  if (!raw) return ''
  if (typeof raw !== 'string') return String(raw)
  return raw
    .replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:13px;font-weight:600">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:10px 0 4px;font-size:14px;font-weight:600">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:10px 0 4px;font-size:15px;font-weight:700">$1</h2>')
    .replace(/^\* (.+)$/gm, '<li style="margin:2px 0">$1</li>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul style="padding-left:18px;margin:4px 0">${m}</ul>`)
    .replace(/\n/g, '<br>')
}

function ReleaseNotesModal({ version, notes, onDownload, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-xl shadow-2xl"
        style={{
          background: '#1e1e1e',
          border: '1px solid rgba(255,255,255,0.1)',
          width: 480,
          maxHeight: '70vh',
          padding: '24px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-base">
            What's new in v{version}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto text-sm text-gray-300 mb-5"
          style={{ lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: parseReleaseNotes(notes) || '<p>No release notes available.</p>' }}
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Later
          </button>
          <button
            onClick={() => { onDownload(); onClose() }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#1d4ed8' }}
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UpdateBanner() {
  const [state, setState] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    const off = window.electron.on('updater', (data) => {
      if (data.status === 'up-to-date') {
        setToast(true)
        setTimeout(() => setToast(false), 3000)
        return
      }
      if (data.status === 'error') return
      setDismissed(false)
      setState(data)
    })
    return () => window.electron.off('updater', off)
  }, [])

  const handleDownload = () => {
    window.electron.invoke('download-update')
  }

  const handleInstall = () => {
    window.electron.invoke('install-update')
  }

  if (toast) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm text-white shadow-lg"
        style={{ background: '#15803d' }}
      >
        You're on the latest version
      </div>
    )
  }

  if (!state || dismissed) return null

  const { status, version, releaseNotes, percent } = state

  if (status === 'available') {
    return (
      <>
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-2.5 text-sm text-white"
          style={{ background: '#1d4ed8' }}
        >
          <span className="font-medium">
            v{version} available
          </span>
          <div className="flex items-center gap-3">
            {releaseNotes && (
              <button
                onClick={() => setShowNotes(true)}
                className="underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                See what's new
              </button>
            )}
            <button
              onClick={handleDownload}
              className="px-3 py-1 rounded-md font-medium bg-white text-blue-700 hover:bg-blue-50 transition-colors text-xs"
            >
              Update
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showNotes && (
          <ReleaseNotesModal
            version={version}
            notes={releaseNotes}
            onDownload={handleDownload}
            onClose={() => setShowNotes(false)}
          />
        )}
      </>
    )
  }

  if (status === 'downloading') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-5 py-2.5 text-sm text-white"
        style={{ background: '#1e293b' }}
      >
        <span className="text-gray-300">Downloading update…</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${percent ?? 0}%`, background: '#3b82f6' }}
          />
        </div>
        <span className="text-gray-400 w-10 text-right">{percent ?? 0}%</span>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-2.5 text-sm text-white"
        style={{ background: '#15803d' }}
      >
        <span className="font-medium">
          Update ready — v{version}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstall}
            className="px-3 py-1 rounded-md font-medium bg-white text-green-700 hover:bg-green-50 transition-colors text-xs"
          >
            Restart to install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="opacity-60 hover:opacity-100 transition-opacity text-xs"
          >
            Later
          </button>
        </div>
      </div>
    )
  }

  return null
}
