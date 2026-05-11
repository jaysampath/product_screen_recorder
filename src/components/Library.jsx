import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react'

function formatDuration(seconds) {
  if (seconds == null || !isFinite(seconds)) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function extractVideoMetadata(src) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      video.src = ''
      resolve(result)
    }

    const timer = setTimeout(() => done({ duration: null, thumbnail: null }), 10000)

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : null
      video.currentTime = Math.min(0.1, video.duration * 0.05 || 0.1)

      video.onseeked = () => {
        clearTimeout(timer)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 320
          canvas.height = 180
          canvas.getContext('2d').drawImage(video, 0, 0, 320, 180)
          done({ duration, thumbnail: canvas.toDataURL('image/jpeg', 0.75) })
        } catch {
          done({ duration, thumbnail: null })
        }
      }
    }

    video.onerror = () => {
      clearTimeout(timer)
      done({ duration: null, thumbnail: null })
    }

    video.src = src
  })
}

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'largest', label: 'Largest' }
]

const Library = forwardRef(function Library({ highlightId, onPlay }, ref) {
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('newest')
  const [metadata, setMetadata] = useState({}) // id -> { duration, thumbnail } | { loading: true }
  const [mediaUrls, setMediaUrls] = useState({}) // id -> media:// url

  const [openMenu, setOpenMenu] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const renameInputRef = useRef(null)
  const menuRef = useRef(null)

  const loadRecordings = useCallback(async () => {
    setLoading(true)
    const list = await window.electron.invoke('list-recordings')
    setRecordings(list)
    setLoading(false)
  }, [])

  useImperativeHandle(ref, () => ({ refresh: loadRecordings }), [loadRecordings])

  useEffect(() => {
    loadRecordings()
  }, [loadRecordings])

  // Resolve media:// URLs for recordings that don't have one yet
  useEffect(() => {
    const pending = recordings.filter((r) => !mediaUrls[r.id])
    if (!pending.length) return
    Promise.all(
      pending.map(async (rec) => {
        const url = await window.electron.invoke('get-file-url', { filePath: rec.filePath })
        return [rec.id, url]
      })
    ).then((pairs) => {
      setMediaUrls((prev) => {
        const next = { ...prev }
        pairs.forEach(([id, url]) => { next[id] = url })
        return next
      })
    })
  }, [recordings])

  // Extract thumbnail + duration for each URL once available
  useEffect(() => {
    const toLoad = Object.entries(mediaUrls).filter(([id]) => !metadata[id])
    if (!toLoad.length) return

    // Immediately mark as loading to prevent duplicate kicks
    setMetadata((prev) => {
      const next = { ...prev }
      toLoad.forEach(([id]) => { next[id] = { loading: true } })
      return next
    })

    toLoad.forEach(([id, url]) => {
      extractVideoMetadata(url).then(({ duration, thumbnail }) => {
        setMetadata((prev) => ({ ...prev, [id]: { duration, thumbnail } }))
      })
    })
  }, [mediaUrls])

  // Close three-dot menu on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  // Focus rename input when rename starts
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renaming])

  const sorted = [...recordings].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
    if (sort === 'largest') return b.size - a.size
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const handleDelete = async (id) => {
    const rec = recordings.find((r) => r.id === id)
    if (!rec) return
    const result = await window.electron.invoke('delete-recording', { filePath: rec.filePath })
    if (result.success) {
      setRecordings((prev) => prev.filter((r) => r.id !== id))
      setMetadata((prev) => { const n = { ...prev }; delete n[id]; return n })
      setMediaUrls((prev) => { const n = { ...prev }; delete n[id]; return n })
    }
    setDeleteConfirm(null)
  }

  const handleRenameSubmit = async (id) => {
    const rec = recordings.find((r) => r.id === id)
    setRenaming(null)
    if (!rec || !renameValue.trim()) return

    const result = await window.electron.invoke('rename-recording', {
      filePath: rec.filePath,
      newName: renameValue.trim()
    })
    if (result.success) {
      const newId = result.newFilename.replace(/\.webm$/, '')
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, id: newId, filename: result.newFilename, filePath: result.newPath }
            : r
        )
      )
      setMetadata((prev) => {
        const n = { ...prev }
        n[newId] = n[id]
        delete n[id]
        return n
      })
      // URL needs re-resolving with the new path
      setMediaUrls((prev) => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm select-none">
        Loading recordings…
      </div>
    )
  }

  if (!recordings.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full select-none text-center px-6">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-white font-medium mb-1">No recordings yet</p>
        <p className="text-gray-500 text-sm">Click 'New Recording' to start.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs text-gray-500">
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </span>
        <div
          className="flex items-center gap-0.5 rounded-lg p-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                sort === opt.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {sorted.map((rec) => {
            const meta = metadata[rec.id]
            const isHighlighted = rec.id === highlightId
            const isRenaming = renaming === rec.id
            const displayName = rec.filename.replace(/\.webm$/, '')

            return (
              <div
                key={rec.id}
                className={[
                  'group relative flex flex-col rounded-xl overflow-visible cursor-pointer transition-all duration-200',
                  isHighlighted
                    ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#0f0f0f]'
                    : 'hover:ring-1 hover:ring-white/20'
                ].join(' ')}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12
                }}
                onClick={() => !isRenaming && onPlay(rec, mediaUrls[rec.id])}
              >
                {/* Thumbnail area */}
                <div
                  className="relative w-full overflow-hidden flex-shrink-0"
                  style={{ aspectRatio: '16/9', borderRadius: '12px 12px 0 0' }}
                >
                  {meta?.thumbnail ? (
                    <img
                      src={meta.thumbnail}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: '#111' }}
                    >
                      {meta?.loading ? (
                        <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Duration badge */}
                  {meta?.duration != null && (
                    <div
                      className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-white"
                      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
                    >
                      {formatDuration(meta.duration)}
                    </div>
                  )}

                  {/* Play overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.38)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}
                    >
                      <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div
                  className="flex flex-col p-3 gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-1.5">
                    {/* Filename / rename input */}
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(rec.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(rec.id)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          className="w-full px-1.5 py-0.5 rounded text-sm text-white outline-none"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(99,102,241,0.6)'
                          }}
                        />
                      ) : (
                        <p
                          className="text-sm text-white truncate leading-tight cursor-text"
                          title={displayName}
                          onDoubleClick={() => {
                            setRenaming(rec.id)
                            setRenameValue(displayName)
                          }}
                        >
                          {displayName}
                        </p>
                      )}
                    </div>

                    {/* Three-dot menu */}
                    <div
                      className="relative flex-shrink-0"
                      ref={openMenu === rec.id ? menuRef : null}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenu(openMenu === rec.id ? null : rec.id)
                        }}
                        className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="4" r="1.5" />
                          <circle cx="10" cy="10" r="1.5" />
                          <circle cx="10" cy="16" r="1.5" />
                        </svg>
                      </button>

                      {openMenu === rec.id && (
                        <div
                          className="absolute right-0 top-7 z-20 w-44 rounded-lg py-1 shadow-2xl"
                          style={{
                            background: '#2a2a2a',
                            border: '1px solid rgba(255,255,255,0.12)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors text-left"
                            style={{ '--tw-bg-opacity': 1 }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                            onClick={() => {
                              setOpenMenu(null)
                              onPlay(rec, mediaUrls[rec.id])
                            }}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Play
                          </button>
                          <button
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors text-left"
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                            onClick={() => {
                              setOpenMenu(null)
                              window.electron.invoke('open-in-finder', { filePath: rec.filePath })
                            }}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Show in Folder
                          </button>
                          <div className="my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
                          <button
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors text-left"
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = ''}
                            onClick={() => {
                              setOpenMenu(null)
                              setDeleteConfirm(rec.id)
                            }}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Size + date row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{formatSize(rec.size)}</span>
                    <span className="text-xs text-gray-600">{formatDate(rec.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-80 rounded-xl p-6 shadow-2xl"
            style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold mb-2">Delete recording?</h3>
            <p className="text-sm text-gray-400 mb-6">
              The file will be moved to the Trash and can be restored from there.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default Library
