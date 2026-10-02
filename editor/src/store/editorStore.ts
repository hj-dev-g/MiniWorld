import { create } from 'zustand'
import { clipEnd, editClip, projectDuration, splitClip, type EditMode } from '../engine/timeline'
import { constrainImage, fitImageSize, type ImagePatch } from '../engine/imageGeometry'
import type { VideoAsset, ProjectBundle, AudioAsset, EditorProject, ImageAsset, SoundStyle, TextStyle, Track } from '../types/editor'

interface Snapshot {
  project: EditorProject
  selectedClipId: string | null
}

interface EditorState extends Snapshot {
  videoAssets: Record<string, VideoAsset>
  addVideo: (asset: VideoAsset) => void
  insertVideo: (assetId: string) => void
  restoreProject: (bundle: ProjectBundle) => void
  renameProject: (name: string) => void

  audioAssets: Record<string, AudioAsset>
  addAudio: (asset: AudioAsset) => void
  insertAudio: (assetId: string) => void
  updateSound: (clipId: string, patch: Partial<SoundStyle>) => void
  imageAssets: Record<string, ImageAsset>
  mediaRevision: number
  addImage: (asset: ImageAsset) => void
  insertImage: (assetId: string) => void
  updateImage: (clipId: string, patch: ImagePatch) => void
  past: Snapshot[]
  future: Snapshot[]
  editBaseline: Snapshot | null
  setCurrentTime: (time: number) => void
  loadVideo: (name: string, duration: number) => void
  selectClip: (clipId: string) => void
  editClip: (clipId: string, mode: EditMode, target: number, tolerance?: number) => void
  splitSelectedClip: (time: number) => void
  deleteSelectedClip: (closeGap?: boolean) => void
  addText: () => void
  updateText: (clipId: string, patch: Partial<TextStyle>) => void
  beginEdit: () => void
  commitEdit: () => void
  cancelEdit: () => void
  undo: () => void
  redo: () => void
}

const initialProject: EditorProject = {
  id: 'local-project', name: 'Instagram Reel',
  canvas: { width: 1080, height: 1920, fps: 30 },
  duration: 0, currentTime: 0,
  tracks: [
    { id: 'video-track', type: 'video', clips: [] },
    { id: 'text-track', type: 'text', clips: [] },
    { id: 'image-track', type: 'image', clips: [] },
    { id: 'audio-track', type: 'audio', clips: [] },
  ],
}

const HISTORY_LIMIT = 100
const snapshot = (state: Snapshot): Snapshot => ({ project: state.project, selectedClipId: state.selectedClipId })
const sameContent = (a: EditorProject, b: EditorProject) =>
  JSON.stringify([a.name, a.canvas, a.tracks]) === JSON.stringify([b.name, b.canvas, b.tracks])

function withTracks(project: EditorProject, tracks: Track[]): EditorProject {
  const duration = projectDuration(tracks)
  return { ...project, tracks, duration, currentTime: Math.min(project.currentTime, duration) }
}

function restore(state: EditorState, saved: Snapshot): Snapshot {
  return { ...saved, project: { ...saved.project,
    currentTime: Math.min(state.project.currentTime, saved.project.duration),
  } }
}

function finishEdit(state: EditorState): EditorState {
  if (!state.editBaseline) return state
  if (sameContent(state.editBaseline.project, state.project)) return { ...state, editBaseline: null }
  return { ...state, editBaseline: null,
    past: [...state.past, state.editBaseline].slice(-HISTORY_LIMIT), future: [],
  }
}

function record(state: EditorState, project: EditorProject, selectedClipId = state.selectedClipId): EditorState {
  if (sameContent(state.project, project)) return { ...state, selectedClipId }
  if (state.editBaseline) return { ...state, project, selectedClipId }
  return { ...state, project, selectedClipId,
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT), future: [],
  }
}

