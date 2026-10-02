import { useEffect, useRef, type PointerEvent } from 'react'
import { resizeImage } from '../engine/imageGeometry'
import { useEditorStore } from '../store/editorStore'
import type { Clip, EditorProject, ImageStyle } from '../types/editor'

export function ImageOverlay({ clip, selected, scale, canvas, onPause }: {
  clip: Clip; selected: boolean; scale: { x: number; y: number }; canvas: EditorProject['canvas']; onPause: () => void
}) {
  const { imageAssets, selectClip, updateImage, beginEdit, commitEdit, cancelEdit } = useEditorStore()
  const image = clip.image!
  const asset = imageAssets[image.assetId]
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; original: ImageStyle; corner: [number, number] | null } | null>(null)
  useEffect(() => () => { if (gesture.current) useEditorStore.getState().cancelEdit() }, [])
  if (!asset) return null
  const begin = (event: PointerEvent<HTMLElement>, corner: [number, number] | null = null) => {
    if (event.button !== 0 || !event.isPrimary || !root.current) return
    event.preventDefault(); event.stopPropagation()
    selectClip(clip.id); root.current.focus(); onPause(); beginEdit()
    gesture.current = { x: event.clientX, y: event.clientY, original: image, corner }
    root.current.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = (event.clientX - g.x) / scale.x, dy = (event.clientY - g.y) / scale.y
    updateImage(clip.id, g.corner ? resizeImage(g.original, dx, dy, g.corner[0], g.corner[1], canvas) : { x: g.original.x + dx, y: g.original.y + dy })
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return
    move(event); gesture.current = null; commitEdit()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const cancel = () => { gesture.current = null; cancelEdit() }
  return <div ref={root} className={`preview-image${selected ? ' selected' : ''}`} data-image-id={clip.id}
    role="button" tabIndex={0} aria-label={`${clip.name} 이미지 이동`}
    style={{ left: image.x, top: image.y, width: image.width, height: image.height }}
    onPointerDown={event => begin(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
    onLostPointerCapture={() => { if (gesture.current) cancel() }} onFocus={() => selectClip(clip.id)}
    onKeyDown={event => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); return }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation(); onPause()
      const step = event.shiftKey ? 10 : 1
      updateImage(clip.id, { x: image.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: image.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) })
    }}>
    <img src={asset.url} alt={asset.name} draggable={false} style={{ opacity: image.opacity }} />
    {selected && ([-1, 1] as const).flatMap(sx => ([-1, 1] as const).map(sy => <button key={`${sx}:${sy}`}
      className="image-resize-handle" aria-label={`이미지 크기 ${sx < 0 ? '왼쪽' : '오른쪽'} ${sy < 0 ? '위' : '아래'}`}
      data-corner={`${sx}:${sy}`} tabIndex={-1}
      style={{ left: sx < 0 ? 0 : '100%', top: sy < 0 ? 0 : '100%', width: 12 / scale.x, height: 12 / scale.y, cursor: sx === sy ? 'nwse-resize' : 'nesw-resize' }}
      onPointerDown={event => begin(event, [sx, sy])} />))}
  </div>
}
