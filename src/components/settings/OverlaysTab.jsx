import React from 'react'

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

function Slider({ min, max, step, value, onChange, format }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-10 text-right flex-shrink-0">{format(min)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 rounded-full cursor-pointer appearance-none"
        style={{ accentColor: '#3b82f6' }}
      />
      <span className="text-xs text-gray-600 w-10 flex-shrink-0">{format(max)}</span>
      <span className="text-xs text-blue-400 w-12 text-right flex-shrink-0 font-mono">{format(value)}</span>
    </div>
  )
}

const RIPPLE_COLORS = [
  { label: 'Orange', value: '#f97316' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
]

const RIPPLE_SIZES = ['small', 'medium', 'large']

const RIPPLE_PX = { small: { outer: 24, inner: 10 }, medium: { outer: 40, inner: 16 }, large: { outer: 56, inner: 24 } }

function PreviewBox({ recording }) {
  const color = recording.clickRippleColor
  const size = RIPPLE_PX[recording.rippleSize] || RIPPLE_PX.medium

  return (
    <div
      className="rounded-lg overflow-hidden relative flex items-center justify-center select-none"
      style={{
        width: 200,
        height: 120,
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="absolute top-2 left-2 text-[10px] text-gray-600">Preview</span>

      {recording.showClickRipple ? (
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full animate-ping"
            style={{
              width: size.outer,
              height: size.outer,
              background: color,
              opacity: 0.5,
              animationDuration: '1s',
            }}
          />
          <div
            className="relative rounded-full"
            style={{ width: size.inner, height: size.inner, background: color, opacity: 0.9 }}
          />
        </div>
      ) : recording.autoZoom ? (
        <span className="text-xs text-gray-500">Zoom active</span>
      ) : (
        <span className="text-xs text-gray-600">No overlays</span>
      )}
    </div>
  )
}

export default function OverlaysTab({ settings, setSetting }) {
  const { recording } = settings

  return (
    <div className="space-y-8">
      {/* Click Ripple */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-white">Click Ripple</div>
            <div className="text-xs text-gray-500 mt-0.5">Animate mouse clicks during recording</div>
          </div>
          <Toggle
            checked={recording.showClickRipple}
            onChange={v => setSetting('recording.showClickRipple', v)}
          />
        </div>

        {recording.showClickRipple && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Color</SectionLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {RIPPLE_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setSetting('recording.clickRippleColor', c.value)}
                    title={c.label}
                    className="rounded-full transition-transform hover:scale-110 flex-shrink-0"
                    style={{
                      width: 26,
                      height: 26,
                      background: c.value,
                      outline: recording.clickRippleColor === c.value ? '2px solid white' : 'none',
                      outlineOffset: 2,
                      border: c.value === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    }}
                  />
                ))}
                <label
                  className="flex items-center justify-center rounded-full cursor-pointer text-gray-400 hover:text-white transition-colors flex-shrink-0 relative"
                  style={{
                    width: 26,
                    height: 26,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={recording.clickRippleColor}
                    onChange={e => setSetting('recording.clickRippleColor', e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <svg className="w-3 h-3 relative z-10 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </label>
              </div>
            </div>

            <div>
              <SectionLabel>Size</SectionLabel>
              <div className="flex gap-2">
                {RIPPLE_SIZES.map(s => {
                  const isActive = recording.rippleSize === s
                  return (
                    <button
                      key={s}
                      onClick={() => setSetting('recording.rippleSize', s)}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                      style={{
                        background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                        color: isActive ? '#fff' : 'rgba(156,163,175,1)',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Preview</SectionLabel>
              <PreviewBox recording={recording} />
            </div>
          </div>
        )}
      </div>

      {/* Keystroke Overlay */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Keystroke Overlay</div>
          <div className="text-xs text-gray-500 mt-0.5">Show keys pressed during recording</div>
        </div>
        <Toggle
          checked={recording.showKeystrokeOverlay}
          onChange={v => setSetting('recording.showKeystrokeOverlay', v)}
        />
      </div>

      {/* Cursor Highlight */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Cursor Highlight</div>
          <div className="text-xs text-gray-500 mt-0.5">Highlight the cursor while recording</div>
        </div>
        <Toggle
          checked={recording.showCursorHighlight}
          onChange={v => setSetting('recording.showCursorHighlight', v)}
        />
      </div>

      {/* Auto Zoom */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-white">Auto Zoom</div>
            <div className="text-xs text-gray-500 mt-0.5">Zoom in on clicks automatically</div>
          </div>
          <Toggle
            checked={recording.autoZoom}
            onChange={v => setSetting('recording.autoZoom', v)}
          />
        </div>

        {recording.autoZoom && (
          <div
            className="space-y-4 rounded-lg p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div>
              <div className="text-xs text-gray-400 mb-2">Zoom Level</div>
              <Slider
                min={1.5} max={3.0} step={0.1}
                value={recording.zoomLevel}
                onChange={v => setSetting('recording.zoomLevel', v)}
                format={v => `${v.toFixed(1)}x`}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Zoom In Speed</div>
              <Slider
                min={0.2} max={0.8} step={0.05}
                value={recording.zoomInDuration}
                onChange={v => setSetting('recording.zoomInDuration', v)}
                format={v => `${v.toFixed(2)}s`}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Hold Duration</div>
              <Slider
                min={0.3} max={1.5} step={0.1}
                value={recording.holdDuration}
                onChange={v => setSetting('recording.holdDuration', v)}
                format={v => `${v.toFixed(1)}s`}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Zoom Out Speed</div>
              <Slider
                min={0.2} max={0.8} step={0.05}
                value={recording.zoomOutDuration}
                onChange={v => setSetting('recording.zoomOutDuration', v)}
                format={v => `${v.toFixed(2)}s`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
