import fs from 'fs'
import { getVideoMetadata, extractThumbnail, convertToMp4 } from './ffmpeg.js'
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
    'Applying zoom effects',
    'Converting to MP4',
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

  // Stage 2 — Zoom (5→50%) — skipped if autoZoom disabled
  const zoomedPath = webmPath.replace('.webm', '-zoomed.webm')
  const clickEvents = clickStore.exportForFFmpeg(recordingStartTime, effectiveMetadata.fps)
  console.log('[processor] autoZoom:', settings?.recording?.autoZoom, '| clickEvents captured:', clickEvents.length)

  if (settings?.recording?.autoZoom) {
    console.log('[processor] Stage 2: Applying zoom effects...')
    onProgress({ stage: 1, stageName: stages[1], stageProgress: 0, overallPercent: 5 })
    const zoomResult = await processZoom(
      webmPath,
      zoomedPath,
      clickEvents,
      { width: screenWidth, height: screenHeight },
      effectiveMetadata,
      settings.recording,
      (p) => {
        console.log('[processor] zoom progress:', p.percent + '%', p.timemark)
        onProgress({
          stage: 1,
          stageName: stages[1],
          stageProgress: p.percent,
          overallPercent: 5 + p.percent * 0.45
        })
      }
    )
    console.log('[processor] Zoom result:', zoomResult)
  } else {
    console.log('[processor] Stage 2: Skipping zoom (autoZoom disabled)')
  }

  const inputForConvert = fs.existsSync(zoomedPath) ? zoomedPath : webmPath
  console.log('[processor] Stage 3: Converting to MP4, input:', inputForConvert)

  // Stage 3 — Convert to MP4 (50→95%)
  const mp4Path = webmPath.replace('.webm', '.mp4')
  onProgress({ stage: 2, stageName: stages[2], stageProgress: 0, overallPercent: 50 })
  await convertToMp4(
    inputForConvert,
    mp4Path,
    (p) => {
      console.log('[processor] convert progress:', p.percent + '%', p.timemark)
      onProgress({
        stage: 2,
        stageName: stages[2],
        stageProgress: p.percent,
        overallPercent: 50 + p.percent * 0.45
      })
    },
    effectiveMetadata.fps
  )
  console.log('[processor] MP4 conversion done:', mp4Path)

  // Stage 4 — Thumbnail (95→100%)
  console.log('[processor] Stage 4: Generating thumbnail...')
  onProgress({ stage: 3, stageName: stages[3], stageProgress: 0, overallPercent: 95 })
  const thumbnail = await extractThumbnail(mp4Path)
  onProgress({ stage: 3, stageName: stages[3], stageProgress: 100, overallPercent: 100 })
  console.log('[processor] Thumbnail generated, length:', thumbnail?.length)

  // Cleanup intermediate files
  if (fs.existsSync(zoomedPath)) {
    console.log('[processor] Cleaning up zoomed intermediate file')
    fs.unlinkSync(zoomedPath)
  }
  if (!settings?.storage?.keepOriginalWebm) {
    try {
      fs.unlinkSync(webmPath)
      console.log('[processor] Original WebM deleted')
    } catch {}
  }

  clickStore.clear()
  console.log('[processor] Processing complete:', mp4Path)

  return {
    mp4Path,
    thumbnail,
    duration: effectiveMetadata.duration,
    fileSize: fs.statSync(mp4Path).size
  }
}
