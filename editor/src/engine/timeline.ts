import type { Clip, Track } from '../types/editor'

export type EditMode = 'move' | 'trim-start' | 'trim-end'
const EPSILON = 1e-7
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
export const toFrame = (time: number, fps: number) => Math.round(time * fps) / fps
export const clipEnd = (clip: Clip) => clip.start + clip.duration

export function projectDuration(tracks: Track[]) {
  return Math.max(0, ...tracks.flatMap(track => track.clips.map(clipEnd)))
}

export function activeVideo(tracks: Track[], time: number): Clip | undefined {
  return tracks.find(track => track.type === 'video')?.clips.find(
    clip => time >= clip.start && time < clipEnd(clip),
  )
}

export function sourceTime(clip: Clip, time: number) {
  return (clip.sourceStart ?? 0) + clamp(time - clip.start, 0, clip.duration)
}

function snap(value: number, targets: number[], tolerance: number) {
  const closest = targets.reduce((best, target) =>
    Math.abs(target - value) < Math.abs(best - value) ? target : best, Infinity)
  return Math.abs(closest - value) <= tolerance ? closest : value
}

/** Resolve an edit from its original geometry, never from previous pointer events. */
export function editClip(
  clip: Clip, clips: Clip[], mode: EditMode, target: number, fps: number,
  playhead?: number, tolerance = 0,
): Clip {
  if (!Number.isFinite(target)) return clip
  const others = clips.filter(other => other.id !== clip.id)
  // Audio and visual overlays can overlap independently.
  const blocking = clip.type === 'video' ? others : []
  const targets = [0, ...others.flatMap(other => [other.start, clipEnd(other)])]
  if (playhead !== undefined) targets.push(playhead)
  const frameTarget = toFrame(target, fps)
  const minDuration = Math.min(1 / fps, clip.duration)
  const end = clipEnd(clip)

  if (mode === 'move') {
    const snapped = snap(frameTarget, [...targets, ...targets.map(t => t - clip.duration)], tolerance)
    const fits = (start: number) => start >= 0 && blocking.every(other =>
      start + clip.duration <= other.start + EPSILON || start >= clipEnd(other) - EPSILON)
    const desired = Math.max(0, snapped)
    const candidates = [desired, 0, ...blocking.flatMap(other =>
      [clipEnd(other), other.start - clip.duration])].filter(fits)
    const start = candidates.reduce((best, value) =>
      Math.abs(value - desired) < Math.abs(best - desired) ? value : best, clip.start)
    return { ...clip, start }
  }

  const previousEnd = Math.max(0, ...blocking.filter(other => clipEnd(other) <= clip.start + EPSILON).map(clipEnd))
  const nextStart = Math.min(Infinity, ...blocking.filter(other => other.start >= end - EPSILON).map(other => other.start))
  if (mode === 'trim-start') {
    const minStart = Math.max(previousEnd, clip.sourceStart === undefined ? 0 : clip.start - clip.sourceStart)
    const start = clamp(snap(frameTarget, targets, tolerance), minStart, end - minDuration)
    const duration = end - start
    return {
      ...clip, start, duration,
      ...(clip.sourceStart !== undefined ? {
        sourceStart: clip.sourceStart + start - clip.start, sourceDuration: duration,
      } : {}),
    }
  }

  const sourceEnd = clip.sourceLength === undefined
    ? Infinity : clip.start + clip.sourceLength - (clip.sourceStart ?? 0)
  const newEnd = clamp(snap(frameTarget, targets, tolerance), clip.start + minDuration, Math.min(nextStart, sourceEnd))
  const duration = newEnd - clip.start
  return { ...clip, duration, ...(clip.sourceStart !== undefined ? { sourceDuration: duration } : {}) }
}

export function canSplitClip(clip: Clip, time: number, fps: number) {
  if (!Number.isFinite(time)) return false
  const offset = toFrame(time, fps) - clip.start
  return offset >= 1 / fps - EPSILON && clip.duration - offset >= 1 / fps - EPSILON
}

export function splitClip(clip: Clip, time: number, fps: number): [Clip, Clip] | null {
  if (!canSplitClip(clip, time, fps)) return null
  const splitTime = toFrame(time, fps)
  const offset = splitTime - clip.start
  return [
    { ...clip, id: crypto.randomUUID(), duration: offset,
      ...(clip.sourceStart !== undefined ? { sourceDuration: offset } : {}) },
    { ...clip, id: crypto.randomUUID(), start: splitTime, duration: clip.duration - offset,
      ...(clip.sourceStart !== undefined ? {
        sourceStart: clip.sourceStart + offset, sourceDuration: clip.duration - offset,
      } : {}) },
  ]
}
