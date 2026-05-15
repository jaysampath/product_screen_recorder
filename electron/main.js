import {
  app,
  BrowserWindow,
  screen,
  session,
  ipcMain,
  desktopCapturer,
  shell,
  protocol,
  net,
  globalShortcut,
  dialog,
  systemPreferences
} from 'electron'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import os from 'os'
import { is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { startClickTracking, stopClickTracking } from './recorder.js'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import clickStore from './clickStore.js'
import { getVideoMetadata, extractThumbnail, convertToMp4, cancelProcessing } from './ffmpeg.js'
import { processZoom } from './zoomProcessor.js'
import { processRecording } from './processor.js'
import { initUpdater } from './updater.js'

const store = new Store({
  defaults: {
    recording: {
      quality: 'high',
      fps: 60,
      includeDesktopAudio: true,
      includeMic: false,
      micDeviceId: null,
      showClickRipple: true,
      clickRippleColor: '#f97316',
      rippleSize: 'medium',
      showKeystrokeOverlay: true,
      showCursorHighlight: true,
      autoZoom: true,
      zoomLevel: 2.0,
      zoomInDuration: 0.3,
      holdDuration: 0.5,
      zoomOutDuration: 0.3,
    },
    storage: {
      outputDirectory: null,
      keepOriginalWebm: false,
      autoDeleteAfterDays: 0,
    },
    ui: {
      controlBarPosition: null,
      libraryView: 'grid',
    },
    shortcuts: {
      startStop: 'CommandOrControl+Shift+R',
      pauseResume: 'CommandOrControl+Shift+P',
      discard: 'CommandOrControl+Shift+D',
    },
    onboarding: {
      completed: false,
      completedAt: null,
    },
  },
})

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const resourcesPath = isDev ? join(__dirname, '..') : process.resourcesPath

let mainWindow = null
let overlayWindow = null
let controlBarWindow = null
let isRecording = false
let isZoomActive = false
let currentMouseX = 0
let currentMouseY = 0
let zoomCaptureInterval = null
const heldModifiers = new Set()

// ── Position persistence (no electron-store needed) ─────────────────────────

async function loadControlBarPosition() {
  try {
    const p = join(app.getPath('userData'), 'controlbar-pos.json')
    const raw = await fs.readFile(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function saveControlBarPosition(x, y) {
  try {
    const p = join(app.getPath('userData'), 'controlbar-pos.json')
    await fs.writeFile(p, JSON.stringify({ x, y }))
  } catch {}
}

// ── Window factories ─────────────────────────────────────────────────────────

function createOverlayWindow() {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/overlayPreload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/overlay/index.html')
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }

  if (!app.isPackaged) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

// ── Zoom lens helpers ─────────────────────────────────────────────────────────

function startZoomCapture() {
  stopZoomCapture()
  const { width, height } = screen.getPrimaryDisplay().bounds
  zoomCaptureInterval = setInterval(async () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      })
      if (sources.length > 0) {
        const jpegBuf = sources[0].thumbnail.toJPEG(72)
        const dataUrl = 'data:image/jpeg;base64,' + jpegBuf.toString('base64')
        overlayWindow.webContents.send('zoom-frame', { dataUrl })
      }
    } catch {}
  }, 100)
}

function stopZoomCapture() {
  if (zoomCaptureInterval) {
    clearInterval(zoomCaptureInterval)
    zoomCaptureInterval = null
  }
}

function applyZoomToggle(active) {
  isZoomActive = active
  if (active) {
    startZoomCapture()
    const level = store.get('recording.liveZoomLevel', 2.5)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('zoom-level-changed', { level })
    }
  } else {
    stopZoomCapture()
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('zoom-toggle', { active, x: currentMouseX, y: currentMouseY })
  }
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.webContents.send('zoom-state', { active })
  }
}

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } }
])

