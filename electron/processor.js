import fs from 'fs'
import { getVideoMetadata, extractThumbnail } from './ffmpeg.js'
import { processZoom } from './zoomProcessor.js'
import clickStore from './clickStore.js'

export async function processRecording({
  webmPath,
  recordingStartTime,
  recordingStopTime,
  screenWidth,
  screenHeight,
  settings,
  onProgress
}) {
  console.log('[processor] Starting processRecording:', { webmPath, screenWidth, screenHeight })

  const stages = [
    'Validating recording',
    'Processing video',
    'Generating thumbnail'
  ]

  // Stage 1 — Validate (0→5%)
  console.log('[processor] Stage 1: Validating recording...')
  onProgress({ stage: 0, stageName: stages[0], stageProgress: 0, overallPercent: 0 })
  const metadata = await getVideoMetadata(webmPath)
  console.log('[processor] Video metadata:', metadata)
  if (!metadata.duration || metadata.duration < 0.5) {
    // MediaRecorder WebM may not embed duration even after extended probing;
    // accept the file if it has enough data to be a real recording (>50 KB).
    const { size: fileSize } = fs.statSync(webmPath)
    console.log('[processor] Short/no duration detected, file size:', fileSize)
    if (fileSize < 50_000) {
      throw new Error('Recording too short or corrupted')
    }
  }

  // Use wall-clock times to compute actual duration when WebM metadata lacks it
  const estimatedDuration =
    recordingStopTime && recordingStartTime
      ? (recordingStopTime - recordingStartTime) / 1000
      : 0
  const effectiveMetadata = {
    ...metadata,
    duration: metadata.duration > 0 ? metadata.duration : estimatedDuration
  }
  console.log('[processor] Effective duration:', effectiveMetadata.duration.toFixed(1) + 's | fps:', effectiveMetadata.fps)

  onProgress({ stage: 0, stageName: stages[0], stageProgress: 100, overallPercent: 5 })

  // Stage 2 — Process (5→90%) — zoom + convert combined
  const mp4Path = webmPath.replace('.webm', '.mp4')
  const clickEvents = settings?.recording?.autoZoom
    ? clickStore.exportForFFmpeg(recordingStartTime, effectiveMetadata.fps)
    : []
  console.log('[processor] autoZoom:', settings?.recording?.autoZoom, '| clickEvents captured:', clickEvents.length)
  console.log('[processor] Stage 2: Processing video...')
  onProgress({ stage: 1, stageName: stages[1], stageProgress: 0, overallPercent: 5 })
  const processResult = await processZoom(
    webmPath,
    mp4Path,
    clickEvents,
    { width: screenWidth, height: screenHeight },
    effectiveMetadata,
    settings?.recording,
    (p) => {
      console.log('[processor] process progress:', p.percent + '%', p.timemark)
      onProgress({
        stage: 1,
        stageName: stages[1],
        stageProgress: p.percent,
        overallPercent: 5 + p.percent * 0.85
      })
    }
  )
  console.log('[processor] Processing result:', processResult)

  // Stage 3 — Thumbnail (90→95%)
  console.log('[processor] Stage 3: Generating thumbnail...')
  onProgress({ stage: 2, stageName: stages[2], stageProgress: 0, overallPercent: 90 })
  const thumbnail = await extractThumbnail(mp4Path)
  onProgress({ stage: 2, stageName: stages[2], stageProgress: 100, overallPercent: 95 })
  console.log('[processor] Thumbnail generated, length:', thumbnail?.length)

  // Persist thumbnail as a .jpg sidecar so list-recordings can serve it later
  if (thumbnail) {
    const thumbPath = mp4Path.replace(/\.mp4$/, '.jpg')
    const base64Data = thumbnail.replace(/^data:image\/jpeg;base64,/, '')
    try {
      fs.writeFileSync(thumbPath, Buffer.from(base64Data, 'base64'))
      console.log('[processor] Thumbnail saved to', thumbPath)
    } catch (e) {
      console.warn('[processor] Failed to save thumbnail sidecar:', e.message)
    }
  }

  // Cleanup (95→100%)
  if (!settings?.storage?.keepOriginalWebm) {
    try {
      fs.unlinkSync(webmPath)
      console.log('[processor] Original WebM deleted')
    } catch {}
  }
  onProgress({ stage: 2, stageName: stages[2], stageProgress: 100, overallPercent: 100 })

  clickStore.clear()
  console.log('[processor] Processing complete:', mp4Path)

  return {
    mp4Path,
    thumbnail,
    duration: effectiveMetadata.duration,
    fileSize: fs.statSync(mp4Path).size
  }
}
