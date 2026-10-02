import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { clipEnd, editClip, type EditMode } from '../engine/timeline'
import type { Clip } from '../types/editor'

interface Props {
  clip: Clip
  clips: Clip[]
  selected: boolean
  fps: number
  pxPerSecond: number
  playhead: number
  scrollRef: RefObject<HTMLDivElement | null>
  onSelect: () => void
  onBeginEdit: () => void
  onCommit: (mode: EditMode, target: number, tolerance: number) => void
}

export function TimelineClip({ clip, clips, selected, fps, pxPerSecond, playhead, scrollRef, onSelect, onBeginEdit, onCommit }: Props) {
  const gesture = useRef<{ mode: EditMode; x: number; scroll: number; original: Clip; moved: boolean } | null>(null)
  const [draft, setDraft] = useState<Clip | null>(null)
  const shown = draft ?? clip

  const calculate = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current!
    const delta = (event.clientX - g.x + (scrollRef.current?.scrollLeft ?? 0) - g.scroll) / pxPerSecond
    const origin = g.mode === 'trim-end' ? clipEnd(g.original) : g.original.start
    const target = origin + delta
    const tolerance = event.altKey ? 0 : 6 / pxPerSecond
    return { target, tolerance, clip: editClip(g.original, clips, g.mode, target, fps, playhead, tolerance) }
  }

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    event.stopPropagation()
    const mode = (event.target as HTMLElement).closest<HTMLElement>('[data-trim]')?.dataset.trim as EditMode | undefined
    onSelect()
    onBeginEdit()
    gesture.current = { mode: mode ?? 'move', x: event.clientX, scroll: scrollRef.current?.scrollLeft ?? 0, original: clip, moved: false }
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return
    if (Math.abs(event.clientX - gesture.current.x) > 2) gesture.current.moved = true
    if (gesture.current.moved) setDraft(calculate(event).clip)
  }

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return
    const g = gesture.current
    if (g.moved) {
      const { target, tolerance } = calculate(event)
      onCommit(g.mode, target, tolerance)
    }
    gesture.current = null
    setDraft(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') onSelect()
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const mode = (event.target as HTMLElement).dataset.trim as EditMode | undefined ?? 'move'
    const origin = mode === 'trim-end' ? clipEnd(clip) : clip.start
    onSelect()
    onBeginEdit()
    onCommit(mode, origin + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1) / fps, 0)
  }

  return (
    <div
      className={`clip clip-${clip.type}${selected ? ' selected' : ''}${draft ? ' editing' : ''}`}
      style={{ left: shown.start * pxPerSecond, width: shown.duration * pxPerSecond }}
      tabIndex={0}
      role="group"
      aria-label={`${clip.name} 클립`}
      data-clip-id={clip.id}
      data-start={shown.start}
      data-duration={shown.duration}
      data-source-start={shown.sourceStart}
      title={`${clip.name} · ${shown.start.toFixed(2)}–${clipEnd(shown).toFixed(2)}초\n드래그: 이동 · 가장자리: 트림 · Alt: 스냅 해제`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => { gesture.current = null; setDraft(null) }}
      onLostPointerCapture={() => { gesture.current = null; setDraft(null) }}
      onClick={event => { event.stopPropagation(); onSelect() }}
      onFocus={onSelect}
      onKeyDown={keyboard}
    >
      <button className="trim-handle trim-start" data-trim="trim-start" aria-label="시작 트림" />
      <span className="clip-name">{clip.name}</span>
      <button className="trim-handle trim-end" data-trim="trim-end" aria-label="끝 트림" />
    </div>
  )
}
