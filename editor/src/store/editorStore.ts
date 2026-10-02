import { create } from 'zustand'
import type { EditorProject } from '../types/editor'

interface EditorState {
  project: EditorProject
  setCurrentTime: (time: number) => void
  loadVideo: (name: string, duration: number) => void
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

  setCurrentTime: (time) =>
    set((state) => ({
      project: {
        ...state.project,
        currentTime: Math.min(Math.max(time, 0), state.project.duration),
      },
    })),

  loadVideo: (name, duration) =>
    set((state) => ({
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
                    id: crypto.randomUUID(),
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
    })),
}))
