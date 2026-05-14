import { useState, useRef, useCallback, useEffect } from 'react'

function generateFilename() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `recordqa-${date}-${time}.webm`
}

export function useRecorder() {
  const [status, setStatus] = useState('idle')
  const [duration, setDuration] = useState(0)
  const [fileSize, setFileSize] = useState(0)
  const [outputPath, setOutputPath] = useState(null)
  const [error, setError] = useState(null)
  const [processingProgress, setProcessingProgress] = useState(null)
  const [processingResult, setProcessingResult] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamsRef = useRef([])
  const audioCtxRef = useRef(null)
  const timerRef = useRef(null)
  const durationRef = useRef(0)
  const fileSizeRef = useRef(0)
  const stopResolveRef = useRef(null)
  const stopRejectRef = useRef(null)
  const recordingStartTimeRef = useRef(null)
  const recordingStopTimeRef = useRef(null)
  const processingWebmPathRef = useRef(null)

  const sendTick = useCallback((tickStatus) => {
    window.electron.send('recording-tick', {
      duration: durationRef.current,
      fileSize: fileSizeRef.current,
      status: tickStatus
    })
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    for (const stream of streamsRef.current) {
      stream.getTracks().forEach((t) => t.stop())
    }
    streamsRef.current = []
    chunksRef.current = []
    mediaRecorderRef.current = null
    durationRef.current = 0
    fileSizeRef.current = 0
  }, [])

  const startRecording = useCallback(
    async (sourceId, options = {}) => {
      if (status !== 'idle' && status !== 'done') return
      setError(null)
      recordingStartTimeRef.current = Date.now()

      try {
        const desktopStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
              minFrameRate: 30,
              maxFrameRate: 60
            }
          }
        })
        streamsRef.current.push(desktopStream)

        let micStream = null
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          streamsRef.current.push(micStream)
        } catch {
          // mic unavailable or denied — continue without it
        }

        const videoTracks = desktopStream.getVideoTracks()
        const desktopAudioTracks = desktopStream.getAudioTracks()
        const micAudioTracks = micStream ? micStream.getAudioTracks() : []
        const allAudioTracks = [...desktopAudioTracks, ...micAudioTracks]

        let finalStream
        if (allAudioTracks.length > 1) {
          const audioCtx = new AudioContext()
          audioCtxRef.current = audioCtx
          const destination = audioCtx.createMediaStreamDestination()
          for (const track of allAudioTracks) {
            audioCtx.createMediaStreamSource(new MediaStream([track])).connect(destination)
          }
          finalStream = new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()])
        } else if (allAudioTracks.length === 1) {
          finalStream = new MediaStream([...videoTracks, ...allAudioTracks])
        } else {
          finalStream = new MediaStream(videoTracks)
        }

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'

        chunksRef.current = []
        fileSizeRef.current = 0

        const recorder = new MediaRecorder(finalStream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data)
            fileSizeRef.current += e.data.size
            setFileSize(fileSizeRef.current)
          }
        }

        recorder.onstop = async () => {
          console.log('[recorder] onstop fired — stopping overlay and beginning save')
          window.electron.send('hide-overlay')
          let removeProgressListener = null
          try {
            sendTick('processing')
            setStatus('processing')
            console.log('[recorder] Building blob from', chunksRef.current.length, 'chunks, total size estimate:', fileSizeRef.current, 'bytes')
            const blob = new Blob(chunksRef.current, { type: mimeType })
            console.log('[recorder] Blob built, size:', blob.size, 'bytes — converting to ArrayBuffer...')
            const arrayBuffer = await blob.arrayBuffer()
            console.log('[recorder] ArrayBuffer ready, size:', arrayBuffer.byteLength, '— invoking save-recording IPC')
            const filename = generateFilename()
            const saveResult = await window.electron.invoke('save-recording', {
              buffer: arrayBuffer,
              filename
            })
            console.log('[recorder] save-recording result:', saveResult)
            if (!saveResult.success) throw new Error(saveResult.error)

            processingWebmPathRef.current = saveResult.filePath
            setProcessingProgress({ stage: 0, stageName: 'Starting...', stageProgress: 0, overallPercent: 0 })

            removeProgressListener = window.electron.on('processing-progress', (progress) => {
              console.log('[recorder] processing-progress:', progress)
              setProcessingProgress(progress)
            })

            console.log('[recorder] Invoking start-processing for', saveResult.filePath)
            const procResult = await window.electron.invoke('start-processing', {
              webmPath: saveResult.filePath,
              recordingStartTime: recordingStartTimeRef.current,
              recordingStopTime: recordingStopTimeRef.current,
              screenWidth: window.screen.width,
              screenHeight: window.screen.height
            })
            console.log('[recorder] start-processing complete:', procResult)

            setProcessingResult(procResult)
            setOutputPath(procResult.mp4Path)
            setStatus('done')
            stopResolveRef.current?.(procResult)
          } catch (err) {
            console.error('[recorder] onstop error:', err)
            const message = err.message || 'Failed to process recording'
            setError(message)
            setStatus('idle')
            setProcessingProgress(null)
            stopRejectRef.current?.(new Error(message))
          } finally {
            removeProgressListener?.()
            cleanup()
            stopResolveRef.current = null
            stopRejectRef.current = null
          }
        }

        recorder.onerror = (e) => {
          const message = e.error?.message || 'Recording error'
          setError(message)
          setStatus('idle')
          cleanup()
        }

        // collect data every second for live size estimate
        recorder.start(1000)
        console.log('[recorder] MediaRecorder started, sending show-overlay')
        window.electron.send('show-overlay')
        setStatus('recording')
        setDuration(0)
        setFileSize(0)
        setOutputPath(null)
        durationRef.current = 0
        fileSizeRef.current = 0

        timerRef.current = setInterval(() => {
          durationRef.current += 1
          setDuration(durationRef.current)
          sendTick('recording')
        }, 1000)
      } catch (err) {
        let message = err.message || 'Failed to start recording'
        if (err.name === 'NotAllowedError') {
          const isMac = window.electron.platform === 'darwin'
          message = isMac
            ? 'Screen recording permission denied. Open System Preferences > Privacy & Security > Screen Recording and allow this app.'
            : 'Screen recording permission denied.'
          if (isMac) {
            window.electron.invoke('open-privacy-settings').catch(() => {})
          }
        } else if (err.name === 'NotFoundError') {
          message = 'Recording source not found. Please select a valid screen or window.'
        }
        setError(message)
        setStatus('idle')
        cleanup()
      }
    },
    [status, cleanup, sendTick]
  )

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      clearInterval(timerRef.current)
      timerRef.current = null
      setStatus('paused')
      sendTick('paused')
    }
  }, [sendTick])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration(durationRef.current)
        sendTick('recording')
      }, 1000)
      setStatus('recording')
    }
  }, [sendTick])

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recording'))
        return
      }
      stopResolveRef.current = resolve
      stopRejectRef.current = reject
      clearInterval(timerRef.current)
      timerRef.current = null
      recordingStopTimeRef.current = Date.now()
      recorder.stop()
    })
  }, [])

  const cancelProcessing = useCallback(async () => {
    const webmPath = processingWebmPathRef.current
    if (webmPath) {
      const outputPath = webmPath.replace('.webm', '.mp4')
      try {
        await window.electron.invoke('ffmpeg-cancel', { outputPath })
      } catch {}
    }
    setProcessingProgress(null)
    setProcessingResult(null)
    setStatus('idle')
  }, [])

  const resetProcessing = useCallback(() => {
    setProcessingProgress(null)
    setProcessingResult(null)
  }, [])

  const discardRecording = useCallback(() => {
    console.log('[recorder] discardRecording called')
    window.electron.send('hide-overlay')
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      // skip save in onstop
      recorder.onstop = () => cleanup()
      recorder.stop()
    } else {
      cleanup()
    }
    setStatus('idle')
    setDuration(0)
    setFileSize(0)
    setOutputPath(null)
    setError(null)
  }, [cleanup])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    status,
    duration,
    fileSize,
    outputPath,
    error,
    processingProgress,
    processingResult,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    cancelProcessing,
    resetProcessing
  }
}
