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

const texts = () => state().project.tracks.find(track => track.type === 'text')!.clips

describe('text overlays and authored history', () => {
  it('adds text at the playhead and supports concurrent captions', () => {
    state().setCurrentTime(2)
    state().addText()
    state().addText()
    expect(texts()).toHaveLength(2)
    expect(texts().map(clip => [clip.start, clip.duration])).toEqual([[2, 3], [2, 3]])
    state().editClip(texts()[1].id, 'move', 2.5)
    expect(texts()[1].start).toBe(2.5)
    expect(videos()).toHaveLength(1)
  })

  it('supports standalone text and text at the video end', () => {
    state().deleteSelectedClip()
    state().addText()
    expect(state().project.duration).toBe(3)
    expect(texts()[0].text?.x).toBe(540)
    state().loadVideo('another.mp4', 9)
    state().setCurrentTime(9)
    state().addText()
    expect(texts()[0].start).toBe(9)
    expect(state().project.duration).toBe(12)
  })

  it('undoes and redoes video split, move and delete with selection/source intact', () => {
    const original = videos()[0]
    state().splitSelectedClip(3)
    const right = videos()[1]
    state().editClip(right.id, 'move', 5)
    state().deleteSelectedClip()
    expect(videos()).toHaveLength(1)
    state().undo()
    expect(videos()[1].start).toBe(5)
    expect(videos()[1].sourceStart).toBe(3)
    expect(state().selectedClipId).toBe(right.id)
    state().undo()
    expect(videos()[1].start).toBe(3)
    state().undo()
    expect(videos()).toEqual([original])
    state().redo(); state().redo(); state().redo()
    expect(videos()).toHaveLength(1)
    expect(state().selectedClipId).toBeNull()
  })

  it('groups multiple typing/drag updates into one undo entry', () => {
    state().addText()
    const original = texts()[0]
    state().beginEdit()
    state().updateText(original.id, { value: 'a', x: 550 })
    state().updateText(original.id, { value: 'ab', x: 600 })
    state().updateText(original.id, { value: '완성', x: 650, fontSize: 100, align: 'left' })
    expect(state().past).toHaveLength(1)
    state().commitEdit()
    expect(state().past).toHaveLength(2)
    state().undo()
    expect(texts()[0]).toEqual(original)
    state().redo()
    expect(texts()[0].text).toMatchObject({ value: '완성', x: 650, fontSize: 100, align: 'left' })
  })

  it('commits an active edit before undo, or when selecting a different clip', () => {
    state().addText()
    const original = texts()[0]
    state().beginEdit()
    state().updateText(original.id, { value: 'changed' })
    state().undo()
    expect(texts()[0]).toEqual(original)
    state().redo()
    state().beginEdit()
    state().updateText(original.id, { value: 'committed' })
    state().selectClip(videos()[0].id)
    expect(state().editBaseline).toBeNull()
    state().undo()
    expect(texts()[0].text?.value).toBe('changed')
  })

  it('cancels a drag and retains the existing redo branch', () => {
    state().addText()
    const id = texts()[0].id
    state().updateText(id, { color: '#ff0000' })
    state().undo()
    const original = texts()[0]
    state().beginEdit()
    state().updateText(id, { x: 800, y: 900 })
    state().cancelEdit()
    expect(texts()[0]).toEqual(original)
    expect(state().future).toHaveLength(1)
    state().redo()
    expect(texts()[0].text?.color).toBe('#ff0000')
  })

  it('ignores seek, selection and no-op edits; a new edit clears redo', () => {
    state().splitSelectedClip(3)
    state().undo()
    state().setCurrentTime(2)
    state().selectClip(videos()[0].id)
    state().editClip(videos()[0].id, 'move', 0)
    state().splitSelectedClip(0)
    expect(state().past).toHaveLength(0)
    expect(state().future).toHaveLength(1)
    state().editClip(videos()[0].id, 'trim-end', 5)
    expect(state().future).toHaveLength(0)
    expect(state().past).toHaveLength(1)
  })

  it('preserves live playhead across undo and clamps to the restored duration', () => {
    state().editClip(videos()[0].id, 'move', 5)
    state().setCurrentTime(12)
    state().undo()
    expect(state().project.currentTime).toBe(9)
    state().redo()
    expect(state().project.currentTime).toBe(9)
  })

  it('splits text while retaining style and editing children independently', () => {
    state().addText()
    const id = texts()[0].id
    state().updateText(id, { value: '첫줄\n둘째줄', fontFamily: 'Malgun Gothic', shadow: false })
    state().splitSelectedClip(1)
    expect(texts()).toHaveLength(2)
    expect(texts()[1].text).toEqual(texts()[0].text)
    state().updateText(texts()[1].id, { value: '오른쪽' })
    expect(texts()[0].text?.value).toBe('첫줄\n둘째줄')
    expect(texts()[1].text?.value).toBe('오른쪽')
    state().undo()
    expect(texts()[1].text?.value).toBe('첫줄\n둘째줄')
  })

  it('sanitizes text style bounds and keeps video data unaffected', () => {
    const video = videos()[0]
    state().addText()
    const id = texts()[0].id
    state().updateText(id, { x: -99, y: 9999, fontSize: 999, color: 'bad' })
    expect(texts()[0].text).toMatchObject({ x: 0, y: 1920, fontSize: 240, color: '#ffffff' })
    state().updateText(id, { x: NaN, fontSize: Infinity, value: 'a'.repeat(1100) })
    expect(texts()[0].text?.value).toHaveLength(1000)
    expect(texts()[0].text?.x).toBe(0)
    expect(videos()[0]).toEqual(video)
  })

  it('resets history on media replacement and retains at most 100 undo entries', () => {
    state().addText()
    const id = texts()[0].id
    for (let x = 0; x < 110; x++) state().updateText(id, { x })
    expect(state().past).toHaveLength(100)
    state().undo()
    expect(state().future).toHaveLength(1)
    state().loadVideo('replacement.mp4', 4)
    expect(state().past).toHaveLength(0)
    expect(state().future).toHaveLength(0)
    expect(texts()).toHaveLength(0)
    state().undo()
    expect(state().project.name).toBe('replacement.mp4')
  })
})

