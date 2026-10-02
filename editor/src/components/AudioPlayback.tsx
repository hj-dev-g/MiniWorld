import { useEffect, useRef, useState } from 'react'
import { clipEnd, sourceTime } from '../engine/timeline'
import { useEditorStore } from '../store/editorStore'
import type { Clip, EditorProject } from '../types/editor'

export function AudioPlayback({ project, isPlaying, onFailure }: {
  project: EditorProject; isPlaying: boolean; onFailure: (message: string) => void
}) {
  const assets = useEditorStore(state => state.audioAssets)
  return <div hidden aria-hidden="true">{project.tracks.flatMap(track => track.type === 'audio' ? track.clips : []).map(clip => {
    const asset = clip.audioAssetId && assets[clip.audioAssetId]
    return asset ? <AudioClip key={clip.id} clip={clip} url={asset.url} time={project.currentTime} fps={project.canvas.fps} isPlaying={isPlaying} onFailure={onFailure} /> : null
  })}</div>
}

function AudioClip({ clip, url, time, fps, isPlaying, onFailure }: {
  clip: Clip; url: string; time: number; fps: number; isPlaying: boolean; onFailure: (message: string) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const wanted = useRef(false)
  const playPending = useRef(false)
  const [readyVersion, wake] = useState(0)
  const failure = useRef(onFailure)
  failure.current = onFailure
  useEffect(() => {
    const audio = audioRef.current
    return () => { wanted.current = false; audio?.pause() }
  }, [])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const active = time >= clip.start && time < clipEnd(clip)
    wanted.current = active && isPlaying
    audio.volume = clip.sound?.volume ?? .5
    audio.muted = clip.sound?.muted ?? false
    if (!active) { audio.pause(); return }
    if (audio.readyState < 1) return
    const target = sourceTime(clip, time)
    if (!audio.seeking && Math.abs(audio.currentTime - target) > (isPlaying ? .15 : 1 / (fps * 2))) {
      audio.pause()
      audio.currentTime = target
    }
    if (!wanted.current) audio.pause()
    else if (audio.paused && !audio.seeking && !playPending.current) {
      playPending.current = true
      void audio.play().then(() => { if (!wanted.current) audio.pause() }).catch(err => {
        if (!wanted.current || (err instanceof DOMException && err.name === 'AbortError')) return
        failure.current(`${clip.name}: 오디오 재생에 실패했습니다.`)
      }).finally(() => { playPending.current = false })
    }
  }, [clip, time, fps, isPlaying, readyVersion])
  return <audio ref={audioRef} src={url} preload="auto" data-audio-clip={clip.id}
    onLoadedMetadata={() => wake(v => v + 1)} onCanPlay={() => wake(v => v + 1)} onSeeked={() => wake(v => v + 1)}
    onError={() => failure.current(`${clip.name}: 오디오를 재생할 수 없습니다.`)} />
}
