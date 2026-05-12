import React, { useState, useEffect, useRef } from 'react'

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

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase mb-3">
      {children}
    </p>
  )
}

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High', desc: 'Best quality, larger files (CRF 18)' },
  { value: 'medium', label: 'Medium', desc: 'Balanced (CRF 23)' },
  { value: 'small', label: 'Small', desc: 'Smaller files (CRF 28)' },
]

export default function RecordingTab({ settings, setSetting }) {
  const { recording } = settings
  const [audioDevices, setAudioDevices] = useState([])
  const [testing, setTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const testTimerRef = useRef(null)

  useEffect(() => {
    if (!recording.includeMic) return
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'))
    })
  }, [recording.includeMic])

  const handleTest = async () => {
    if (testing) return
    setTesting(true)
    setLevel(0)
    try {
      const constraints = recording.micDeviceId
        ? { audio: { deviceId: { exact: recording.micDeviceId } }, video: false }
        : { audio: true, video: false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const max = Math.max(...data)
        setLevel(Math.min(max / 255, 1))
        animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)

      testTimerRef.current = setTimeout(() => {
        cancelAnimationFrame(animRef.current)
        stream.getTracks().forEach(t => t.stop())
        ctx.close()
        streamRef.current = null
        setTesting(false)
        setLevel(0)
      }, 3000)
    } catch {
      setTesting(false)
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current)
      clearTimeout(testTimerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="space-y-8">
      {/* Quality */}
      <div>
        <SectionLabel>Quality</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {QUALITY_OPTIONS.map(opt => {
            const isActive = recording.quality === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setSetting('recording.quality', opt.value)}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  border: `1.5px solid ${isActive ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                  background: isActive ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: isActive ? '#fff' : 'rgba(156,163,175,1)' }}>
                  {opt.label}
                </div>
                <div className="text-[11px] leading-snug" style={{ color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)' }}>
                  {opt.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Frame Rate */}
      <div>
        <SectionLabel>Frame Rate</SectionLabel>
        <div className="flex gap-2">
          {[30, 60].map(fps => {
            const isActive = recording.fps === fps
            return (
              <button
                key={fps}
                onClick={() => setSetting('recording.fps', fps)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#fff' : 'rgba(156,163,175,1)',
                }}
              >
                {fps} fps
              </button>
            )
          })}
        </div>
      </div>

      {/* Audio */}
      <div>
        <SectionLabel>Audio</SectionLabel>
        <div className="space-y-5">
          {/* Desktop Audio */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white">Desktop Audio</div>
              <div className="text-xs text-gray-500 mt-0.5">Capture system sound</div>
            </div>
            <Toggle
              checked={recording.includeDesktopAudio}
              onChange={v => setSetting('recording.includeDesktopAudio', v)}
            />
          </div>

          {/* Microphone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Microphone</div>
                <div className="text-xs text-gray-500 mt-0.5">Record your voice</div>
              </div>
              <Toggle
                checked={recording.includeMic}
                onChange={v => setSetting('recording.includeMic', v)}
              />
            </div>

            {recording.includeMic && (
              <div className="space-y-2 pl-0">
                <select
                  value={recording.micDeviceId || ''}
                  onChange={e => setSetting('recording.micDeviceId', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-gray-300"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    outline: 'none',
                  }}
                >
                  <option value="">Default microphone</option>
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    {testing ? 'Testing…' : 'Test'}
                  </button>
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{
                        width: `${level * 100}%`,
                        transition: 'width 80ms linear',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