const images = () => state().project.tracks.find(track => track.type === 'image')!.clips
const asset = { id: 'sticker', name: 'sticker.png', url: 'blob:sticker', width: 400, height: 200 }
describe('image assets and authored history', () => {
  it('imports once, reinserts at the playhead, permits overlap and preserves media', () => {
    const original = videos()[0]
    state().setCurrentTime(2)
    state().addImage(asset)
    state().addImage(asset)
    state().insertImage(asset.id)
    expect(images()).toHaveLength(2)
    expect(images()[0]).toMatchObject({ start: 2, duration: 3, image: { width: 540, height: 270 } })
    state().editClip(images()[1].id, 'move', 2.5)
    expect(images()[1].start).toBe(2.5)
    expect(videos()[0]).toEqual(original)
  })
  it('retains decoded assets across import undo, delete undo and split', () => {
    state().addImage(asset)
    const original = images()[0]
    state().undo()
    expect(images()).toHaveLength(0)
    expect(state().imageAssets[asset.id]).toEqual(asset)
    state().redo()
    expect(images()[0]).toEqual(original)
    state().splitSelectedClip(1)
    expect(images()).toHaveLength(2)
    expect(images()[1].image).toEqual(original.image)
    state().deleteSelectedClip()
    state().undo()
    expect(images()[1].image?.assetId).toBe(asset.id)
    expect(state().imageAssets[asset.id].url).toBe('blob:sticker')
  })
  it('groups image transform edits, cancels gestures, and preserves style on redo', () => {
    state().addImage(asset)
    const original = images()[0]
    state().beginEdit()
    state().updateImage(original.id, { width: 300, x: 300 })
    state().updateImage(original.id, { opacity: .5, y: 700 })
    state().commitEdit()
    expect(state().past).toHaveLength(2)
    state().undo()
    expect(images()[0]).toEqual(original)
    state().beginEdit()
    state().updateImage(original.id, { x: 700 })
    state().cancelEdit()
    expect(images()[0]).toEqual(original)
    state().redo()
    expect(images()[0].image).toMatchObject({ width: 300, height: 150, x: 300, y: 700, opacity: .5 })
  })
  it('supports standalone images and resets assets/history on replacement', () => {
    state().deleteSelectedClip()
    state().addImage(asset)
    expect(state().project.duration).toBe(3)
    state().setCurrentTime(3)
    state().insertImage(asset.id)
    expect(state().project.duration).toBe(6)
    const revision = state().mediaRevision
    state().loadVideo('new.mp4', 4)
    expect(state().mediaRevision).toBe(revision + 1)
    expect(state().imageAssets).toEqual({})
    expect(images()).toHaveLength(0)
    expect(state().past).toHaveLength(0)
    state().insertImage(asset.id)
    state().addImage({ ...asset, height: 0 })
    expect(images()).toHaveLength(0)
  })
})

