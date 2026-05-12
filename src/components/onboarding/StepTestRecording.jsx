import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRecorder } from '../../hooks/useRecorder'

function RecordDots({ remaining, total = 5 }) {
  return (
    <div className="flex gap-2 justify-center my-4">
      {Array.from({ length: total }).map((_, i) => {
        const active = i < remaining
        return (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: active ? '#ef4444' : 'rgba(255,255,255,0.12)',
              transition: 'background 300ms'
            }}
          />
        )
      })}
    </div>
  )
}

function Spinner() {
  return (
    <div
      className="w-8 h-8 rounded-full border-2 border-t-white mx-auto my-4"
      style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }}
    />
  )
}

function CheckRow({ label }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(34,197,94,0.15)' }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 4l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-xs text-gray-300">{label}</span>
    </div>
  )
}

export default function StepTestRecording({ onNext }) {
  const [phase, setPhase] = useState('idle')
  const [preCount, setPreCount] = useState(3)
  const [recCount, setRecCount] = useState(5)
  const [source, setSource] = useState(null)
  const timerRef = useRef(null)
  const { startRecording, stopRecording, status } = useRecorder()

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => clearTimer(), [])

  // Watch for processing → done transition
  useEffect(() => {
    if (phase === 'processing' && (status === 'done' || status === 'idle')) {
      setPhase('success')
    } else if (phase === 'processing' && status === 'error') {
      setPhase('error')
    }
  }, [status, phase])

  const beginRecording = useCallback(async (sourceId) => {
    try {
      await startRecording(sourceId)
      setRecCount(5)
      setPhase('recording')

      let count = 5
      timerRef.current = setInterval(() => {
        count--
        setRecCount(count)
        if (count <= 0) {
          clearTimer()
          stopRecording().catch(() => setPhase('error'))
          setPhase('processing')
        }
      }, 1000)
    } catch {
      setPhase('error')
    }
  }, [startRecording, stopRecording])

  const startTest = useCallback(async () => {
    setPhase('pre')
    try {
      const src = await window.electron.invoke('get-primary-screen-source')
      setSource(src)
      setPreCount(3)
      setPhase('countdown')

      let count = 3
      timerRef.current = setInterval(() => {
        count--
        setPreCount(count)
        if (count <= 0) {
          clearTimer()
          beginRecording(src.id)
        }
      }, 1000)
    } catch {
      setPhase('error')
    }
  }, [beginRecording])

  const retry = () => {
    clearTimer()
    setPhase('idle')
    setPreCount(3)
    setRecCount(5)
    setSource(null)
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-[26px] font-semibold text-white mb-1.5 tracking-tight">
        Let's do a quick test
      </h2>
      <p className="text-gray-400 text-[14px] mb-8">
        We'll record for 5 seconds to verify everything works
      </p>

      {phase === 'idle' && (
        <button
          onClick={startTest}
          className="flex items-center gap-3 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          style={{ height: 52, fontSize: 15 }}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Start 5-Second Test
        </button>
      )}

      {phase === 'pre' && (
        <div className="flex items-center gap-2 text-gray-400">
          <div
            className="w-4 h-4 rounded-full border-2 border-t-blue-400"
            style={{ animation: 'spin 0.8s linear infinite', borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#60a5fa' }}
          />
          <span className="text-sm">Preparing screen capture…</span>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-400 mb-3">Recording in…</p>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center relative"
            style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.25)' }}
          >
            <span
              className="text-4xl font-bold text-white"
              key={preCount}
              style={{ animation: 'pulse 0.9s ease-in-out' }}
            >
              {preCount}
            </span>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-medium text-white">Recording…</span>
          </div>
          <div
            className="w-full rounded-xl p-4 mb-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-3xl font-bold text-white mb-1">{recCount}</p>
            <p className="text-xs text-gray-500">seconds remaining</p>
            <RecordDots remaining={recCount} />
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-3">
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <Spinner />
          <p className="text-sm text-gray-400">Processing…</p>
        </div>
      )}

      {phase === 'success' && (
        <div className="flex flex-col items-center w-full gap-4">
          {source?.thumbnail && (
            <div
              className="w-full rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)', maxHeight: 140 }}
            >
              <img
                src={source.thumbnail}
                alt="Screen preview"
                className="w-full object-cover"
                style={{ maxHeight: 140, objectPosition: 'top' }}
              />
            </div>
          )}
          <div
            className="w-full rounded-xl px-5 py-4 text-left"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
          >
            <p className="text-sm font-semibold text-green-400 mb-2.5">✅ Everything's working!</p>
            <CheckRow label="Click highlights" />
            <CheckRow label="Keystroke overlay" />
            <CheckRow label="Audio" />
          </div>
          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            style={{ height: 48, fontSize: 15 }}
          >
            Continue
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div
            className="w-full rounded-xl px-5 py-4"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            <p className="text-sm text-red-400">Something didn't work as expected</p>
            <p className="text-xs text-gray-500 mt-1">Check that screen recording permission is granted</p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={retry}
              className="flex-1 rounded-xl font-medium text-white text-sm transition-colors"
              style={{ height: 44, background: '#3b82f6' }}
            >
              Try Again
            </button>
            <button
              onClick={onNext}
              className="flex-1 rounded-xl font-medium text-sm transition-colors"
              style={{ height: 44, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
            >
              Skip Test →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
