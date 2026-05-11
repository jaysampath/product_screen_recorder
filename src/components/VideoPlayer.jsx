import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ recording, onClose, onDelete, onOpenInFinder }) {
  const videoRef = useRef(null);
  const scrubberRef = useRef(null);
  const volumeBarRef = useRef(null);
  const containerRef = useRef(null);

  const [src, setSrc] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => {
    window.electron
      .invoke('get-file-url', { filePath: recording.filePath })
      .then(setSrc)
      .catch(() => {});
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [recording.filePath]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const seek = useCallback(delta => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(5);
          break;
        case 'Escape':
          onClose();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, seek, toggleMute, toggleFullscreen, onClose]);

  useEffect(() => {
    function handleFsChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  function scrubTo(e) {
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = ratio * duration;
  }

  function setVolumeFromEvent(e) {
    const rect = volumeBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) {
      videoRef.current.volume = ratio;
      if (ratio > 0) videoRef.current.muted = false;
    }
  }

  function handleVolumeWheel(e) {
    e.preventDefault();
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, v.volume - e.deltaY * 0.002));
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(recording.filePath);
    } else {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  const effectiveVolume = muted ? 0 : volume;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-[90vw] flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <p className="text-white/50 text-sm mb-3 truncate max-w-full px-4 select-none">
          {recording.displayName || recording.filename}
        </p>

        {/* Video */}
        <video
          ref={videoRef}
          src={src || undefined}
          className="max-h-[70vh] rounded-xl bg-black cursor-pointer"
          style={{ maxWidth: '90vw' }}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration || 0);
            setVolume(videoRef.current?.volume || 1);
          }}
          onVolumeChange={() => {
            if (videoRef.current) {
              setVolume(videoRef.current.volume);
              setMuted(videoRef.current.muted);
            }
          }}
          onClick={togglePlay}
        />

        {/* Controls */}
        <div className="w-full mt-3 bg-[#1a1a1a] rounded-2xl px-4 pt-3 pb-3 flex flex-col gap-3 border border-white/10">
          {/* Scrubber */}
          <div
            ref={scrubberRef}
            className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group"
            onClick={scrubTo}
          >
            <div
              className="absolute left-0 top-0 h-full bg-blue-500 rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progress}%`, transform: 'translateX(-50%) translateY(-50%)' }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              className="text-white hover:text-blue-400 transition-colors flex-shrink-0"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time */}
            <span className="text-white/50 text-xs font-mono whitespace-nowrap flex-shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                className="text-white/50 hover:text-white transition-colors"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon level={effectiveVolume} />
              </button>
              <div
                ref={volumeBarRef}
                className="relative w-20 h-1.5 bg-white/20 rounded-full cursor-pointer group"
                onClick={setVolumeFromEvent}
                onWheel={handleVolumeWheel}
              >
                <div
                  className="absolute left-0 top-0 h-full bg-white/60 rounded-full pointer-events-none"
                  style={{ width: `${effectiveVolume * 100}%` }}
                />
                <div
                  className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ left: `${effectiveVolume * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                />
              </div>
            </div>

            {/* Fullscreen */}
            <button
              className="text-white/50 hover:text-white transition-colors flex-shrink-0"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>

            {/* Open in Finder */}
            {onOpenInFinder && (
              <button
                className="text-white/50 hover:text-white transition-colors flex-shrink-0"
                onClick={() => onOpenInFinder(recording.filePath)}
                aria-label="Show in Finder"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                </svg>
              </button>
            )}

            {/* Delete */}
            <button
              className={`flex-shrink-0 transition-colors ${
                confirmDelete
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-white/50 hover:text-red-400'
              }`}
              onClick={handleDeleteClick}
              aria-label="Delete recording"
            >
              {confirmDelete ? (
                <span className="text-xs font-medium whitespace-nowrap">Confirm ✓</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VolumeIcon({ level }) {
  if (level === 0) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    );
  }
  if (level < 0.5) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}
