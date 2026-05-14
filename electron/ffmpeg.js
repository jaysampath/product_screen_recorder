import fluentFfmpeg from 'fluent-ffmpeg'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'

// In a packaged asar, binaries live in app.asar.unpacked — fix the path at runtime
function fixAsarPath(p) {
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p
}

const ffmpegBin = fixAsarPath(ffmpegStaticPath)
const ffprobeBin = fixAsarPath(ffprobeStatic.path)

fluentFfmpeg.setFfmpegPath(ffmpegBin)
fluentFfmpeg.setFfprobePath(ffprobeBin)

// outputPath → fluent-ffmpeg process ref, used for cancellation
const activeProcesses = new Map()

export async function detectHardwareEncoder() {
  return new Promise((resolve) => {
    fluentFfmpeg.getAvailableEncoders((err, encoders) => {
      if (err) return resolve('libx264')
      // Priority order for Windows
      const hwEncoders = ['h264_nvenc', 'h264_amf', 'h264_qsv']
      const available = hwEncoders.find(e => encoders[e])
      resolve(available || 'libx264')
    })
  })
}

export async function getVideoMetadata(filePath) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`File not found: ${filePath}`)
  }

  if (!ffmpegBin) {
    throw new Error('ffmpeg binary missing — run: npm install ffmpeg-static')
  }

  return new Promise((resolve, reject) => {
    // MediaRecorder WebM files don't embed duration in the container header;
    // force ffprobe to scan enough data to derive it from stream content.
    fluentFfmpeg.ffprobe(filePath, ['-analyzeduration', '100M', '-probesize', '100M'], (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`))
        return
      }

      const videoStream = (metadata.streams || []).find((s) => s.codec_type === 'video') || {}
      const format = metadata.format || {}

      let fps = 30
      const tryParseFps = (str) => {
        if (!str) return 0
        const [num, den] = str.split('/').map(Number)
        if (!den || den === 0) return 0
        return num / den
      }
      const avgFps = tryParseFps(videoStream.avg_frame_rate)
      const rFps = tryParseFps(videoStream.r_frame_rate)
      // avg_frame_rate reflects actual content fps; r_frame_rate is often the
      // timebase (1000/1 for MediaRecorder WebM) and must not be used as fps.
      if (avgFps >= 1 && avgFps <= 120) fps = Math.round(avgFps)
      else if (rFps >= 1 && rFps <= 120) fps = Math.round(rFps)

      // Fall back to stream-level duration when format-level duration is absent (common for MediaRecorder WebM)
      const duration = parseFloat(format.duration) || parseFloat(videoStream.duration) || 0

      resolve({
        duration,
        fps,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        size: parseInt(format.size) || 0,
        bitrate: parseInt(format.bit_rate) || 0
      })
    })
  })
}

export async function extractThumbnail(filePath) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`File not found: ${filePath}`)
  }

  if (!ffmpegBin) {
    throw new Error('ffmpeg binary missing — run: npm install ffmpeg-static')
  }

  const metadata = await getVideoMetadata(filePath)
  const seekTime = metadata.duration > 0 && metadata.duration < 2 ? 0.5 : 1

  const tempPath = path.join(os.tmpdir(), `recordqa-thumb-${Date.now()}.jpg`)

  await new Promise((resolve, reject) => {
    fluentFfmpeg(filePath)
      .seekInput(seekTime)
      .frames(1)
      .size('640x360')
      .output(tempPath)
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`Thumbnail extraction failed: ${err.message}`)))
      .run()
  })

  const data = await fs.readFile(tempPath)
  await fs.unlink(tempPath).catch(() => {})
  return `data:image/jpeg;base64,${data.toString('base64')}`
}

export function convertToMp4(inputPath, outputPath, onProgress, fps = null) {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.access(inputPath)
    } catch {
      reject(new Error(`File not found: ${inputPath}`))
      return
    }

    const outputDir = path.dirname(outputPath)
    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch (err) {
      reject(new Error(`Output directory not writable: ${outputDir} — ${err.message}`))
      return
    }

    const encoder = await detectHardwareEncoder()
    const isHW = encoder !== 'libx264'
    console.log('[ffmpeg] convertToMp4 started:', inputPath, '->', outputPath, '| encoder:', encoder)
    const proc = fluentFfmpeg(inputPath)
      .addOption('-y')
      .videoCodec(encoder)
      .addOutputOption(isHW ? '-rc:v vbr -cq:v 23' : '-crf 23 -preset ultrafast')
      .addOutputOption('-movflags +faststart')
      .audioCodec('aac')
      .audioBitrate('128k')

    // Force output fps to prevent WebM 1000/1 timebase causing massive frame duplication
    if (fps && fps >= 1 && fps <= 120) proc.addOutputOption(`-r ${fps}`)

    proc.output(outputPath)
      .on('start', (cmd) => console.log('[ffmpeg] convert command:', cmd))
      .on('stderr', (line) => console.log('[ffmpeg]', line))
      .on('progress', (progress) => {
        console.log('[ffmpeg] convert progress:', progress.percent?.toFixed(1) + '%', progress.timemark)
        if (onProgress) {
          onProgress({
            percent: Math.min(100, Math.round(progress.percent || 0)),
            timemark: progress.timemark || '00:00:00'
          })
        }
      })
      .on('end', () => {
        console.log('[ffmpeg] convertToMp4 complete:', outputPath)
        activeProcesses.delete(outputPath)
        resolve({ success: true, outputPath, duration: null })
      })
      .on('error', (err) => {
        console.error('[ffmpeg] convertToMp4 error:', err.message)
        activeProcesses.delete(outputPath)
        if (err.message?.includes('SIGKILL') || err.message?.includes('killed')) {
          resolve({ success: false, cancelled: true })
        } else {
          reject(new Error(`FFmpeg conversion failed: ${err.message}`))
        }
      })

    activeProcesses.set(outputPath, proc)
    proc.run()
  })
}

export function cancelProcessing(outputPath) {
  const proc = activeProcesses.get(outputPath)
  if (proc) {
    proc.kill('SIGKILL')
    activeProcesses.delete(outputPath)
  }
  fs.unlink(outputPath).catch(() => {})
}
