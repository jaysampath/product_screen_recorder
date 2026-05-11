import { useState, useRef, useEffect } from 'react';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecordingCard({
  recording,
  isSelected,
  anySelected,
  onSelect,
  onPlay,
  onDelete,
  onRename,
  onOpenInFinder,
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(recording.displayName || recording.filename);
  const menuRef = useRef(null);
  const renameRef = useRef(null);
  const confirmTimer = useRef(null);

  // sync renameValue if displayName changes externally
  useEffect(() => {
    if (!renaming) setRenameValue(recording.displayName || recording.filename);
  }, [recording.displayName, recording.filename, renaming]);

  useEffect(() => {
    if (!menuOpen) {
      setConfirmDelete(false);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    }
  }, [menuOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus();
  }, [renaming]);

  function handleDeleteClick() {
    if (confirmDelete) {
      setMenuOpen(false);
      onDelete(recording.filePath);
    } else {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  function handleRenameStart() {
    setMenuOpen(false);
    setRenameValue(recording.displayName || recording.filename);
    setRenaming(true);
  }

  function handleRenameSave() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== (recording.displayName || recording.filename)) {
      onRename(recording.id, trimmed);
    }
    setRenaming(false);
  }

  function handleRenameKey(e) {
    if (e.key === 'Enter') handleRenameSave();
    if (e.key === 'Escape') setRenaming(false);
  }

  function handleCopyPath() {
    navigator.clipboard.writeText(recording.filePath).catch(() => {});
    setMenuOpen(false);
  }

  const showCheckbox = hovered || anySelected;
  const displayName = recording.displayName || recording.filename;

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-200 bg-[#1a1a1a] ${
        isSelected
          ? 'ring-2 ring-blue-500'
          : 'ring-1 ring-white/10 hover:ring-white/20'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full aspect-video bg-[#111] cursor-pointer"
        onClick={() => onPlay(recording)}
      >
        {recording.thumbnail ? (
          <img
            src={`data:image/jpeg;base64,${recording.thumbnail}`}
            alt={displayName}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/15">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Hover overlay with play button */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {recording.duration !== undefined && recording.status !== 'processing' && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full font-mono">
            {formatDuration(recording.duration)}
          </div>
        )}

        {/* Processing badge */}
        {recording.status === 'processing' && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
            Processing...
          </div>
        )}

        {/* Checkbox */}
        <div
          className={`absolute top-2 left-2 transition-opacity duration-200 ${
            showCheckbox ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={e => {
            e.stopPropagation();
            onSelect(recording.id);
          }}
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'bg-black/50 border-white/50 hover:border-white'
            }`}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1.5 5l2.5 2.5 4.5-4.5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          {renaming ? (
            <input
              ref={renameRef}
              className="flex-1 bg-white/10 text-white text-sm rounded-lg px-2 py-0.5 outline-none ring-1 ring-blue-500 min-w-0"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRenameSave}
              onKeyDown={handleRenameKey}
            />
          ) : (
            <p
              className="flex-1 text-white text-sm font-medium truncate cursor-text select-none min-w-0"
              onDoubleClick={handleRenameStart}
              title={displayName}
            >
              {displayName}
            </p>
          )}

          {/* Three-dot menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              className="text-white/30 hover:text-white/70 p-0.5 rounded transition-colors"
              onClick={e => {
                e.stopPropagation();
                setMenuOpen(v => !v);
              }}
              aria-label="More options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-7 z-50 w-48 bg-[#2a2a2a] rounded-xl shadow-2xl border border-white/10 py-1 overflow-hidden">
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onPlay(recording);
                  }}
                >
                  <span className="w-4 text-center">▶</span> Play
                </MenuItem>
                <MenuItem onClick={handleRenameStart}>
                  <span className="w-4 text-center">✏️</span> Rename
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenInFinder(recording.filePath);
                  }}
                >
                  <span className="w-4 text-center">📂</span> Open in Finder
                </MenuItem>
                <MenuItem onClick={handleCopyPath}>
                  <span className="w-4 text-center">📋</span> Copy Path
                </MenuItem>

                <div className="border-t border-white/10 my-1" />

                <button
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    confirmDelete
                      ? 'text-red-300 bg-red-500/10 hover:bg-red-500/20'
                      : 'text-white/70 hover:bg-white/10 hover:text-red-400'
                  }`}
                  onClick={handleDeleteClick}
                >
                  <span className="w-4 text-center">🗑️</span>
                  {confirmDelete ? 'Confirm delete ✓' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-white/35 text-xs mt-1 truncate">
          {formatDate(recording.createdAt)}
          {recording.size ? ` · ${formatSize(recording.size)}` : ''}
        </p>
      </div>
    </div>
  );
}

function MenuItem({ onClick, children }) {
  return (
    <button
      className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
