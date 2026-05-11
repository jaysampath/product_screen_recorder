import { useState, useEffect, useRef, useCallback } from 'react'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProcessingModal({ isOpen, progress, result, onCancel, onDismiss }) {
  const [cancelling, setCancelling] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const firstProgressTimeRef = useRef(null)

  const percent = progress?.overallPercent ?? 0

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCancelling(false)
      setShowComplete(false)
      setTimeRemaining(null)
      firstProgressTimeRef.current = null
    }
  }, [isOpen])

  // Time-remaining estimate — only show after 3 s of data
  useEffect(() => {
    if (!progress || percent <= 0) return
    const now = Date.now()
    if (!firstProgressTimeRef.current) {
      firstProgressTimeRef.current = now
      return
    }
    const elapsed = (now - firstProgressTimeRef.current) / 1000
    if (elapsed < 3) return
    const totalEstimate = elapsed / (percent / 100)
    setTimeRemaining(Math.max(0, totalEstimate - elapsed))
  }, [progress, percent])

  // Completion: animate then auto-dismiss and notify library
  useEffect(() => {
    if (!result || showComplete) return
    setShowComplete(true)
    window.dispatchEvent(new CustomEvent('processing-complete', { detail: result }))
    const timer = setTimeout(() => onDismiss?.(), 1500)
    return () => clearTimeout(timer)
  }, [result, showComplete, onDismiss])

  const handleCancel = useCallback(async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await onCancel?.()
    } catch {}
  }, [cancelling, onCancel])

  if (!isOpen) return null

  const stageName = progress?.stageName ?? 'Preparing...'
  const stageNum = (progress?.stage ?? 0) + 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#1a1a1a] rounded-2xl p-10 w-[420px] flex flex-col items-center gap-6 shadow-2xl">
        {showComplete ? (
          <>
            <svg className="checkmark" viewBox="0 0 52 52" width="64" height="64">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14 27l7 7 16-16" />
            </svg>
            <p className="text-white text-lg font-semibold">Recording ready!</p>
            {result && (
              <p className="text-gray-400 text-sm">
                {formatDuration(result.duration)} · {formatBytes(result.fileSize)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-white text-lg font-semibold">Processing your recording</p>

            {/* Progress bar with right-aligned percentage */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{stageName}</span>
                <span className="text-white font-medium">{Math.round(percent)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3b82f6]"
                  style={{ width: `${percent}%`, transition: 'width 300ms ease' }}
                />
              </div>
            </div>

            {/* Stage info + time remaining */}
            <div className="text-center flex flex-col gap-1">
              <p className="text-gray-500 text-sm">Stage {stageNum} of 4</p>
              {timeRemaining !== null && (
                <p className="text-gray-500 text-sm">
                  ⏱ About {formatDuration(timeRemaining)} remaining
                </p>
              )}
            </div>

            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm
                         hover:border-gray-400 hover:text-white transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          </>
        )}
      </div>

      <style>{`
        .checkmark {
          stroke: #22c55e;
          stroke-width: 2;
          stroke-miterlimit: 10;
          animation: checkmark-scale 0.3s ease-in-out 0.55s both;
        }
        .checkmark-circle {
          stroke: #22c55e;
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          animation: checkmark-stroke 0.55s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark-check {
          stroke: #22c55e;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: checkmark-stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.55s forwards;
        }
        @keyframes checkmark-stroke {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes checkmark-scale {
          0%, 100% { transform: none; }
          50% { transform: scale3d(1.1, 1.1, 1); }
        }
      `}</style>
    </div>
  )
}
