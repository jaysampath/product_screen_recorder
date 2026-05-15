import { useEffect, useRef, useCallback } from 'react'

// Each ripple entry lives until all three animations finish (900ms total).
// duration field is the max lifetime so the filter knows when to prune.
const RIPPLE_LIFETIME = 900

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

const SIZE_SCALE = { small: 0.6, medium: 1.0, large: 1.5 }

export default function ClickCanvas() {
  const canvasRef = useRef(null)
  const ripplesRef = useRef([])
  const cursorRef = useRef({ x: -200, y: -200, visible: false })
  const rafRef = useRef(null)
  const settingsRef = useRef({
    showClickRipple: true,
    clickRippleColor: '#f97316',
    rippleSize: 'medium',
    showCursorHighlight: true
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const now = performance.now()
    const s = settingsRef.current
    const scale = SIZE_SCALE[s.rippleSize] ?? 1.0

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    // Cursor highlight — soft ring that follows the cursor during recording
    if (s.showCursorHighlight && cursorRef.current.visible) {
      const cx = cursorRef.current.x
      const cy = cursorRef.current.y
      ctx.beginPath()
      ctx.arc(cx, cy, 20, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.20)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Prune expired ripples
    ripplesRef.current = ripplesRef.current.filter(
      (r) => now - r.startTime < RIPPLE_LIFETIME
    )

    if (s.showClickRipple) {
      for (const ripple of ripplesRef.current) {
        const elapsed = now - ripple.startTime
        const px = ripple.x
        const py = ripple.y
        const color = ripple.button === 'right' ? '#a855f7' : s.clickRippleColor

        // 1. Center dot — radius 5, solid fill, fades out over 300ms
        if (elapsed < 300) {
          const alpha = 1 - elapsed / 300
          ctx.beginPath()
          ctx.arc(px, py, 5 * scale, 0, Math.PI * 2)
          ctx.fillStyle = hexToRgba(color, alpha)
          ctx.fill()
        }

        // 2. Primary ripple — radius 8→40, opacity 0.9→0, 600ms, stroke 3px
        if (elapsed < 600) {
          const t = elapsed / 600
          ctx.beginPath()
          ctx.arc(px, py, (8 + t * 32) * scale, 0, Math.PI * 2)
          ctx.strokeStyle = hexToRgba(color, 0.9 * (1 - t))
          ctx.lineWidth = 3 * scale
          ctx.stroke()
        }

        // 3. Secondary ripple — radius 15→65, 30% opacity, 100ms delay, 800ms
        if (elapsed >= 100 && elapsed < 900) {
          const t = (elapsed - 100) / 800
          ctx.beginPath()
          ctx.arc(px, py, (15 + t * 50) * scale, 0, Math.PI * 2)
          ctx.strokeStyle = hexToRgba(color, 0.3 * (1 - t))
          ctx.lineWidth = 2 * scale
          ctx.stroke()
        }
      }
    }

    if (ripplesRef.current.length > 0 || cursorRef.current.visible) {
      rafRef.current = requestAnimationFrame(draw)
    } else {
      rafRef.current = null
    }
  }, [])

  const ensureAnimating = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(draw)
    }
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function handleClick(data) {
      cursorRef.current = { x: data.x, y: data.y, visible: true }
      ripplesRef.current.push({
        x: data.x,
        y: data.y,
        button: data.button,
        startTime: performance.now()
      })
      ensureAnimating()
    }

    function handleCursor(data) {
      cursorRef.current = { x: data.x, y: data.y, visible: true }
      ensureAnimating()
    }

    let clickListener, cursorListener, settingsListener
    if (window.overlay) {
      clickListener = window.overlay.on('click', handleClick)
      cursorListener = window.overlay.on('cursor-move', handleCursor)
      settingsListener = window.overlay.on('overlay-settings', (cfg) => {
        settingsRef.current = {
          showClickRipple: cfg.showClickRipple ?? true,
          clickRippleColor: cfg.clickRippleColor ?? '#f97316',
          rippleSize: cfg.rippleSize ?? 'medium',
          showCursorHighlight: cfg.showCursorHighlight ?? true
        }
      })
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (window.overlay) {
        if (clickListener) window.overlay.off('click', clickListener)
        if (cursorListener) window.overlay.off('cursor-move', cursorListener)
        if (settingsListener) window.overlay.off('overlay-settings', settingsListener)
      }
      cursorRef.current = { x: -200, y: -200, visible: false }
    }
  }, [ensureAnimating])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: 'transparent'
      }}
    />
  )
}
