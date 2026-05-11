import React, { useEffect, useRef, useState } from 'react'
import { useSourcePicker } from '../hooks/useSourcePicker'

const TABS = [
  { id: 'screen', label: 'Entire Screen' },
  { id: 'window', label: 'Application Window' }
]

export default function SourcePicker({ onSelect, onClose }) {
  const {
    sources,
    filteredSources,
    selectedSource,
    setSelectedSource,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    fetchSources
  } = useSourcePicker()

  const [activeTab, setActiveTab] = useState('screen')
  const selectedRef = useRef(selectedSource)

  useEffect(() => {
    selectedRef.current = selectedSource
  }, [selectedSource])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && selectedRef.current) onSelect(selectedRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSelect])

  const tabSources = filteredSources.filter((s) =>
    activeTab === 'screen' ? s.id.startsWith('screen:') : !s.id.startsWith('screen:')
  )

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSelectedSource(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex flex-col w-[820px] max-h-[580px] rounded-xl bg-[#1c1c1c] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07]">
          <h2 className="text-[15px] font-semibold text-white tracking-tight">Choose what to record</h2>
          <button
            onClick={fetchSources}
            disabled={isLoading}
            title="Refresh sources"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors disabled:opacity-40"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3 px-6 pt-4 pb-3">
          <div className="flex gap-0.5 rounded-lg bg-white/[0.06] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={[
                  'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* Source grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {isLoading && sources.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-gray-600 text-sm">
              Loading sources…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-44 text-red-400/80 text-sm">
              {error}
            </div>
          ) : tabSources.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-gray-600 text-sm">
              No sources found
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {tabSources.map((source) => {
                const isSelected = selectedSource?.id === source.id
                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    onDoubleClick={() => onSelect(source)}
                    className={[
                      'relative flex flex-col rounded-lg overflow-hidden border text-left transition-all focus:outline-none',
                      isSelected
                        ? 'border-blue-500 ring-1 ring-blue-500/30 bg-blue-500/5'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-blue-400/50 hover:bg-white/[0.05]'
                    ].join(' ')}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full aspect-video bg-black/50 flex-shrink-0">
                      {source.thumbnail ? (
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Selected checkmark badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Source name row */}
                    <div className="flex items-center gap-2 px-2.5 py-2 min-w-0">
                      {source.appIcon && activeTab === 'window' && (
                        <img
                          src={source.appIcon}
                          alt=""
                          className="w-4 h-4 flex-shrink-0 rounded-sm object-contain"
                        />
                      )}
                      <span className="text-xs text-gray-300 truncate leading-tight">
                        {source.name}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedSource && onSelect(selectedSource)}
            disabled={!selectedSource}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  )
}
