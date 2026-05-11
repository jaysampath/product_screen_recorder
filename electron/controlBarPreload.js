import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('controlBar', {
  on: (channel, callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, listener)
    return listener
  },
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args)
})
