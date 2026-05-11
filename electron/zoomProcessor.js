import fluentFfmpeg from 'fluent-ffmpeg'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

function fixAsarPath(p) {
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p
}

fluentFfmpeg.setFfmpegPath(fixAsarPath(ffmpegStaticPath))
fluentFfmpeg.setFfprobePath(fixAsarPath(ffprobeStatic.path))

const MERGE_DISTANCE_SEC = 1.5

function mergeOverlappingZooms(events, fps, timing) {
  if (events.length === 0) return []

  const mergeDistFrames = Math.round(MERGE_DISTANCE_SEC * fps)

  const windows = events.map((e) => ({
    startFrame: Math.max(0, e.frame - timing.zoomInFrames),
    peakFrame: e.frame,
    holdEndFrame: e.frame + timing.holdFrames,
    endFrame: e.frame + timing.holdFrames + timing.zoomOutFrames,
    cx: e.cx,
    cy: e.cy,
    peakZoom: timing.peakZoom
  }))

  windows.sort((a, b) => a.startFrame - b.startFrame)

  const merged = []
  let cur = { ...windows[0] }

  for (let i = 1; i < windows.length; i++) {
    const w = windows[i]
    if (w.startFrame <= cur.endFrame + mergeDistFrames) {
      cur.cx = Math.round((cur.cx + w.cx) / 2)
      cur.cy = Math.round((cur.cy + w.cy) / 2)
      cur.endFrame = Math.max(cur.endFrame, w.endFrame)
      cur.holdEndFrame = Math.max(cur.holdEndFrame, w.holdEndFrame)
    } else {
      merged.push(cur)
      cur = { ...w }
    }
  }
  merged.push(cur)

  return merged
}

function buildZoompanFilter(zoomWindows, videoWidth, videoHeight, fps) {
  function windowZExpr(w) {
    const inDur = w.peakFrame - w.startFrame
    const outDur = w.endFrame - w.holdEndFrame
    const zIn =
      inDur > 0
        ? `(1+${w.peakZoom - 1}*(in-${w.startFrame})/${inDur})`
        : `${w.peakZoom}`
    const zOut =
      outDur > 0
        ? `(${w.peakZoom}-${w.peakZoom - 1}*(in-${w.holdEndFrame})/${outDur})`
        : '1'
    return `if(lte(in,${w.peakFrame - 1}),${zIn},if(lte(in,${w.holdEndFrame - 1}),${w.peakZoom},${zOut}))`
  }

  const zExpr = zoomWindows.reduceRight(
    (acc, w) =>
      `if(between(in,${w.startFrame},${w.endFrame - 1}),${windowZExpr(w)},${acc})`,
    '1'
  )

  const xExpr = zoomWindows.reduceRight(
    (acc, w) =>
      `if(between(in,${w.startFrame},${w.endFrame - 1}),clip(${w.cx}-iw/zoom/2,0,iw-iw/zoom),${acc})`,
    '(iw-iw/zoom)/2'
  )

  const yExpr = zoomWindows.reduceRight(
    (acc, w) =>
      `if(between(in,${w.startFrame},${w.endFrame - 1}),clip(${w.cy}-ih/zoom/2,0,ih-ih/zoom),${acc})`,
    '(ih-ih/zoom)/2'
  )

  return `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:fps=${fps}:s=${videoWidth}x${videoHeight}`
}

export async function processZoom(
  inputPath,
  outputPath,
  clickEvents,
  screenDimensions,
  videoMetadata,
  settings,
  onProgress
) {
  const { width: vw, height: vh, fps, duration } = videoMetadata
  const { width: sw, height: sh } = screenDimensions

  if (duration < 1 || clickEvents.length === 0) {
    return { success: true, outputPath: inputPath, zoomCount: 0 }
  }

  const lastSafeFrame = Math.floor((duration - 0.5) * fps)
  const safeClicks = clickEvents.filter(
    (e) => e.type === 'click' && e.frame <= lastSafeFrame
  )

  if (safeClicks.length === 0) {
    return { success: true, outputPath: inputPath, zoomCount: 0 }
  }

  const normalized = safeClicks.map((e) => ({
    ...e,
    cx: Math.round((e.x / sw) * vw),
    cy: Math.round((e.y / sh) * vh)
  }))

  const peakZoom = settings?.zoomLevel ?? 2.0
  const timing = {
    zoomInFrames:
      settings?.zoomInDuration != null
        ? Math.floor(fps * settings.zoomInDuration)
        : Math.floor(fps * 0.3),
    holdFrames:
      settings?.holdDuration != null
        ? Math.floor(fps * settings.holdDuration)
        : Math.floor(fps * 0.5),
    zoomOutFrames:
      settings?.zoomOutDuration != null
        ? Math.floor(fps * settings.zoomOutDuration)
        : Math.floor(fps * 0.3),
    peakZoom
  }

  const zoomWindows = mergeOverlappingZooms(normalized, fps, timing)
  if (zoomWindows.length === 0) {
    return { success: true, outputPath: inputPath, zoomCount: 0 }
  }

  const zoomFilter = buildZoompanFilter(zoomWindows, vw, vh, fps)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  return new Promise((resolve, reject) => {
    fluentFfmpeg(inputPath)
      .videoFilter(zoomFilter)
      .videoCodec('libx264')
      .addOption('-crf', '23')
      .addOption('-preset', 'fast')
      .audioCodec('copy')
      .addOption('-movflags', '+faststart')
      .output(outputPath)
      .on('progress', (p) => {
        if (onProgress) {
          onProgress({
            percent: Math.min(100, Math.round(p.percent || 0)),
            timemark: p.timemark || '00:00:00'
          })
        }
      })
      .on('end', () => resolve({ success: true, outputPath, zoomCount: zoomWindows.length }))
      .on('error', (err) => reject(new Error(`Zoom processing failed: ${err.message}`)))
      .run()
  })
}
