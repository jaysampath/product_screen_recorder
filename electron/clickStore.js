class ClickStore {
  constructor() {
    this.events = []
  }

  add(event) {
    this.events.push(event)
  }

  getAll() {
    return this.events
  }

  clear() {
    this.events = []
  }

  exportForFFmpeg(recordingStartTime, fps) {
    return this.events.map((e) => ({
      ...e,
      frame: Math.floor(((e.timestamp - recordingStartTime) / 1000) * fps)
    }))
  }
}

export default new ClickStore()