function getRecordingsDir() {
  return process.platform === 'darwin'
    ? join(os.homedir(), 'Movies', 'RecordQA')
    : join(os.homedir(), 'Videos', 'RecordQA')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy()
    if (controlBarWindow && !controlBarWindow.isDestroyed()) controlBarWindow.destroy()
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC: recordings ──────────────────────────────────────────────────────────

ipcMain.handle('get-recordings-dir', async () => {
  return getRecordingsDir()
})

ipcMain.handle('save-recording', async (_event, { buffer, filename }) => {
  console.log('[main] save-recording invoked, buffer size:', buffer?.byteLength ?? 'unknown', 'filename:', filename)
  try {
    const dir = getRecordingsDir()
    await fs.mkdir(dir, { recursive: true })
    const filePath = join(dir, filename)
    console.log('[main] writing file to:', filePath)
    await fs.writeFile(filePath, Buffer.from(buffer))
    console.log('[main] file written successfully:', filePath)
    return { success: true, filePath }
  } catch (err) {
    const message =
      err.code === 'ENOSPC'
        ? 'Not enough disk space to save recording'
        : `Failed to save recording: ${err.message}`
    return { success: false, error: message }
  }
})

ipcMain.handle('open-privacy-settings', async () => {
  if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  }
})

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 200 },
    fetchWindowIcons: true
  })
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null
  }))
})

ipcMain.handle('list-recordings', async () => {
  const dir = getRecordingsDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    const files = await fs.readdir(dir)

    // Prefer the processed .mp4 when both exist; fall back to .webm-only
    const mp4Bases = new Set(
      files.filter((f) => f.endsWith('.mp4')).map((f) => f.replace(/\.mp4$/, ''))
    )
    const recordingFiles = [
      ...files.filter((f) => f.endsWith('.mp4')),
      ...files.filter((f) => f.endsWith('.webm') && !mp4Bases.has(f.replace(/\.webm$/, '')))
    ]

    const recordings = await Promise.all(
      recordingFiles.map(async (filename) => {
        const filePath = join(dir, filename)
        const stat = await fs.stat(filePath)
        return {
          id: filename.replace(/\.(mp4|webm)$/, ''),
          filename,
          filePath,
          size: stat.size,
          duration: null,
          createdAt: stat.birthtime,
          thumbnail: null
        }
      })
    )
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return recordings
  } catch {
    return []
  }
})

