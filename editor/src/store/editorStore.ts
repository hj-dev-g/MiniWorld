import { create } from 'zustand'
import type { EditorProject } from '../types/editor'

interface EditorState {
  project: EditorProject
  selectedClipId: string | null
  setCurrentTime: (time: number) => void
  loadVideo: (name: string, duration: number) => void
  selectClip: (clipId: string) => void
  splitSelectedClip: (time: number) => void
}

const initialProject: EditorProject = {
  id: 'demo-project',
  name: 'Instagram Reel',
  canvas: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  duration: 30,
  currentTime: 8.4,
  tracks: [
    {
      id: 'video-track',
      type: 'video',
      clips: [
        {
          id: 'video-a',
          name: 'intro.mp4',
          type: 'video',
          start: 0,
          duration: 10,
          sourceStart: 0,
          sourceDuration: 10,
        },
        {
          id: 'video-b',
          name: 'drawing.mp4',
          type: 'video',
          start: 11,
          duration: 12,
          sourceStart: 4,
          sourceDuration: 12,
        },
      ],
    },
    {
      id: 'text-track',
      type: 'text',
      clips: [
        {
          id: 'text-a',
          name: '오늘도 그림중',
          type: 'text',
          start: 4,
          duration: 12,
        },
      ],
    },
    {
      id: 'audio-track',
      type: 'audio',
      clips: [
        {
          id: 'audio-a',
          name: 'bgm.mp3',
          type: 'audio',
          start: 0,
          duration: 27,
        },
      ],
    },
  ],
}

export const useEditorStore = create<EditorState>((set) => ({
  project: initialProject,
  selectedClipId: null,

  setCurrentTime: (time) =>
    set((state) => ({
      project: {
        ...state.project,
        currentTime: Math.min(Math.max(time, 0), state.project.duration),
      },
    })),

  loadVideo: (name, duration) => {
    const clipId = crypto.randomUUID()

    set((state) => ({
      selectedClipId: clipId,
      project: {
        ...state.project,
        name,
        duration,
        currentTime: 0,
        tracks: state.project.tracks.map((track) => ({
          ...track,
          clips:
            track.type === 'video'
              ? [
                  {
                    id: clipId,
                    name,
                    type: 'video',
                    start: 0,
                    duration,
                    sourceStart: 0,
                    sourceDuration: duration,
                  },
                ]
              : [],
        })),
      },
    }))
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  splitSelectedClip: (time) =>
    set((state) => {
      if (!state.selectedClipId) {
        return state
      }

      let nextSelectedClipId = state.selectedClipId
      let didSplit = false

      const tracks = state.project.tracks.map((track) => ({
        ...track,
        clips: track.clips.flatMap((clip) => {
          if (clip.id !== state.selectedClipId) {
            return [clip]
          }

          const clipEnd = clip.start + clip.duration
          const splitOffset = time - clip.start

          if (splitOffset <= 0.05 || time >= clipEnd - 0.05) {
            return [clip]
          }

          didSplit = true

          const leftId = crypto.randomUUID()
          const rightId = crypto.randomUUID()
          const sourceStart = clip.sourceStart ?? 0

          nextSelectedClipId = rightId

          return [
            {
              ...clip,
              id: leftId,
              duration: splitOffset,
              sourceDuration: splitOffset,
            },
            {
              ...clip,
              id: rightId,
              start: time,
              duration: clipEnd - time,
              sourceStart: sourceStart + splitOffset,
              sourceDuration: clipEnd - time,
            },
          ]
        }),
      }))

      if (!didSplit) {
        return state
      }

      return {
        ...state,
        selectedClipId: nextSelectedClipId,
        project: {
          ...state.project,
          tracks,
        },
      }
    }),
}))
