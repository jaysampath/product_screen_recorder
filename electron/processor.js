import fs from 'fs'
import { getVideoMetadata, extractThumbnail, convertToMp4 } from './ffmpeg.js'
import { processZoom } from './zoomProcessor.js'
import clickStore from './clickStore.js'

export async function processRecording({
  webmPath,
  recordingStartTime,
  screenWidth,
  screenHeight,
  settings,
  onProgress
}) {
  const stages = [
    'Validating recording',
    'Applying zoom effects',
    'Converting to MP4',
    'Generating thumbnail'
  ]

  // Stage 1 — Validate (0→5%)
  onProgress({ stage: 0, stageName: stages[0], stageProgress: 0, overallPercent: 0 })
  const metadata = await getVideoMetadata(webmPath)
  if (!metadata.duration || metadata.duration < 0.5) {
    // MediaRecorder WebM may not embed duration even after extended probing;
    // accept the file if it has enough data to be a real recording (>50 KB).
    const { size: fileSize } = fs.statSync(webmPath)
    if (fileSize < 50_000) {
      throw new Error('Recording too short or corrupted')
    }
  }
  onProgress({ stage: 0, stageName: stages[0], stageProgress: 100, overallPercent: 5 })

  // Stage 2 — Zoom (5→50%) — skipped if autoZoom disabled
  const zoomedPath = webmPath.replace('.webm', '-zoomed.webm')
  if (settings?.recording?.autoZoom) {
    onProgress({ stage: 1, stageName: stages[1], stageProgress: 0, overallPercent: 5 })
    const clickEvents = clickStore.exportForFFmpeg(recordingStartTime, metadata.fps)
    await processZoom(
      webmPath,
      zoomedPath,
      clickEvents,
      { width: screenWidth, height: screenHeight },
      metadata,
      settings.recording,
      (p) =>
        onProgress({
          stage: 1,
          stageName: stages[1],
          stageProgress: p.percent,
          overallPercent: 5 + p.percent * 0.45
        })
    )
  }

  const inputForConvert = fs.existsSync(zoomedPath) ? zoomedPath : webmPath

  // Stage 3 — Convert to MP4 (50→95%)
  const mp4Path = webmPath.replace('.webm', '.mp4')
  onProgress({ stage: 2, stageName: stages[2], stageProgress: 0, overallPercent: 50 })
  await convertToMp4(
    inputForConvert,
    mp4Path,
    (p) =>
      onProgress({
        stage: 2,
        stageName: stages[2],
        stageProgress: p.percent,
        overallPercent: 50 + p.percent * 0.45
      })
  )

  // Stage 4 — Thumbnail (95→100%)
  onProgress({ stage: 3, stageName: stages[3], stageProgress: 0, overallPercent: 95 })
  const thumbnail = await extractThumbnail(mp4Path)
  onProgress({ stage: 3, stageName: stages[3], stageProgress: 100, overallPercent: 100 })

  // Cleanup intermediate files
  if (fs.existsSync(zoomedPath)) fs.unlinkSync(zoomedPath)
  if (!settings?.storage?.keepOriginalWebm) {
    try {
      fs.unlinkSync(webmPath)
    } catch {}
  }

  clickStore.clear()

  return {
    mp4Path,
    thumbnail,
    duration: metadata.duration,
    fileSize: fs.statSync(mp4Path).size
  }
}
