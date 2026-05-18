import { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { useAuth } from '../hooks/useAuth';
import RecordingCard from '../components/RecordingCard';
import VideoPlayer from '../components/VideoPlayer';
import UpgradeModal from '../components/UpgradeModal';

function formatTotalDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTotalSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest', label: 'Longest first' },
  { value: 'largest', label: 'Largest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

export default function Library({ onNavigate }) {
  const {
    recordings,
    allRecordings,
    isLoading,
    error,
    selectedIds,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    deleteRecording,
    deleteSelected,
    openInFinder,
    renameRecording,
    toggleSelect,
    clearSelection,
  } = useLibrary();

  const { isPro } = useAuth();
  const isProUser = isPro();
  const [playingRecording, setPlayingRecording] = useState(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const FREE_LIMIT = 10;
  const isAtLimit = !isProUser && allRecordings.length >= FREE_LIMIT;

  const totalDuration = allRecordings.reduce((sum, r) => sum + (r.duration || 0), 0);
  const totalSize = allRecordings.reduce((sum, r) => sum + (r.size || 0), 0);
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Sort';

  function handlePlay(recording) {
    setPlayingRecording(recording);
  }

  function handlePlayerDelete(filePath) {
    setPlayingRecording(null);
    deleteRecording(filePath);
  }

  return (
    <div className="flex flex-col h-full bg-[#111] text-white select-none">
      {/* Header toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl pl-9 pr-4 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-blue-500/60 transition-all"
          />
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/60 hover:text-white rounded-xl px-3 py-2 text-sm transition-colors ring-1 ring-white/10"
            onClick={() => setSortMenuOpen(v => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
            </svg>
            {currentSortLabel}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {sortMenuOpen && (
            <div className="absolute right-0 top-10 z-30 w-44 bg-[#2a2a2a] rounded-xl shadow-2xl border border-white/10 py-1 overflow-hidden">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                    sortBy === opt.value
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => {
                    setSortBy(opt.value);
                    setSortMenuOpen(false);
                  }}
                >
                  {sortBy === opt.value && (
                    <span className="text-blue-400 text-xs">✓</span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Record button */}
        <button
          className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors flex-shrink-0"
          style={isAtLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          title={isAtLimit ? 'Upgrade to record more' : undefined}
          onClick={() => isAtLimit ? setShowUpgradeModal(true) : onNavigate?.('record')}
        >
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="10" />
          </svg>
          Record
        </button>
      </div>

      {/* Stats bar */}
      {allRecordings.length > 0 && (
        <div className="px-6 py-1.5 border-b border-white/5 text-xs text-white/25 flex-shrink-0">
          {isProUser
            ? `${allRecordings.length} recording${allRecordings.length !== 1 ? 's' : ''} · unlimited`
            : `${allRecordings.length}/10 recording${allRecordings.length !== 1 ? 's' : ''} · upgrade for unlimited`
          }
          {totalDuration > 0 && ` · ${formatTotalDuration(totalDuration)}`}
          {totalSize > 0 && ` · ${formatTotalSize(totalSize)}`}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-blue-600/15 border-b border-blue-500/20 text-sm flex-shrink-0">
          <span className="text-blue-300 font-medium">
            {selectedIds.size} selected
          </span>
          <button
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            onClick={deleteSelected}
          >
            Delete selected
          </button>
          <button
            className="text-white/40 hover:text-white px-2 py-1 rounded-lg text-xs transition-colors"
            onClick={clearSelection}
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Free tier limit banner */}
        {isAtLimit && (
          <div
            className="flex items-center justify-between mb-4 rounded-lg px-4 py-3"
            style={{ background: '#1a1228', border: '1px solid #3d2a5a' }}
          >
            <div>
              <p className="text-sm" style={{ color: '#ccc' }}>
                You've reached the 10 recording limit
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                Upgrade to Pro for unlimited recordings
              </p>
            </div>
            <button
              className="text-sm font-semibold ml-4 flex-shrink-0"
              style={{ color: '#a78bfa' }}
              onClick={() => setShowUpgradeModal(true)}
            >
              Upgrade →
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-white/30">
              <div className="w-7 h-7 border-2 border-white/15 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm">Loading recordings…</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-1">Failed to load recordings</p>
              <p className="text-white/30 text-xs">{error}</p>
            </div>
          </div>
        ) : allRecordings.length === 0 ? (
          <EmptyState onRecord={() => onNavigate?.('record')} />
        ) : recordings.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <p className="text-sm">No recordings match &ldquo;{searchQuery}&rdquo;</p>
            <button
              className="text-blue-400 text-xs hover:underline"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {recordings.map(recording => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                isSelected={selectedIds.has(recording.id)}
                anySelected={selectedIds.size > 0}
                onSelect={toggleSelect}
                onPlay={handlePlay}
                onDelete={deleteRecording}
                onRename={renameRecording}
                onOpenInFinder={openInFinder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video player modal */}
      {playingRecording && (
        <VideoPlayer
          recording={playingRecording}
          onClose={() => setPlayingRecording(null)}
          onDelete={handlePlayerDelete}
          onOpenInFinder={openInFinder}
        />
      )}

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}

function EmptyState({ onRecord }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="text-white/10">
        <rect x="4" y="10" width="64" height="44" rx="6" stroke="currentColor" strokeWidth="3" />
        <path d="M24 68h24M36 54v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="68" cy="56" r="16" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="3" />
        <path
          d="M64 52v8l6-4-6-4z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-white/50 text-lg font-medium mb-1">No recordings yet</p>
        <p className="text-white/30 text-sm">Click &lsquo;+ Record&rsquo; to capture your first screen</p>
      </div>
      <button
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
        onClick={onRecord}
      >
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="10" r="10" />
        </svg>
        New Recording
      </button>
    </div>
  );
}
