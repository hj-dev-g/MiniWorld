export type TrackType = 'video' | 'audio' | 'text' | 'image'

export interface VideoAsset {
  id: string
  name: string
  url: string
  file?: Blob
  duration: number
  width: number
  height: number
}

export interface AudioAsset {
  id: string
  name: string
  url: string
  file?: Blob
  duration: number
}

export interface SoundStyle {
  volume: number
  muted: boolean
}

export interface ImageAsset {
  id: string
  name: string
  url: string
  file?: Blob
  width: number
  height: number
}

export interface ImageStyle {
  assetId: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
}

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
  videoAssetId?: string
  audioAssetId?: string
  sound?: SoundStyle
  text?: TextStyle
  image?: ImageStyle
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

export interface ProjectBundle {
  project: EditorProject
  videoAssets: Record<string, VideoAsset>
  audioAssets: Record<string, AudioAsset>
  imageAssets: Record<string, ImageAsset>
}