const audios = () => state().project.tracks.find(track => track.type === 'audio')!.clips
const bgm = { id: 'bgm', name: 'bgm.wav', url: 'blob:bgm', duration: 12 }
describe('BGM and per-clip sound', () => {
  it('adds BGM at the playhead, fits remaining project time and permits mixing', () => {
    const original = videos()[0]
    state().setCurrentTime(2)
    state().addAudio(bgm)
    state().insertAudio(bgm.id)
    expect(audios()).toHaveLength(2)
    expect(audios()[0]).toMatchObject({ start: 2, duration: 7, sourceStart: 0, sourceLength: 12,
      sound: { volume: .5, muted: false }, audioAssetId: bgm.id })
    state().editClip(audios()[1].id, 'move', 3)
    expect(audios()[1].start).toBe(3)
    expect(videos()[0]).toEqual(original)
  })
  it('preserves source offsets and sound on split, trims within source and restores', () => {
    state().addAudio(bgm)
    state().updateSound(audios()[0].id, { volume: .2, muted: true })
    state().splitSelectedClip(3)
    expect(audios()[1]).toMatchObject({ start: 3, duration: 6, sourceStart: 3, sourceLength: 12,
      sound: { volume: .2, muted: true }, audioAssetId: bgm.id })
    state().editClip(audios()[1].id, 'trim-start', 4)
    expect(audios()[1]).toMatchObject({ start: 4, duration: 5, sourceStart: 4 })
    state().editClip(audios()[1].id, 'trim-end', 99)
    expect(audios()[1].duration).toBe(8)
    state().editClip(audios()[1].id, 'trim-start', -99)
    expect(audios()[0].start).toBe(0)
    expect(audios()[1]).toMatchObject({ start: 0, duration: 12, sourceStart: 0 })
  })
  it('groups volume edits, changes only the selected clip and retains mute volume', () => {
    state().addAudio(bgm)
    state().insertAudio(bgm.id)
    const id = audios()[0].id
    const past = state().past.length
    state().beginEdit()
    state().updateSound(id, { volume: .4 })
    state().updateSound(id, { volume: .3 })
    state().commitEdit()
    expect(state().past).toHaveLength(past + 1)
    expect(audios()[1].sound?.volume).toBe(.5)
    expect(videos()[0].sound?.volume).toBe(1)
    state().undo()
    expect(audios()[0].sound?.volume).toBe(.5)
    state().redo()
    state().updateSound(id, { muted: true })
    state().updateSound(id, { muted: false })
    expect(audios()[0].sound).toEqual({ volume: .3, muted: false })
  })
  it('supports independent video sound and restores it through clip/history edits', () => {
    const id = videos()[0].id
    state().updateSound(id, { volume: .25, muted: true })
    state().splitSelectedClip(3)
    expect(videos().map(c => c.sound)).toEqual([{ volume: .25, muted: true }, { volume: .25, muted: true }])
    state().updateSound(videos()[1].id, { volume: .8 })
    state().undo()
    expect(videos()[1].sound?.volume).toBe(.25)
    expect(videos()[0].sound?.volume).toBe(.25)
  })
  it('retains assets through undo and delete, supports standalone audio and end insertion', () => {
    state().deleteSelectedClip()
    state().addAudio(bgm)
    expect(state().project.duration).toBe(12)
    state().undo()
    expect(audios()).toHaveLength(0)
    expect(state().audioAssets[bgm.id]).toEqual(bgm)
    state().redo()
    state().deleteSelectedClip()
    state().undo()
    expect(audios()[0].audioAssetId).toBe(bgm.id)
    state().setCurrentTime(12)
    state().insertAudio(bgm.id)
    expect(audios()[1].start).toBe(12)
    expect(state().project.duration).toBe(24)
  })
  it('sanitizes sound, rejects invalid assets and ignores no-op and nonmedia changes', () => {
    const id = videos()[0].id
    state().updateSound(id, { volume: NaN })
    expect(state().past).toHaveLength(0)
    state().updateSound(id, { volume: -10 })
    expect(videos()[0].sound?.volume).toBe(0)
    state().updateSound(id, { volume: 10 })
    expect(videos()[0].sound?.volume).toBe(1)
    state().addAudio({ ...bgm, duration: Infinity })
    state().insertAudio('missing')
    expect(audios()).toHaveLength(0)
    state().addAudio(bgm)
    state().addAudio(bgm)
    expect(audios()).toHaveLength(1)
    state().addText()
    const past = state().past.length
    state().updateSound(texts()[0].id, { volume: .5 })
    expect(state().past).toHaveLength(past)
  })
  it('resets audio assets and history on new media', () => {
    state().addAudio(bgm)
    state().loadVideo('replacement.mp4', 4)
    expect(state().audioAssets).toEqual({})
    expect(audios()).toHaveLength(0)
    expect(state().past).toHaveLength(0)
    expect(videos()[0].sound).toEqual({ volume: 1, muted: false })
  })
})
