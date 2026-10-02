import { useEffect, useRef, useState } from 'react'
import { readVideoMetadata } from './videoMetadata'
import { useEditorStore } from '../store/editorStore'

export function useVideoImports() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const importing = useRef(false)
  const mounted = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const revision = useEditorStore(s => s.mediaRevision)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort() } }, [])
  useEffect(() => () => abort.current?.abort(), [revision])
  const importFiles = async (files: File[]) => {
    if (importing.current || !files.length) return
    importing.current = true; setBusy(true); setError(null)
    const controller = new AbortController(); abort.current = controller
    const epoch = useEditorStore.getState().mediaRevision
    try {
      for (const file of files) {
        if (controller.signal.aborted) break
        if (!file.type.startsWith('video/') && !(file.type === '' && /\.(mp4|webm|mov)$/i.test(file.name))) { setError('MP4 / WebM / MOV 영상을 선택하세요.'); continue }
        const url = URL.createObjectURL(file)
        let accepted = false
        try {
          const metadata = await readVideoMetadata(url,controller.signal)
          if (controller.signal.aborted || !mounted.current || epoch !== useEditorStore.getState().mediaRevision) break
          useEditorStore.getState().addVideo({id: crypto.randomUUID(), name: file.name, file, url, ...metadata})
          accepted = true
        } catch {
          if (!controller.signal.aborted && mounted.current) setError(`${file.name}: 브라우저에서 읽을 수 없는 영상입니다.`)
        } finally { if (!accepted) URL.revokeObjectURL(url) }
      }
    } finally { importing.current = false; if (mounted.current) setBusy(false) }
  }
  return { importFiles, busy, error }
}
