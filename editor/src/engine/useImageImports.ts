import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'

export function useImageImports() {
  const imageAssets = useEditorStore(state => state.imageAssets)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const owned = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const mounted = useRef(false)
  const release = (url: string) => { URL.revokeObjectURL(url); owned.current.delete(url); pending.current.delete(url) }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const url of owned.current) URL.revokeObjectURL(url)
      owned.current.clear()
    }
  }, [])
  useEffect(() => {
    const retained = new Set(Object.values(imageAssets).map(asset => asset.url))
    for (const url of owned.current) if (!retained.has(url) && !pending.current.has(url)) release(url)
  }, [imageAssets])

  const importFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setBusy(true); setError(null)
    const revision = useEditorStore.getState().mediaRevision
    try {
      for (const file of files) {
        if (!mounted.current || useEditorStore.getState().mediaRevision !== revision) break
        const valid = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
          || (file.type === '' && /\.(png|jpe?g|webp)$/i.test(file.name))
        if (!valid) { setError('PNG / JPEG / WebP 이미지를 선택하세요.'); continue }
        const url = URL.createObjectURL(file)
        owned.current.add(url); pending.current.add(url)
        try {
          const image = new Image()
          image.src = url
          await image.decode()
          if (!mounted.current || useEditorStore.getState().mediaRevision !== revision) { release(url); break }
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image')
          useEditorStore.getState().addImage({ id: crypto.randomUUID(), name: file.name, file, url, width: image.naturalWidth, height: image.naturalHeight })
          pending.current.delete(url); owned.current.delete(url)
        } catch {
          release(url)
          if (mounted.current && useEditorStore.getState().mediaRevision === revision) setError(`${file.name}: 이미지를 읽을 수 없습니다.`)
        }
      }
    } finally { if (mounted.current) setBusy(false) }
  }
  return { importFiles, busy, error }
}