ipcMain.handle('delete-recording', async (_event, { filePath }) => {
  try {
    await shell.trashItem(filePath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('open-in-finder', async (_event, { filePath }) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('get-file-url', async (_event, { filePath }) => {
  const fileUrl = new URL('file:///' + filePath.replace(/\\/g, '/'))
  return fileUrl.href.replace('file://', 'media://')
})

ipcMain.handle('rename-recording', async (_event, { filePath, newName }) => {
  try {
    const dir = dirname(filePath)
    const ext = filePath.endsWith('.mp4') ? '.mp4' : '.webm'
    const sanitized = newName.replace(/[<>:"/\\|?*]/g, '_').trim()
    const base = sanitized.replace(/\.(mp4|webm)$/i, '')
    const newFilename = base + ext
    const newPath = join(dir, newFilename)
    await fs.rename(filePath, newPath)
    return { success: true, newPath, newFilename }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: overlay ─────────────────────────────────────────────────────────────

ipcMain.on('show-overlay', () => {
  console.log('[main] show-overlay received — showing overlay and starting click tracking')
  isRecording = true
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    startClickTracking(overlayWindow)
    // Send current recording settings so the overlay can respect feature toggles/colors
    const recordingSettings = store.get('recording')
    console.log('[main] sending overlay-settings:', recordingSettings)
    overlayWindow.webContents.send('overlay-settings', recordingSettings)
  } else {
    console.warn('[main] show-overlay: overlayWindow is missing or destroyed')
  }
})

ipcMain.on('hide-overlay', () => {
  console.log('[main] hide-overlay received')
  isRecording = false
  heldModifiers.clear()
  stopClickTracking()
  if (isZoomActive) {
    isZoomActive = false
    stopZoomCapture()
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      controlBarWindow.webContents.send('zoom-state', { active: false })
    }
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
})

ipcMain.on('overlay-event', (_event, data) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-event', data)
  }
})

// ── Keystroke capture ────────────────────────────────────────────────────────

const isMac = process.platform === 'darwin'

const MODIFIER_CODES = new Set([
  UiohookKey.Ctrl,
  UiohookKey.CtrlRight,
  UiohookKey.Alt,
  UiohookKey.AltRight,
  UiohookKey.Shift,
  UiohookKey.ShiftRight,
  UiohookKey.Meta,
  UiohookKey.MetaRight
])

const MODIFIER_NAMES = {
  [UiohookKey.Ctrl]: 'Ctrl',
  [UiohookKey.CtrlRight]: 'Ctrl',
  [UiohookKey.Alt]: isMac ? 'Option' : 'Alt',
  [UiohookKey.AltRight]: isMac ? 'Option' : 'Alt',
  [UiohookKey.Shift]: 'Shift',
  [UiohookKey.ShiftRight]: 'Shift',
  [UiohookKey.Meta]: isMac ? 'Cmd' : 'Win',
  [UiohookKey.MetaRight]: isMac ? 'Cmd' : 'Win'
}

const SPECIAL_KEY_MAP = {
  [UiohookKey.Return]: '⏎',
  [UiohookKey.Escape]: '⎋',
  [UiohookKey.Tab]: '⇥',
  [UiohookKey.Backspace]: '⌫',
  [UiohookKey.Delete]: 'Delete',
  [UiohookKey.ArrowUp]: '↑',
  [UiohookKey.ArrowDown]: '↓',
  [UiohookKey.ArrowLeft]: '←',
  [UiohookKey.ArrowRight]: '→',
  [UiohookKey.F1]: 'F1',
  [UiohookKey.F2]: 'F2',
  [UiohookKey.F3]: 'F3',
  [UiohookKey.F4]: 'F4',
  [UiohookKey.F5]: 'F5',
  [UiohookKey.F6]: 'F6',
  [UiohookKey.F7]: 'F7',
  [UiohookKey.F8]: 'F8',
  [UiohookKey.F9]: 'F9',
  [UiohookKey.F10]: 'F10',
  [UiohookKey.F11]: 'F11',
  [UiohookKey.F12]: 'F12'
}

function getKeyDisplayName(keycode) {
  if (SPECIAL_KEY_MAP[keycode] !== undefined) return SPECIAL_KEY_MAP[keycode]
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (code === keycode) {
      if (name.length === 1) return name
      if (/^Num\d$/.test(name)) return name.slice(3)
      return name
    }
  }
  return null
}

const MODIFIER_ORDER = [
  [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  [UiohookKey.Alt, UiohookKey.AltRight],
  [UiohookKey.Shift, UiohookKey.ShiftRight],
  [UiohookKey.Meta, UiohookKey.MetaRight]
]

uIOhook.on('keydown', (e) => {
  console.log('[uiohook] keydown:', e.keycode, '| isRecording:', isRecording)
  if (!isRecording) return

  const { keycode } = e

  if (MODIFIER_CODES.has(keycode)) {
    heldModifiers.add(keycode)
    return
  }

  // Z key toggles zoom lens (no modifiers, recording only)
  if (keycode === UiohookKey.Z && !e.ctrlKey && !e.metaKey && !e.altKey && heldModifiers.size === 0) {
    applyZoomToggle(!isZoomActive)
    const label = `Z — Zoom ${isZoomActive ? 'On' : 'Off'}`
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('keystroke', { keys: [label], display: label, timestamp: Date.now() })
    }
    return
  }

  const specialName = SPECIAL_KEY_MAP[keycode]
  const hasModifiers = heldModifiers.size > 0

  if (!hasModifiers && specialName === undefined) return

  const keys = []
  for (const [left, right] of MODIFIER_ORDER) {
    if (heldModifiers.has(left) || heldModifiers.has(right)) {
      const code = heldModifiers.has(left) ? left : right
      const name = MODIFIER_NAMES[code]
      if (!keys.includes(name)) keys.push(name)
    }
  }

  const keyName = specialName !== undefined ? specialName : getKeyDisplayName(keycode)
  if (keyName !== null) keys.push(keyName)
  if (keys.length === 0) return

  const display = keys.join(' + ')
  const timestamp = Date.now()

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('keystroke', { keys, display, timestamp })
  }
  clickStore.add({ type: 'keystroke', display, timestamp })
})

uIOhook.on('keyup', (e) => {
  if (MODIFIER_CODES.has(e.keycode)) {
    heldModifiers.delete(e.keycode)
  }
})

uIOhook.on('mousedown', (e) => {
  console.log('[uiohook] mousedown at:', e.x, e.y,
    '| isRecording:', isRecording,
    '| overlayWindow exists:', !!overlayWindow)
})

uIOhook.on('mousemove', (e) => {
  currentMouseX = e.x
  currentMouseY = e.y
  if (isZoomActive && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('zoom-move', { x: e.x, y: e.y })
  }
})

uIOhook.start()

// ── IPC: control bar ─────────────────────────────────────────────────────────

// Forward live recording state from main renderer → control bar
ipcMain.on('recording-tick', (_event, data) => {
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.webContents.send('recording-tick', data)
  }
})

// Show the bar and register global shortcuts when recording starts
ipcMain.on('show-control-bar', () => {
  if (!controlBarWindow || controlBarWindow.isDestroyed()) return
  controlBarWindow.show()

  try {
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      mainWindow?.webContents.send('control-pause-toggle')
    })
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      mainWindow?.webContents.send('control-stop')
    })
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      // Show discard confirmation inside the control bar
      controlBarWindow?.webContents.send('show-discard-confirm')
    })
  } catch (e) {
    console.error('globalShortcut registration failed:', e)
  }
})

