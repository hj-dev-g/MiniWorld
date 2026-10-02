/** Decode just enough metadata to validate local media; always release the probe. */
export function readAudioDuration(url: string, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    let settled = false
    const finish = (duration?: number, error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (error) reject(error)
      else resolve(duration!)
    }
    const abort = () => finish(undefined, new DOMException('Cancelled', 'AbortError'))
    const timer = window.setTimeout(() => finish(undefined, new Error('Metadata timeout')), 15000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => Number.isFinite(audio.duration) && audio.duration > 0
      ? finish(audio.duration) : finish(undefined, new Error('Invalid audio duration'))
    audio.onerror = () => finish(undefined, new Error('Unsupported audio'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    audio.src = url
  })
}
