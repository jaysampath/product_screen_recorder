import React, { useState, useEffect } from 'react'

const AUTO_DELETE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 7, label: 'After 7 days' },
  { value: 30, label: 'After 30 days' },
  { value: 90, label: 'After 90 days' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200"
      style={{
        width: 36,
        height: 20,
        background: checked ? '#3b82f6' : 'rgba(255,255,255,0.12)',
      }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white shadow transition-transform duration-200"
        style={{
          width: 16,
          height: 16,
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

export default function StorageTab({ settings, setSetting }) {
  const { storage } = settings
  const [totalSize, setTotalSize] = useState(0)

  useEffect(() => {
    window.electron.invoke('list-recordings').then(recs => {
      const total = recs.reduce((sum, r) => sum + (r.size || 0), 0)
      setTotalSize(total)
    })
  }, [])

  const handleChangeDirectory = async () => {
    const dir = await window.electron.invoke('open-directory-picker')
    if (dir) setSetting('storage.outputDirectory', dir)
  }

  const handleOpenFolder = () => {
    window.electron.invoke('open-recordings-folder')
  }

  const maxDisplayBytes = 5 * 1024 * 1024 * 1024
  const usagePct = Math.min((totalSize / maxDisplayBytes) * 100, 100)

  return (
    <div className="space-y-8">
      {/* Output folder */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase mb-3">Output Folder</p>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="flex-1 text-sm text-gray-400 truncate min-w-0">
            {storage.outputDirectory || 'Default (Videos/RecordQA)'}
          </span>
          <button
            onClick={handleChangeDirectory}
            className="flex-shrink-0 px-3 py-1 rounded-md text-xs text-gray-300 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            Change
          </button>
        </div>
      </div>

      {/* Keep original webm */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Keep Original .webm</div>
          <div className="text-xs text-gray-500 mt-0.5">Saves disk space when off</div>
        </div>
        <Toggle
          checked={storage.keepOriginalWebm}
          onChange={v => setSetting('storage.keepOriginalWebm', v)}
        />
      </div>

      {/* Auto-delete */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase mb-3">Auto-Delete</p>
        <select
          value={storage.autoDeleteAfterDays}
          onChange={e => setSetting('storage.autoDeleteAfterDays', parseInt(e.target.value))}
          className="w-full px-3 py-2 rounded-lg text-sm text-gray-300"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
          }}
        >
          {AUTO_DELETE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Storage usage */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase mb-3">Storage Usage</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Recordings</span>
            <span className="text-white font-medium">{formatBytes(totalSize)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${usagePct || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Open folder button */}
      <button
        onClick={handleOpenFolder}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
        Open Recordings Folder
      </button>
    </div>
  )
}