// Hide the bar and unregister shortcuts when recording ends
ipcMain.on('hide-control-bar', () => {
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.hide()
  }
  globalShortcut.unregister('CommandOrControl+Shift+P')
  globalShortcut.unregister('CommandOrControl+Shift+S')
  globalShortcut.unregister('CommandOrControl+Shift+D')
})

// Forward control commands from the control bar → main renderer's recorder
ipcMain.on('control-pause', () => mainWindow?.webContents.send('control-pause'))
ipcMain.on('control-resume', () => mainWindow?.webContents.send('control-resume'))
ipcMain.on('control-stop', () => mainWindow?.webContents.send('control-stop'))
ipcMain.on('control-discard', () => mainWindow?.webContents.send('control-discard'))

ipcMain.on('toggle-zoom', () => {
  if (!isRecording) return
  applyZoomToggle(!isZoomActive)
})

// ── IPC: FFmpeg ───────────────────────────────────────────────────────────────

ipcMain.handle('ffmpeg-metadata', async (_event, { filePath }) => {
  return getVideoMetadata(filePath)
})

ipcMain.handle('ffmpeg-thumbnail', async (_event, { filePath }) => {
  return extractThumbnail(filePath)
})

ipcMain.handle('ffmpeg-convert', async (event, { inputPath, outputPath }) => {
  return convertToMp4(inputPath, outputPath, (progress) => {
    event.sender.send('ffmpeg-progress', progress)
  })
})

ipcMain.handle('ffmpeg-cancel', async (_event, { outputPath }) => {
  cancelProcessing(outputPath)
  return { success: true }
})

ipcMain.handle(
  'process-zoom',
  async (event, { inputPath, outputPath, recordingStartTime, screenWidth, screenHeight, settings }) => {
    if (!settings?.enabled) {
      return { success: true, outputPath: inputPath, zoomCount: 0 }
    }
    const metadata = await getVideoMetadata(inputPath)
    const clickEvents = clickStore.exportForFFmpeg(recordingStartTime, metadata.fps)
    return processZoom(
      inputPath,
      outputPath,
      clickEvents,
      { width: screenWidth, height: screenHeight },
      metadata,
      settings,
      (progress) => event.sender.send('ffmpeg-progress', progress)
    )
  }
)

// ── IPC: post-processing pipeline ────────────────────────────────────────────

