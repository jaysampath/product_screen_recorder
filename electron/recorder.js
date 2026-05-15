import { screen } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import clickStore from './clickStore.js'

function normalizeCoords(physicalX, physicalY) {
  const display = screen.getDisplayNearestPoint({ x: physicalX, y: physicalY })
  const sf = display.scaleFactor
  return { x: Math.round(physicalX / sf), y: Math.round(physicalY / sf) }
}

let trackingActive = false
let lastCursorSend = 0

const MODIFIER_CODES = new Set([
  UiohookKey.ShiftLeft, UiohookKey.ShiftRight,
  UiohookKey.CtrlLeft, UiohookKey.CtrlRight,
  UiohookKey.AltLeft, UiohookKey.AltRight,
  UiohookKey.MetaLeft, UiohookKey.MetaRight,
])

const MODIFIER_DISPLAY = {
  [UiohookKey.ShiftLeft]: 'Shift',
  [UiohookKey.ShiftRight]: 'Shift',
  [UiohookKey.CtrlLeft]: 'Ctrl',
  [UiohookKey.CtrlRight]: 'Ctrl',
  [UiohookKey.AltLeft]: 'Alt',
  [UiohookKey.AltRight]: 'Alt',
  [UiohookKey.MetaLeft]: process.platform === 'darwin' ? 'Cmd' : 'Win',
  [UiohookKey.MetaRight]: process.platform === 'darwin' ? 'Cmd' : 'Win',
}

// Order modifiers consistently in combo display
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Win', 'Cmd']

const SPECIAL_KEY_MAP = {
  [UiohookKey.Escape]: '⎋ Escape',
  [UiohookKey.Backspace]: '⌫ Backspace',
  [UiohookKey.Tab]: '⇥ Tab',
  [UiohookKey.Enter]: '⏎ Enter',
  [UiohookKey.Space]: 'Space',
  [UiohookKey.Delete]: 'Delete',
  [UiohookKey.ArrowUp]: '↑',
  [UiohookKey.ArrowDown]: '↓',
  [UiohookKey.ArrowLeft]: '←',
  [UiohookKey.ArrowRight]: '→',
  [UiohookKey.F1]: 'F1', [UiohookKey.F2]: 'F2', [UiohookKey.F3]: 'F3',
  [UiohookKey.F4]: 'F4', [UiohookKey.F5]: 'F5', [UiohookKey.F6]: 'F6',
  [UiohookKey.F7]: 'F7', [UiohookKey.F8]: 'F8', [UiohookKey.F9]: 'F9',
  [UiohookKey.F10]: 'F10', [UiohookKey.F11]: 'F11', [UiohookKey.F12]: 'F12',
  [UiohookKey.Home]: 'Home', [UiohookKey.End]: 'End',
  [UiohookKey.PageUp]: 'PgUp', [UiohookKey.PageDown]: 'PgDn',
  [UiohookKey.Insert]: 'Insert',
}

// Scan-code → letter name for showing letter combos (e.g. Ctrl+Z)
const LETTER_MAP = {
  [UiohookKey.Num0]: '0', [UiohookKey.Num1]: '1', [UiohookKey.Num2]: '2',
  [UiohookKey.Num3]: '3', [UiohookKey.Num4]: '4', [UiohookKey.Num5]: '5',
  [UiohookKey.Num6]: '6', [UiohookKey.Num7]: '7', [UiohookKey.Num8]: '8',
  [UiohookKey.Num9]: '9',
  [UiohookKey.A]: 'A', [UiohookKey.B]: 'B', [UiohookKey.C]: 'C',
  [UiohookKey.D]: 'D', [UiohookKey.E]: 'E', [UiohookKey.F]: 'F',
  [UiohookKey.G]: 'G', [UiohookKey.H]: 'H', [UiohookKey.I]: 'I',
  [UiohookKey.J]: 'J', [UiohookKey.K]: 'K', [UiohookKey.L]: 'L',
  [UiohookKey.M]: 'M', [UiohookKey.N]: 'N', [UiohookKey.O]: 'O',
  [UiohookKey.P]: 'P', [UiohookKey.Q]: 'Q', [UiohookKey.R]: 'R',
  [UiohookKey.S]: 'S', [UiohookKey.T]: 'T', [UiohookKey.U]: 'U',
  [UiohookKey.V]: 'V', [UiohookKey.W]: 'W', [UiohookKey.X]: 'X',
  [UiohookKey.Y]: 'Y', [UiohookKey.Z]: 'Z',
}

export function startClickTracking(overlayWindow) {
  if (trackingActive) return
  trackingActive = true
  clickStore.clear()

  const heldModifiers = new Set()

  uIOhook.on('keydown', (event) => {
    const kc = event.keycode

    if (MODIFIER_CODES.has(kc)) {
      heldModifiers.add(kc)
      return
    }

    const specialName = SPECIAL_KEY_MAP[kc]
    const letterName = LETTER_MAP[kc]

    let keyName = null
    if (specialName) {
      keyName = specialName
    } else if (letterName && heldModifiers.size > 0) {
      keyName = letterName
    }
    if (!keyName) return

    const activeModNames = new Set()
    for (const modKc of heldModifiers) activeModNames.add(MODIFIER_DISPLAY[modKc])
    const modsList = MODIFIER_ORDER.filter((m) => activeModNames.has(m))
    const keys = [...modsList, keyName].slice(0, 5)
    const keystrokeData = {
      type: 'keystroke',
      keys,
      display: keys.join(' + '),
      timestamp: Date.now(),
    }
    clickStore.add(keystrokeData)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('keystroke', keystrokeData)
    }
  })

  uIOhook.on('keyup', (event) => {
    heldModifiers.delete(event.keycode)
  })

  uIOhook.on('mousedown', (event) => {
    const { x, y } = normalizeCoords(event.x, event.y)
    const clickData = {
      type: 'click',
      x,
      y,
      button: event.button === 1 ? 'left' : 'right',
      timestamp: Date.now(),
      screenId: 0
    }
    clickStore.add(clickData)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('click', clickData)
    }
  })

  uIOhook.on('mousemove', (event) => {
    const now = Date.now()
    // Throttle cursor updates to ~60fps to avoid flooding IPC
    if (now - lastCursorSend < 16) return
    lastCursorSend = now
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('cursor', { x: event.x, y: event.y })
    }
  })

  try {
    uIOhook.start()
  } catch (err) {
    console.error('[recorder] Failed to start uiohook:', err)
    trackingActive = false
  }
}

export function stopClickTracking() {
  if (!trackingActive) return
  trackingActive = false
  uIOhook.removeAllListeners()
  try {
    uIOhook.stop()
  } catch (err) {
    console.error('[recorder] Failed to stop uiohook:', err)
  }
}

export { clickStore }
