export function readVideoMetadata(url: string, signal: AbortSignal) {
  return new Promise<{duration: number; width: number; height: number}>((resolve,reject) => {
    const video = document.createElement('video')
    let settled = false
    const done = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer); signal.removeEventListener('abort',cancelled)
      const data = {duration: video.duration, width: video.videoWidth, height: video.videoHeight}
      video.onloadedmetadata = null; video.onerror = null; video.removeAttribute('src'); video.load()
      if (error || !Number.isFinite(data.duration) || data.duration <= 0 || !data.width || !data.height) reject(error ?? new Error('Invalid video'))
      else resolve(data)
    }
    const cancelled = () => done(new Error('Aborted'))
    const timer = setTimeout(() => done(new Error('Timeout')),15000)
    signal.addEventListener('abort',cancelled,{once:true})
    if (signal.aborted) { cancelled(); return }
    video.onloadedmetadata = () => done(); video.onerror = () => done(new Error('Invalid video'))
    video.preload = 'metadata'; video.src = url
  })
}
