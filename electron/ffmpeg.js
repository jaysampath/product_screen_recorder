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
    fluentFfmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`))
        return
      }

      const videoStream = (metadata.streams || []).find((s) => s.codec_type === 'video') || {}
      const format = metadata.format || {}

      let fps = 30
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number)
        if (den && den !== 0) fps = Math.round(num / den)
      }

      resolve({
        duration: parseFloat(format.duration) || 0,
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

export function convertToMp4(inputPath, outputPath, onProgress) {
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

    const proc = fluentFfmpeg(inputPath)
      .videoCodec('libx264')
      .addOption('-crf', '23')
      .addOption('-preset', 'fast')
      .audioCodec('aac')
      .audioBitrate('128k')
      .addOption('-movflags', '+faststart')
      .output(outputPath)
      .on('progress', (progress) => {
        if (onProgress) {
          onProgress({
            percent: Math.min(100, Math.round(progress.percent || 0)),
            timemark: progress.timemark || '00:00:00'
          })
        }
      })
      .on('end', () => {
        activeProcesses.delete(outputPath)
        resolve({ success: true, outputPath, duration: null })
      })
      .on('error', (err) => {
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
