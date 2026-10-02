import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editorStore'

const state = () => useEditorStore.getState()
const videos = () => state().project.tracks[0].clips
beforeEach(() => { state().loadVideo('test.mp4', 9) })

function splitThree() {
  state().splitSelectedClip(3)
  state().splitSelectedClip(6)
  state().selectClip(videos()[1].id)
}

describe('editor state operations', () => {
  it('default delete preserves middle gap and source offsets', () => {
    splitThree()
    state().deleteSelectedClip()
    expect(videos().map(c => [c.start, c.duration, c.sourceStart])).toEqual([[0, 3, 0], [6, 3, 6]])
    expect(state().project.duration).toBe(9)
    expect(state().selectedClipId).toBeNull()
  })

  it('ripple delete moves later clips only, keeping source offsets', () => {
    splitThree()
    state().deleteSelectedClip(true)
    expect(videos().map(c => [c.start, c.duration, c.sourceStart])).toEqual([[0, 3, 0], [3, 3, 6]])
    expect(state().project.duration).toBe(6)
  })

  it('clamps playhead after trimming/deleting the last clip', () => {
    state().setCurrentTime(8)
    state().editClip(videos()[0].id, 'trim-end', 5)
    expect(state().project.currentTime).toBe(5)
    state().deleteSelectedClip()
    expect(state().project.duration).toBe(0)
    expect(state().project.currentTime).toBe(0)
    expect(videos()).toHaveLength(0)
  })

  it('replaces media cleanly after edits and guards invalid time/duration', () => {
    splitThree()
    state().loadVideo('replacement.mp4', 4)
    expect(videos()).toHaveLength(1)
    expect(videos()[0].sourceLength).toBe(4)
    expect(state().project.currentTime).toBe(0)
    state().loadVideo('invalid.mp4', Infinity)
    state().setCurrentTime(NaN)
    expect(state().project.name).toBe('replacement.mp4')
    expect(state().project.currentTime).toBe(0)
  })
})