function insertImageClip(state: EditorState, asset: ImageAsset): EditorState {
  const { canvas, currentTime, duration } = state.project
  const start = Math.floor(currentTime * canvas.fps) / canvas.fps
  const remaining = duration - start
  const id = crypto.randomUUID()
  const clip = {
    id, name: asset.name, type: 'image' as const, start,
    duration: remaining >= 1 / canvas.fps ? Math.min(3, remaining) : 3,
    image: { assetId: asset.id, x: canvas.width / 2, y: canvas.height / 2, opacity: 1, ...fitImageSize(asset, canvas) },
  }
  const tracks = state.project.tracks.map(track => track.type !== 'image' ? track : {
    ...track, clips: [...track.clips, clip].sort((a, b) => a.start - b.start),
  })
  return record(state, withTracks(state.project, tracks), id)
}

function insertAudioClip(state: EditorState, asset: AudioAsset): EditorState {
  const { canvas, currentTime, duration } = state.project
  const start = Math.floor(currentTime * canvas.fps) / canvas.fps
  const remaining = duration - start
  const length = remaining >= 1 / canvas.fps ? Math.min(asset.duration, remaining) : asset.duration
  const id = crypto.randomUUID()
  const clip = { id, name: asset.name, type: 'audio' as const, start, duration: length,
    sourceStart: 0, sourceDuration: length, sourceLength: asset.duration,
    audioAssetId: asset.id, sound: { volume: .5, muted: false },
  }
  const tracks = state.project.tracks.map(track => track.type !== 'audio' ? track : {
    ...track, clips: [...track.clips, clip].sort((a, b) => a.start - b.start),
  })
  return record(state, withTracks(state.project, tracks), id)
}

