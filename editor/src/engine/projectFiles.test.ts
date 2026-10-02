import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { captureProject, restoreSaved, writeProject, readProject } from './projectFiles'

const state = () => useEditorStore.getState()
beforeEach(() => {
  const project = structuredClone(state().project)
  project.name = 'Roundtrip'; project.duration = 0; project.currentTime = 0
  project.tracks.forEach(t => { t.clips = [] })
  state().restoreProject({project,videoAssets:{},audioAssets:{},imageAssets:{}})
})
function mediaProject() {
  state().addVideo({id:'video-a',name:'a.mp4',url:'blob:a',duration:4,width:180,height:320,file:new Blob(['video'],{type:'video/mp4'})})
  state().addVideo({id:'video-b',name:'b.mp4',url:'blob:b',duration:2,width:180,height:320,file:new Blob(['video2'],{type:'video/mp4'})})
  state().setCurrentTime(1)
  state().addAudio({id:'audio-a',name:'music.wav',url:'blob:audio',duration:8,file:new Blob(['music'],{type:'audio/wav'})})
  state().addImage({id:'image-a',name:'image.png',url:'blob:image',width:400,height:200,file:new Blob(['image'],{type:'image/png'})})
  state().addText()
}

describe('portable projects and validated restore', () => {
  it('appends distinct source videos without clearing overlays/history, and keeps sources for Undo', () => {
    mediaProject(); const clips = state().project.tracks[0].clips
    expect(clips.map(c => [c.start,c.duration,c.videoAssetId])).toEqual([[0,4,'video-a'],[4,2,'video-b']])
    const count = state().past.length
    state().insertVideo('video-a')
    expect(state().project.duration).toBe(10)
    expect(state().project.tracks.find(t=>t.type==='text')!.clips).toHaveLength(1)
    expect(state().past.length).toBe(count+1)
    state().undo(); expect(state().project.duration).toBe(6)
    expect(Object.keys(state().videoAssets)).toHaveLength(2)
    state().redo(); expect(state().project.tracks[0].clips[2].videoAssetId).toBe('video-a')
  })
  it('recreates media URLs from blobs while preserving authored settings and source trims', async () => {
    mediaProject(); const first = state().project.tracks[0].clips[0]
    state().editClip(first.id,'trim-start',.5)
    state().updateSound(first.id,{volume:.2,muted:true})
    const saved = captureProject(state())
    expect(JSON.stringify(saved.manifest)).not.toContain('blob:')
    const restored = restoreSaved(saved)
    expect(restored.project).toEqual(state().project)
    expect(restored.videoAssets['video-a'].url).not.toBe('blob:a')
    expect(await restored.audioAssets['audio-a'].file!.text()).toBe('music')
    expect(Object.keys(restored.imageAssets)).toHaveLength(1)
    state().restoreProject(restored)
    expect(state().past).toEqual([]); expect(state().selectedClipId).toBeNull()
  })
  it('roundtrips an archive containing all media and rejects broken/missing media or overlapping clips', async () => {
    mediaProject(); const original = captureProject(state())
    const blob = await writeProject(state())
    const restored = await readProject(new File([blob],'test.miniworld'))
    expect(restored.project).toEqual(original.manifest.project)
    expect(await restored.videoAssets['video-b'].file!.text()).toBe('video2')
    const missing = {...original,files:{}}
    expect(()=>restoreSaved(missing)).toThrow('누락')
    const overlap = structuredClone(original)
    overlap.manifest.project.tracks[0].clips[1].start = 1
    expect(()=>restoreSaved(overlap)).toThrow('겹칩니다')
    const invalid = structuredClone(original)
    invalid.manifest.project.tracks[0].clips[0].sourceStart = 8
    expect(()=>restoreSaved(invalid)).toThrow('범위')
    const before = state().project
    await expect(readProject(new File(['bad'],'bad.miniworld'))).rejects.toThrow()
    expect(state().project).toBe(before)
  })
  it('rejects invalid numbers/version and does not accept URLs supplied in an archive manifest', () => {
    mediaProject(); const saved = captureProject(state())
    expect(()=>restoreSaved({...saved,manifest:{...saved.manifest,version:2}})).toThrow()
    const invalid = structuredClone(saved); invalid.manifest.project.tracks[0].clips[0].duration = NaN
    expect(()=>restoreSaved(invalid)).toThrow()
    const restored = restoreSaved({...saved, manifest:{...saved.manifest,assets:saved.manifest.assets.map(a=>({...a,url:'https://example.com/remote.mp4'}))}})
    expect(restored.videoAssets['video-a'].url).toMatch(/^blob:/)
  })
})
