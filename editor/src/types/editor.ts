export type TrackType = 'video' | 'audio' | 'text' | 'image'

export interface Clip {
  id: string
  name: string
  type: TrackType
  start: number
  duration: number
  sourceStart?: number
  sourceDuration?: number
  /** Original media length; retained when splitting/trimming. */
  sourceLength?: number
}

export interface Track {
  id: string
  type: TrackType
  clips: Clip[]
}

export interface EditorProject {
  id: string
  name: string
  canvas: {
    width: number
    height: number
    fps: number
  }
  duration: number
  currentTime: number
  tracks: Track[]
}