ipcMain.handle(
  'start-processing',
  async (event, { webmPath, recordingStartTime, recordingStopTime, screenWidth, screenHeight }) => {
    console.log('[main] start-processing invoked:', { webmPath, screenWidth, screenHeight })
    const settings = store.store
    console.log('[main] settings.recording.autoZoom:', settings?.recording?.autoZoom)
    return processRecording({
      webmPath,
      recordingStartTime,
      recordingStopTime,
      screenWidth,
      screenHeight,
      settings,
      onProgress: (progress) => {
        event.sender.send('processing-progress', progress)
      }
    })
  }
)

// ── IPC: settings ────────────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => store.store)

ipcMain.handle('set-setting', (_event, { key, value }) => {
  store.set(key, value)
  return { success: true }
})

ipcMain.handle('reset-settings', () => {
  store.clear()
  return store.store
})

ipcMain.handle('get-audio-devices', async () => {
  return { useRenderer: true }
})

ipcMain.handle('open-directory-picker', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('open-recordings-folder', async () => {
  await shell.openPath(getRecordingsDir())
  return { success: true }
})

// ── IPC: onboarding ──────────────────────────────────────────────────────────

ipcMain.handle('get-onboarding-status', () =>
  store.get('onboarding.completed', false))

ipcMain.handle('complete-onboarding', () => {
  store.set('onboarding.completed', true)
  store.set('onboarding.completedAt', Date.now())
  return { success: true }
})

ipcMain.handle('check-permissions', async () => {
  if (process.platform !== 'darwin') {
    return { screen: 'granted', mic: 'granted', accessibility: 'granted' }
  }
  return {
    screen: systemPreferences.getMediaAccessStatus('screen'),
    mic: systemPreferences.getMediaAccessStatus('microphone'),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false)
      ? 'granted'
      : 'denied'
  }
})

ipcMain.handle('open-system-preferences', async (_event, { pane }) => {
  const urls = {
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    mic: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  }
  await shell.openExternal(urls[pane])
})

ipcMain.handle('get-primary-screen-source', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 200, height: 120 }
  })
  const src = sources[0]
  return {
    id: src.id,
    name: src.name,
    thumbnail: src.thumbnail.toDataURL()
  }
})

// ── Window factory: control bar ───────────────────────────────────────────────

function createControlBarWindow(savedPos) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const winWidth = 280
  const winHeight = 64
  const x = savedPos ? savedPos.x : Math.round((sw - winWidth) / 2)
  const y = savedPos ? savedPos.y : sh - winHeight - 40

  controlBarWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/controlBarPreload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  controlBarWindow.setAlwaysOnTop(true, 'screen-saver')
  controlBarWindow.setVisibleOnAllWorkspaces(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    controlBarWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/controlBar/index.html')
  } else {
    controlBarWindow.loadFile(join(__dirname, '../renderer/controlBar/index.html'))
  }

  if (!app.isPackaged) {
    controlBarWindow.webContents.openDevTools({ mode: 'detach' })
  }

  controlBarWindow.on('moved', async () => {
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      const [px, py] = controlBarWindow.getPosition()
      await saveControlBarPosition(px, py)
    }
  })

  controlBarWindow.on('closed', () => {
    controlBarWindow = null
  })

  return controlBarWindow
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

async function checkMacPermissions() {
  const screenAccess = systemPreferences.getMediaAccessStatus('screen')
  if (screenAccess !== 'granted') {
    console.log('Screen recording permission not granted')
  }
}

app.whenReady().then(async () => {
  // Serve local recordings via media:// — forwards Range headers so seeking works.
  protocol.handle('media', async (request) => {
    const fileUrl = request.url.replace('media://', 'file://')
    const response = await net.fetch(fileUrl, { headers: request.headers })
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' media: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:*"
        ]
      }
    })
  })

  createWindow()
  initUpdater(mainWindow)
  if (process.platform === 'darwin') await checkMacPermissions()
  createOverlayWindow()

  const savedPos = await loadControlBarPosition()
  createControlBarWindow(savedPos)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy()
  if (controlBarWindow && !controlBarWindow.isDestroyed()) controlBarWindow.destroy()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
