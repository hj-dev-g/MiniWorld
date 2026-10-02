import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { activeVideo, sourceTime } from './timeline'
import { useEditorStore } from '../store/editorStore'

/** Project time is the master clock, including intervals without an active video. */
export function useTimelinePlayback(videoRef: RefObject<HTMLVideoElement | null>, videoUrl: string | null) {
  const { project, setCurrentTime } = useEditorStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const playing = useRef(false)
  const anchor = useRef({ time: 0, wall: 0 })
  const activeId = useRef<string | null>(null)
  const playPending = useRef(false)

  const pause = useCallback(() => {
    playing.current = false
    setIsPlaying(false)
    videoRef.current?.pause()
  }, [videoRef])

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time)
    anchor.current = { time: useEditorStore.getState().project.currentTime, wall: performance.now() }
  }, [setCurrentTime])

  useEffect(() => {
    pause()
    activeId.current = null
    setVisible(false)
    setError(null)
  }, [videoUrl, pause])

  useEffect(() => {
    if (!isPlaying) return
    anchor.current = { time: useEditorStore.getState().project.currentTime, wall: performance.now() }
    let frame = 0
    const tick = (now: number) => {
      if (!playing.current) return
      const { duration } = useEditorStore.getState().project
      const time = anchor.current.time + (now - anchor.current.wall) / 1000
      setCurrentTime(Math.min(time, duration))
      if (time >= duration) pause()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, pause, setCurrentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl || video.readyState < 1) return
    const clip = activeVideo(project.tracks, project.currentTime)
    if (!clip) {
      activeId.current = null
      video.pause()
      setVisible(false)
      return
    }
    const target = sourceTime(clip, project.currentTime)
    const changedClip = activeId.current !== clip.id
    activeId.current = clip.id
    const drift = Math.abs(video.currentTime - target)
    if ((changedClip || !video.seeking) && drift > (isPlaying ? 0.15 : 1 / (project.canvas.fps * 2))) {
      video.pause()
      setVisible(false)
      video.currentTime = target
    }
    if (!video.seeking) setVisible(true)
    if (isPlaying && video.paused && !video.seeking && !playPending.current) {
      playPending.current = true
      void video.play().catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('영상 재생에 실패했습니다. 브라우저가 지원하는 MP4/WebM을 선택하세요.')
        pause()
      }).finally(() => { playPending.current = false })
    } else if (!isPlaying) video.pause()
  }, [project.currentTime, project.tracks, project.canvas.fps, isPlaying, videoRef, videoUrl, pause])

  const onSeeked = () => {
    const video = videoRef.current
    const { project: current } = useEditorStore.getState()
    const clip = activeVideo(current.tracks, current.currentTime)
    if (video && clip && Math.abs(video.currentTime - sourceTime(clip, current.currentTime)) < 0.2) {
      setVisible(true)
      if (playing.current) void video.play().catch(() => {})
    }
  }

  const togglePlayback = () => {
    if (playing.current) { pause(); return }
    const current = useEditorStore.getState().project
    if (current.duration <= 0) return
    if (current.currentTime >= current.duration) seekTo(0)
    setError(null)
    playing.current = true
    setIsPlaying(true)
  }

  return { isPlaying, visible, error, setError, pause, seekTo, togglePlayback, onSeeked }
}
