import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

// History retains registries. Release URLs only when replacing a whole project.
export function useAssetURLs() {
  useEffect(() => {
    const urls = () => {
      const state = useEditorStore.getState()
      return new Set([...Object.values(state.videoAssets), ...Object.values(state.audioAssets), ...Object.values(state.imageAssets)].map(a => a.url))
    }
    let retained = urls()
    let previous = useEditorStore.getState()
    return useEditorStore.subscribe(state => {
      if (state.videoAssets === previous.videoAssets && state.audioAssets === previous.audioAssets && state.imageAssets === previous.imageAssets) return
      previous = state
      const next = urls()
      for (const url of retained) if (!next.has(url)) URL.revokeObjectURL(url)
      retained = next
    })
  }, [])
}
