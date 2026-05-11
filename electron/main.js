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
  globalShortcut
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

const store = new Store()

let mainWindow = null
let overlayWindow = null
let controlBarWindow = null
let isRecording = false
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

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function createControlBarWindow(savedPos) {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const winWidth = 280
  const winHeight = 64
  const x = savedPos?.x ?? Math.round((workAreaSize.width - winWidth) / 2)
  const y = savedPos?.y ?? workAreaSize.height - winHeight - 24

  controlBarWindow = new BrowserWindow({
    x,
    y,
    width: winWidth,
    height: winHeight,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    transparent: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/controlBarPreload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  controlBarWindow.setAlwaysOnTop(true, 'floating')
  controlBarWindow.setVisibleOnAllWorkspaces(true)

  controlBarWindow.on('moved', async () => {
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      const [px, py] = controlBarWindow.getPosition()
      await saveControlBarPosition(px, py)
    }
  })

  controlBarWindow.on('closed', () => {
    controlBarWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    controlBarWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/controlBar/index.html')
  } else {
    controlBarWindow.loadFile(join(__dirname, '../renderer/controlBar/index.html'))
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
  try {
    const dir = getRecordingsDir()
    await fs.mkdir(dir, { recursive: true })
    const filePath = join(dir, filename)
    await fs.writeFile(filePath, Buffer.from(buffer))
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
    const webmFiles = files.filter((f) => f.endsWith('.webm'))
    const recordings = await Promise.all(
      webmFiles.map(async (filename) => {
        const filePath = join(dir, filename)
        const stat = await fs.stat(filePath)
        return {
          id: filename.replace(/\.webm$/, ''),
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
    const sanitized = newName.replace(/[<>:"/\\|?*]/g, '_').trim()
    const newFilename = sanitized.endsWith('.webm') ? sanitized : sanitized + '.webm'
    const newPath = join(dir, newFilename)
    await fs.rename(filePath, newPath)
    return { success: true, newPath, newFilename }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: overlay ─────────────────────────────────────────────────────────────

ipcMain.on('show-overlay', () => {
  isRecording = true
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    startClickTracking(overlayWindow)
  }
})

ipcMain.on('hide-overlay', () => {
  isRecording = false
  heldModifiers.clear()
  stopClickTracking()
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
  if (!isRecording) return

  const { keycode } = e

  if (MODIFIER_CODES.has(keycode)) {
    heldModifiers.add(keycode)
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
  async (event, { webmPath, recordingStartTime, screenWidth, screenHeight }) => {
    const settings = store.store
    return processRecording({
      webmPath,
      recordingStartTime,
      screenWidth,
      screenHeight,
      settings,
      onProgress: (progress) => {
        event.sender.send('processing-progress', progress)
      }
    })
  }
)

// ── App lifecycle ─────────────────────────────────────────────────────────────

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
