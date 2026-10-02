import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { readAudioDuration } from './audioMetadata'

export function useAudioImports() {
  const assets = useEditorStore(state => state.audioAssets)
  const revision = useEditorStore(state => state.mediaRevision)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const importing = useRef(false)
  const owned = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const release = (url: string) => { URL.revokeObjectURL(url); owned.current.delete(url); pending.current.delete(url) }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
      for (const url of owned.current) URL.revokeObjectURL(url)
      owned.current.clear()
    }
  }, [])
  useEffect(() => {
    setError(null)
    return () => controller.current?.abort()
  }, [revision])
  useEffect(() => {
    const retained = new Set(Object.values(assets).map(asset => asset.url))
    for (const url of owned.current) if (!retained.has(url) && !pending.current.has(url)) release(url)
  }, [assets])

  const importFiles = async (files: File[]) => {
    if (!files.length || importing.current) return
    importing.current = true; setBusy(true); setError(null)
    const epoch = useEditorStore.getState().mediaRevision
    const abort = new AbortController()
    controller.current = abort
    try {
      for (const file of files) {
        if (!mounted.current || abort.signal.aborted || useEditorStore.getState().mediaRevision !== epoch) break
        if (!file.type.startsWith('audio/') && !(file.type === '' && /\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.name))) {
          setError('지원하는 오디오 파일을 선택하세요.'); continue
        }
        const url = URL.createObjectURL(file)
        owned.current.add(url); pending.current.add(url)
        try {
          const duration = await readAudioDuration(url, abort.signal)
          if (!mounted.current || abort.signal.aborted || useEditorStore.getState().mediaRevision !== epoch) { release(url); break }
          useEditorStore.getState().addAudio({ id: crypto.randomUUID(), name: file.name, file, url, duration })
          pending.current.delete(url); owned.current.delete(url)
        } catch {
          release(url)
          if (mounted.current && !abort.signal.aborted && useEditorStore.getState().mediaRevision === epoch) setError(`${file.name}: 재생 가능한 오디오를 읽을 수 없습니다.`)
        }
      }
    } finally {
      importing.current = false
      if (controller.current === abort) controller.current = null
      if (mounted.current) setBusy(false)
    }
  }
  return { importFiles, busy, error }
}
