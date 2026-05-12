import React, { useState, useEffect, useCallback, useRef } from 'react'
import RecordingTab from '../components/settings/RecordingTab'
import OverlaysTab from '../components/settings/OverlaysTab'
import StorageTab from '../components/settings/StorageTab'
import ShortcutsTab from '../components/settings/ShortcutsTab'
import AboutTab from '../components/settings/AboutTab'

const TABS = [
  { id: 'recording', label: 'Recording' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'storage', label: 'Storage' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' },
]

function setNestedValue(obj, path, value) {
  const parts = path.split('.')
  const result = { ...obj }
  let node = result
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] = { ...node[parts[i]] }
    node = node[parts[i]]
  }
  node[parts[parts.length - 1]] = value
  return result
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('recording')
  const [settings, setSettings] = useState(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef(null)

  useEffect(() => {
    window.electron.invoke('get-settings').then(setSettings)
  }, [])

  const setSetting = useCallback(async (key, value) => {
    await window.electron.invoke('set-setting', { key, value })
    setSettings(prev => setNestedValue(prev, key, value))
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000)
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading settings…</div>
      </div>
    )
  }

  const tabProps = { settings, setSetting }

  return (
    <div className="flex h-full relative" style={{ background: '#0f0f0f' }}>
      {/* Left tab rail */}
      <div
        className="flex flex-col flex-shrink-0 pt-6 pb-4"
        style={{
          width: 160,
          background: '#111111',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center px-5 py-2.5 text-sm text-left transition-colors"
              style={{
                color: isActive ? '#ffffff' : 'rgba(156,163,175,1)',
                background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 rounded-r-sm"
                  style={{ width: 3, background: '#3b82f6' }}
                />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl p-8">
          {activeTab === 'recording' && <RecordingTab {...tabProps} />}
          {activeTab === 'overlays' && <OverlaysTab {...tabProps} />}
          {activeTab === 'storage' && <StorageTab {...tabProps} />}
          {activeTab === 'shortcuts' && <ShortcutsTab {...tabProps} />}
          {activeTab === 'about' && <AboutTab {...tabProps} />}
        </div>
      </div>

      {/* Saved toast */}
      <div
        className="fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg pointer-events-none"
        style={{
          background: '#22c55e',
          zIndex: 50,
          transition: 'opacity 0.25s, transform 0.25s',
          opacity: toastVisible ? 1 : 0,
          transform: toastVisible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        Saved ✓
      </div>
    </div>
  )
}
