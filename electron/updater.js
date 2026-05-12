import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { app, ipcMain } from 'electron'

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function initUpdater(mainWindow) {
  if (!app.isPackaged) return

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  autoUpdater.on('checking-for-update', () =>
    send('updater', { status: 'checking' }))

  autoUpdater.on('update-available', (info) =>
    send('updater', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    }))

  autoUpdater.on('update-not-available', () =>
    send('updater', { status: 'up-to-date' }))

  autoUpdater.on('download-progress', (progress) =>
    send('updater', {
      status: 'downloading',
      percent: Math.floor(progress.percent),
      bytesPerSecond: progress.bytesPerSecond
    }))

  autoUpdater.on('update-downloaded', (info) =>
    send('updater', {
      status: 'ready',
      version: info.version
    }))

  autoUpdater.on('error', (err) =>
    send('updater', {
      status: 'error',
      message: err.message
    }))

  ipcMain.handle('check-for-update', () => autoUpdater.checkForUpdates())
  ipcMain.handle('download-update', () => autoUpdater.downloadUpdate())
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall())

  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}
