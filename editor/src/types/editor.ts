export type TrackType = 'video' | 'audio' | 'text' | 'image'

export interface TextStyle {
  value: string
  fontFamily: 'system-ui' | 'Malgun Gothic' | 'Arial' | 'Georgia' | 'monospace'
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  shadow: boolean
  /** Center position in original canvas pixels. */
  x: number
  y: number
}

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
  text?: TextStyle
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
