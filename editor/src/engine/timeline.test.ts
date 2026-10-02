import { describe, expect, it } from 'vitest'
import { activeVideo, canSplitClip, clipEnd, editClip, projectDuration, sourceTime, splitClip } from './timeline'
import type { Clip, Track } from '../types/editor'

const clip: Clip = { id: 'a', name: 'video.mp4', type: 'video', start: 4, duration: 6, sourceStart: 8, sourceDuration: 6, sourceLength: 20 }
const before = { ...clip, id: 'before', start: 0, duration: 2 }
const after = { ...clip, id: 'after', start: 12, duration: 3 }
const tracks: Track[] = [{ id: 'video', type: 'video', clips: [before, clip, after] }]

describe('timeline source mapping and edit bounds', () => {
  it('uses half-open intervals and leaves gaps/end without a video', () => {
    expect(activeVideo(tracks, 0)?.id).toBe('before')
    expect(activeVideo(tracks, 2)).toBeUndefined()
    expect(activeVideo(tracks, 4)?.id).toBe('a')
    expect(activeVideo(tracks, 10)).toBeUndefined()
    expect(activeVideo(tracks, 15)).toBeUndefined()
    expect(sourceTime(clip, 7)).toBe(11)
  })

  it('moves on frame boundaries, preserving the source range', () => {
    const moved = editClip(clip, [clip], 'move', 6.011, 30)
    expect(moved).toEqual({ ...clip, start: 6 })
    expect(sourceTime(moved, 7)).toBe(9)
    expect(editClip(clip, [clip], 'move', -5, 30).start).toBe(0)
  })

  it('resolves collisions and allows moving beyond another clip', () => {
    const moved = editClip(clip, [before, clip, after], 'move', 11, 30)
    expect(moved.start).toBe(15)
    expect(editClip(clip, [before, clip, after], 'move', 2, 30).start).toBe(2)
  })

  it('snaps either edge to neighbors, and supports no snapping', () => {
    expect(editClip(clip, [clip, after], 'move', 6.1, 30, undefined, .2).start).toBe(6)
    expect(editClip(clip, [clip], 'move', 6.1, 30, undefined, 0).start).toBeCloseTo(6.1)
    expect(editClip(clip, [clip], 'move', 6.1, 30, 6, .2).start).toBe(6)
  })

  it('left trim advances source offset while retaining the source end', () => {
    const trimmed = editClip(clip, [clip], 'trim-start', 6, 30)
    expect(trimmed.start).toBe(6)
    expect(trimmed.duration).toBe(4)
    expect(trimmed.sourceStart).toBe(10)
    expect(trimmed.sourceDuration).toBe(4)
    expect(trimmed.sourceLength).toBe(20)
    expect(trimmed.sourceStart! + trimmed.duration).toBe(14)
  })

  it('blocks trims beyond source bounds, zero, neighbors, and one frame', () => {
    expect(editClip(clip, [before, clip], 'trim-start', -9, 30).start).toBe(2)
    const limited = { ...clip, sourceStart: 1 }
    expect(editClip(limited, [limited], 'trim-start', -9, 30).start).toBe(3)
    expect(editClip(clip, [clip, after], 'trim-end', 99, 30).duration).toBe(8)
    expect(editClip(clip, [clip], 'trim-end', 99, 30).duration).toBe(12)
    expect(editClip(clip, [clip], 'trim-end', -99, 30).duration).toBeCloseTo(1 / 30)
    expect(editClip(clip, [clip], 'trim-start', 99, 30).duration).toBeCloseTo(1 / 30)
    expect(editClip(clip, [clip], 'move', NaN, 30)).toEqual(clip)
  })

  it('splits a moved/trimmed clip without losing original media bounds', () => {
    const [left, right] = splitClip(clip, 7, 30)!
    expect(clipEnd(left)).toBe(right.start)
    expect(right.sourceStart).toBe(11)
    expect(left.sourceDuration).toBe(3)
    expect(right.sourceDuration).toBe(3)
    expect(left.sourceLength).toBe(20)
    expect(right.sourceLength).toBe(20)
    expect(left.id).not.toBe(right.id)
    expect(canSplitClip(clip, 4, 30)).toBe(false)
    expect(canSplitClip(clip, 10, 30)).toBe(false)
    expect(splitClip(clip, Infinity, 30)).toBeNull()
  })

  it('recalculates project duration, including an empty project', () => {
    expect(projectDuration(tracks)).toBe(15)
    expect(projectDuration([])).toBe(0)
  })
})