function insertVideoClip(state: EditorState, asset: VideoAsset): EditorState {
  const start = Math.max(0, ...state.project.tracks.filter(t => t.type === 'video').flatMap(t => t.clips.map(clipEnd)))
  const id = crypto.randomUUID()
  const clip = { id, name: asset.name, type: 'video' as const, start, duration: asset.duration,
    sourceStart: 0, sourceDuration: asset.duration, sourceLength: asset.duration,
    videoAssetId: asset.id, sound: { volume: 1, muted: false } }
  const tracks = state.project.tracks.map(track => track.type !== 'video' ? track : { ...track, clips: [...track.clips, clip] })
  return record(state, withTracks({ ...state.project, currentTime: start }, tracks), id)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const fonts: TextStyle['fontFamily'][] = ['system-ui', 'Malgun Gothic', 'Arial', 'Georgia', 'monospace']

export const useEditorStore = create<EditorState>((set) => ({
  project: initialProject,
  selectedClipId: null, videoAssets: {}, audioAssets: {}, imageAssets: {}, mediaRevision: 0, past: [], future: [], editBaseline: null,
  addVideo: asset => set(current => {
    if (!asset.id || !asset.url || !Number.isFinite(asset.duration) || asset.duration <= 0 || current.videoAssets[asset.id]) return current
    return insertVideoClip({ ...finishEdit(current), videoAssets: { ...current.videoAssets, [asset.id]: asset } }, asset)
  }),
  insertVideo: id => set(current => current.videoAssets[id] ? insertVideoClip(finishEdit(current), current.videoAssets[id]) : current),
  restoreProject: bundle => set(state => ({ ...bundle, selectedClipId: null, past: [], future: [], editBaseline: null, mediaRevision: state.mediaRevision + 1 })),
  renameProject: name => set(state => record(state, { ...state.project, name: name.slice(0, 100) || 'Instagram Reel' })),
  setCurrentTime: time => set(state => Number.isFinite(time) ? {
    project: { ...state.project, currentTime: clamp(time, 0, state.project.duration) },
  } : state),

  loadVideo: (name, duration) => {
    if (!Number.isFinite(duration) || duration <= 0) return
    const id = crypto.randomUUID()
    // Legacy reset helper for timeline fixtures; real imports use addVideo with retained sources.
    set(state => ({
      selectedClipId: id, videoAssets: {}, audioAssets: {}, imageAssets: {}, mediaRevision: state.mediaRevision + 1, past: [], future: [], editBaseline: null,
      project: { ...state.project, name, duration, currentTime: 0,
        tracks: state.project.tracks.map(track => ({ ...track,
          clips: track.type === 'video' ? [{
            id, name, type: 'video', start: 0, duration,
            sourceStart: 0, sourceDuration: duration, sourceLength: duration, sound: { volume: 1, muted: false },
          }] : [],
        })),
      },
    }))
  },
  selectClip: clipId => set(state => clipId === state.selectedClipId
    ? state : { ...finishEdit(state), selectedClipId: clipId }),

  beginEdit: () => set(state => state.editBaseline ? state : { editBaseline: snapshot(state) }),
  commitEdit: () => set(finishEdit),
  cancelEdit: () => set(state => state.editBaseline
    ? { ...restore(state, state.editBaseline), editBaseline: null } : state),
  undo: () => set(current => {
    const state = finishEdit(current)
    const saved = state.past.at(-1)
    if (!saved) return state
    return { ...state, ...restore(state, saved),
      past: state.past.slice(0, -1), future: [...state.future, snapshot(state)].slice(-HISTORY_LIMIT),
    }
  }),
  redo: () => set(current => {
    const state = finishEdit(current)
    const saved = state.future.at(-1)
    if (!saved) return state
    return { ...state, ...restore(state, saved),
      past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT), future: state.future.slice(0, -1),
    }
  }),

  addText: () => set(current => {
    const state = finishEdit(current)
    const { canvas, currentTime, duration } = state.project
    const start = Math.floor(currentTime * canvas.fps) / canvas.fps
    const remaining = duration - start
    const id = crypto.randomUUID()
    const text: TextStyle = {
      value: '텍스트를 입력하세요', fontFamily: 'system-ui', fontSize: 72,
      color: '#ffffff', align: 'center', bold: true, shadow: true,
      x: canvas.width / 2, y: canvas.height * .8,
    }
    const tracks = state.project.tracks.map(track => track.type !== 'text' ? track : {
      ...track, clips: [...track.clips, {
        id, name: text.value, type: 'text' as const, start,
        duration: remaining >= 1 / canvas.fps ? Math.min(3, remaining) : 3, text,
      }].sort((a, b) => a.start - b.start),
    })
    return record(state, withTracks(state.project, tracks), id)
  }),

  addAudio: asset => set(current => {
    if (!asset.id || !asset.url || !Number.isFinite(asset.duration) || asset.duration <= 0 || current.audioAssets[asset.id]) return current
    const state = { ...finishEdit(current), audioAssets: { ...current.audioAssets, [asset.id]: asset } }
    return insertAudioClip(state, asset)
  }),
  insertAudio: assetId => set(current => {
    const asset = current.audioAssets[assetId]
    return asset ? insertAudioClip(finishEdit(current), asset) : current
  }),
  updateSound: (clipId, patch) => set(state => {
    const tracks = state.project.tracks.map(track => ({ ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId || (clip.type !== 'video' && clip.type !== 'audio')) return clip
        const original = clip.sound ?? { volume: 1, muted: false }
        const sound = { volume: Number.isFinite(patch.volume) ? clamp(patch.volume!, 0, 1) : original.volume,
          muted: typeof patch.muted === 'boolean' ? patch.muted : original.muted }
        return sound.volume === original.volume && sound.muted === original.muted ? clip : { ...clip, sound }
      }),
    }))
    return record(state, withTracks(state.project, tracks))
  }),

  addImage: asset => set(current => {
    if (!asset.id || !asset.url || !Number.isFinite(asset.width) || !Number.isFinite(asset.height) || asset.width <= 0 || asset.height <= 0) return current
    // Asset URLs remain outside snapshots so deleted/undone clips can reuse them.
    if (current.imageAssets[asset.id]) return current
    const state = { ...finishEdit(current), imageAssets: { ...current.imageAssets, [asset.id]: asset } }
    return insertImageClip(state, asset)
  }),
  insertImage: assetId => set(current => {
    const asset = current.imageAssets[assetId]
    return asset ? insertImageClip(finishEdit(current), asset) : current
  }),
  updateImage: (clipId, patch) => set(state => {
    const tracks = state.project.tracks.map(track => ({ ...track,
      clips: track.clips.map(clip => {
        const asset = clip.image && state.imageAssets[clip.image.assetId]
        return clip.id === clipId && clip.image && asset
          ? { ...clip, image: constrainImage(clip.image, patch, asset, state.project.canvas) } : clip
      }),
    }))
    return record(state, withTracks(state.project, tracks))
  }),

  updateText: (clipId, patch) => set(state => {
    const { width, height } = state.project.canvas
    const safe: Partial<TextStyle> = {}
    if (patch.value !== undefined) safe.value = patch.value.slice(0, 1000)
    if (patch.fontFamily && fonts.includes(patch.fontFamily)) safe.fontFamily = patch.fontFamily
    if (Number.isFinite(patch.fontSize)) safe.fontSize = clamp(patch.fontSize!, 12, 240)
    if (patch.color && /^#[0-9a-f]{6}$/i.test(patch.color)) safe.color = patch.color
    if (patch.align && ['left', 'center', 'right'].includes(patch.align)) safe.align = patch.align
    if (typeof patch.bold === 'boolean') safe.bold = patch.bold
    if (typeof patch.shadow === 'boolean') safe.shadow = patch.shadow
    if (Number.isFinite(patch.x)) safe.x = clamp(patch.x!, 0, width)
    if (Number.isFinite(patch.y)) safe.y = clamp(patch.y!, 0, height)
    const tracks = state.project.tracks.map(track => ({ ...track,
      clips: track.clips.map(clip => clip.id === clipId && clip.text ? {
        ...clip, text: { ...clip.text, ...safe },
        name: (safe.value ?? clip.text.value).trim().split('\n')[0].slice(0, 28) || '텍스트',
      } : clip),
    }))
    return record(state, withTracks(state.project, tracks))
  }),

  editClip: (clipId, mode, target, tolerance = 0) => set(current => {
    const state = finishEdit(current)
    return record(state, withTracks(state.project, state.project.tracks.map(track => ({ ...track,
      clips: track.clips.map(clip => clip.id === clipId
        ? editClip(clip, track.clips, mode, target, state.project.canvas.fps, state.project.currentTime, tolerance)
        : clip).sort((a, b) => a.start - b.start),
    }))))
  }),

  splitSelectedClip: time => set(current => {
    const state = finishEdit(current)
    let selectedClipId = state.selectedClipId
    const tracks = state.project.tracks.map(track => ({ ...track,
      clips: track.clips.flatMap(clip => {
        if (clip.id !== state.selectedClipId) return [clip]
        const pair = splitClip(clip, time, state.project.canvas.fps)
        if (!pair) return [clip]
        selectedClipId = pair[1].id
        return pair
      }),
    }))
    return record(state, withTracks(state.project, tracks), selectedClipId)
  }),

  deleteSelectedClip: (closeGap = false) => set(current => {
    const state = finishEdit(current)
    const selected = state.project.tracks.flatMap(track => track.clips).find(clip => clip.id === state.selectedClipId)
    if (!selected) return state
    const tracks = state.project.tracks.map(track => {
      if (!track.clips.some(clip => clip.id === selected.id)) return track
      return { ...track, clips: track.clips.filter(clip => clip.id !== selected.id).map(clip =>
        closeGap && clip.start >= clipEnd(selected)
          ? { ...clip, start: clip.start - selected.duration } : clip) }
    })
    return record(state, withTracks(state.project, tracks), null)
  }),
}))
