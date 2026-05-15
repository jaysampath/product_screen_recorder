import { useEffect, useRef, useState } from 'react'

const LENS_W = 280
const LENS_H = 200

export default function ZoomLens() {
  const canvasRef = useRef(null)
  const state = useRef({ active: false, x: 0, y: 0, img: null, sw: 1920, sh: 1080, zoom: 2.5 })
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!window.overlay) {
      console.error('[ZoomLens] window.overlay not available')
      return
    }

    state.current.sw = window.innerWidth
    state.current.sh = window.innerHeight

    // Overlay window doesn't have window.electron
    // Zoom level is sent from main process via zoom-toggle event
    // Use 2.5 as default, updated when zoom-toggle fires
    state.current.zoom = 2.5

    const onZoomLevel = window.overlay.on('zoom-level-changed', ({ level }) => {
      state.current.zoom = level
    })

    const onToggle = window.overlay.on('zoom-toggle', ({ active, x, y }) => {
      state.current.active = active
      if (x != null) state.current.x = x
      if (y != null) state.current.y = y
      setVisible(active)
    })

    const onMove = window.overlay.on('zoom-move', ({ x, y }) => {
      state.current.x = x
      state.current.y = y
    })

    const onFrame = window.overlay.on('zoom-frame', ({ dataUrl }) => {
      const img = new Image()
      img.onload = () => { state.current.img = img }
      img.src = dataUrl
    })

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      const { active, x, y, img, sw, sh } = state.current
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!active || !img) return

      const { bx, by } = lensPosition(x, y, sw, sh)

      // Compute source crop in thumbnail image coordinates
      const zoom = state.current.zoom
      const srcW = LENS_W / zoom
      const srcH = LENS_H / zoom
      const ratioX = img.naturalWidth / sw
      const ratioY = img.naturalHeight / sh
      const sx = Math.max(0, (x - srcW / 2) * ratioX)
      const sy = Math.max(0, (y - srcH / 2) * ratioY)
      const sdw = srcW * ratioX
      const sdh = srcH * ratioY

      // Backdrop shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 20
      rrect(ctx, bx, by, LENS_W, LENS_H, 10)
      ctx.fillStyle = '#111'
      ctx.fill()
      ctx.restore()

      // Zoomed image clipped to lens rectangle
      ctx.save()
      rrect(ctx, bx, by, LENS_W, LENS_H, 10)
      ctx.clip()
      ctx.drawImage(img, sx, sy, sdw, sdh, bx, by, LENS_W, LENS_H)
      ctx.restore()

      // White border
      ctx.save()
      rrect(ctx, bx, by, LENS_W, LENS_H, 10)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()

      // Center crosshair
      const cx = bx + LENS_W / 2
      const cy = by + LENS_H / 2
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy)
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10)
      ctx.stroke()
      ctx.restore()

      // zoom level badge
      const badgeText = `${zoom}×`
      const badgeW = 40
      const badgeX = bx + LENS_W - badgeW - 4
      const badgeY = by + 8
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      rrect(ctx, badgeX, badgeY, badgeW, 18, 9)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 9)
      ctx.restore()

      // Orange indicator ring around actual cursor position
      ctx.save()
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.overlay.off('zoom-toggle', onToggle)
      window.overlay.off('zoom-move', onMove)
      window.overlay.off('zoom-frame', onFrame)
      window.overlay.off('zoom-level-changed', onZoomLevel)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    />
  )
}

function lensPosition(x, y, sw, sh) {
  let bx = x + 20
  let by = y - LENS_H - 20
  if (bx + LENS_W > sw - 10) bx = x - LENS_W - 20
  if (by < 10) by = y + 20
  return { bx, by }
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
