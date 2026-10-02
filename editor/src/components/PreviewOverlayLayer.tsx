import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { ImageOverlay } from './ImageOverlay'
import { clipEnd } from '../engine/timeline'
import { useEditorStore } from '../store/editorStore'
import type { Clip, EditorProject } from '../types/editor'

interface LayerProps {
  project: EditorProject
  selectedClipId: string | null
  showTextBounds: boolean
  onPause: () => void
}

export function PreviewOverlayLayer({ project, selectedClipId, showTextBounds, onPause }: LayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState({ x: 1, y: 1 })
  useLayoutEffect(() => {
    const canvas = layerRef.current
    if (!canvas) return
    const resize = () => setScale({ x: canvas.clientWidth / project.canvas.width, y: canvas.clientHeight / project.canvas.height })
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [project.canvas.width, project.canvas.height])
  const clips = project.tracks.flatMap(track => track.type === 'text' || track.type === 'image' ? track.clips : []).filter(
    clip => (clip.text || clip.image) && project.currentTime >= clip.start && project.currentTime < clipEnd(clip),
  )
  return (
    <div className="preview-text-layer" ref={layerRef}>
      <div className="logical-canvas" style={{ width: project.canvas.width, height: project.canvas.height, transform: `scale(${scale.x}, ${scale.y})` }}>
        {clips.filter(clip => clip.image).map(clip => <ImageOverlay key={clip.id} clip={clip} selected={clip.id === selectedClipId} scale={scale} canvas={project.canvas} onPause={onPause} />)}
        {clips.filter(clip => clip.text).map(clip => <TextOverlay showBounds={showTextBounds} key={clip.id} clip={clip} selected={clip.id === selectedClipId} scale={scale} canvas={project.canvas} onPause={onPause} />)}
      </div>
    </div>
  )
}

function TextOverlay({ clip, selected, showBounds, scale, canvas, onPause }: {
  clip: Clip; selected: boolean; showBounds: boolean; scale: { x: number; y: number }; canvas: EditorProject['canvas']; onPause: () => void
}) {
  const { selectClip, beginEdit, commitEdit, cancelEdit, updateText } = useEditorStore()
  const gesture = useRef<{ x: number; y: number; originalX: number; originalY: number; halfWidth: number; halfHeight: number } | null>(null)
  const text = clip.text!
  useEffect(() => () => { if (gesture.current) useEditorStore.getState().cancelEdit() }, [])

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    event.stopPropagation()
    selectClip(clip.id)
    event.currentTarget.focus()
    onPause()
    beginEdit()
    gesture.current = {
      x: event.clientX, y: event.clientY, originalX: text.x, originalY: text.y,
      halfWidth: Math.min(event.currentTarget.offsetWidth / 2, canvas.width / 2),
      halfHeight: Math.min(event.currentTarget.offsetHeight / 2, canvas.height / 2),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    updateText(clip.id, {
      x: Math.min(Math.max(g.originalX + (event.clientX - g.x) / scale.x, g.halfWidth), canvas.width - g.halfWidth),
      y: Math.min(Math.max(g.originalY + (event.clientY - g.y) / scale.y, g.halfHeight), canvas.height - g.halfHeight),
    })
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return
    move(event)
    gesture.current = null
    commitEdit()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const cancel = () => { gesture.current = null; cancelEdit() }

  return (
    <div
      className={`preview-text${selected ? ' selected' : ''}${showBounds ? ' show-bounds' : ''}`}
      role="button" tabIndex={0} aria-label={`${clip.name} 자막 이동`}
      data-text-id={clip.id}
      style={{ left: text.x, top: text.y, fontFamily: text.fontFamily, fontSize: text.fontSize,
        color: text.color, textAlign: text.align, fontWeight: text.bold ? 700 : 400,
        textShadow: text.shadow ? '0 3px 8px #000, 0 1px 3px #000' : 'none',
      }}
      onPointerDown={begin} onPointerMove={move} onPointerUp={end}
      onPointerCancel={cancel}
      onLostPointerCapture={() => { if (gesture.current) cancel() }}
      onFocus={() => selectClip(clip.id)}
      onClick={() => selectClip(clip.id)}
      onKeyDown={event => {
        if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); return }
        if (event.key === 'Enter') selectClip(clip.id)
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault(); event.stopPropagation(); onPause()
        const step = event.shiftKey ? 10 : 1
        updateText(clip.id, {
          x: text.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
          y: text.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
        })
      }}
    >{text.value || '\u200b'}</div>
  )
}
