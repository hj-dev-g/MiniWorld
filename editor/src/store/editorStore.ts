import { create } from 'zustand'
import { clipEnd, editClip, projectDuration, splitClip, type EditMode } from '../engine/timeline'
import type { EditorProject, Track } from '../types/editor'

interface EditorState {
  project: EditorProject
  selectedClipId: string | null
  setCurrentTime: (time: number) => void
  loadVideo: (name: string, duration: number) => void
  selectClip: (clipId: string) => void
  editClip: (clipId: string, mode: EditMode, target: number, tolerance?: number) => void
  splitSelectedClip: (time: number) => void
  deleteSelectedClip: (closeGap?: boolean) => void
}

const initialProject: EditorProject = {
  id: 'local-project', name: 'Instagram Reel',
  canvas: { width: 1080, height: 1920, fps: 30 },
  duration: 0, currentTime: 0,
  tracks: [
    { id: 'video-track', type: 'video', clips: [] },
    { id: 'text-track', type: 'text', clips: [] },
    { id: 'audio-track', type: 'audio', clips: [] },
  ],
}

function withTracks(project: EditorProject, tracks: Track[]): EditorProject {
  const duration = projectDuration(tracks)
  return { ...project, tracks, duration, currentTime: Math.min(project.currentTime, duration) }
}

export const useEditorStore = create<EditorState>((set) => ({
  project: initialProject,
  selectedClipId: null,
  setCurrentTime: (time) => set(state => Number.isFinite(time) ? {
    project: { ...state.project, currentTime: Math.min(Math.max(time, 0), state.project.duration) },
  } : state),

  loadVideo: (name, duration) => {
    if (!Number.isFinite(duration) || duration <= 0) return
    const id = crypto.randomUUID()
    set(state => ({
      selectedClipId: id,
      project: { ...state.project, name, duration, currentTime: 0,
        tracks: state.project.tracks.map(track => ({ ...track,
          clips: track.type === 'video' ? [{
            id, name, type: 'video', start: 0, duration,
            sourceStart: 0, sourceDuration: duration, sourceLength: duration,
          }] : [],
        })),
      },
    }))
  },
  selectClip: clipId => set({ selectedClipId: clipId }),

  editClip: (clipId, mode, target, tolerance = 0) => set(state => ({
    project: withTracks(state.project, state.project.tracks.map(track => ({ ...track,
      clips: track.clips.map(clip => clip.id === clipId
        ? editClip(clip, track.clips, mode, target, state.project.canvas.fps, state.project.currentTime, tolerance)
        : clip).sort((a, b) => a.start - b.start),
    }))),
  })),

  splitSelectedClip: time => set(state => {
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
    return { selectedClipId, project: withTracks(state.project, tracks) }
  }),

  deleteSelectedClip: (closeGap = false) => set(state => {
    const selected = state.project.tracks.flatMap(track => track.clips).find(clip => clip.id === state.selectedClipId)
    if (!selected) return state
    // Ripple only the selected track; future overlays/audio stay at their authored times.
    const tracks = state.project.tracks.map(track => {
      if (!track.clips.some(clip => clip.id === selected.id)) return track
      return { ...track, clips: track.clips.filter(clip => clip.id !== selected.id).map(clip =>
        closeGap && clip.start >= clipEnd(selected)
          ? { ...clip, start: clip.start - selected.duration } : clip) }
    })
    return { selectedClipId: null, project: withTracks(state.project, tracks) }
  }),
}))
