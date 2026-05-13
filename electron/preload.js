import { contextBridge, ipcRenderer } from 'electron'
import os from 'os'

const electronAPI = {
  platform: process.platform,
  homedir: os.homedir(),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, listener)
    return listener
  },
  off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (err) {
    console.error(err)
  }
} else {
  window.electron = electronAPI
}
