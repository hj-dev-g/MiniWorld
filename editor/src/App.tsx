import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from './store/editorStore'
import type { TrackType } from './types/editor'
import { activeVideo, canSplitClip } from './engine/timeline'
import { useTimelinePlayback } from './engine/useTimelinePlayback'
import { TimelineClip } from './components/TimelineClip'

const trackLabel: Record<TrackType, string> = {
  video: 'VIDEO',
  text: 'TEXT',
  audio: 'AUDIO',
  image: 'IMAGE',
}

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${remainder
    .toFixed(1)
    .padStart(4, '0')}`
}

export function App() {
  const { project, selectedClipId, loadVideo, selectClip, splitSelectedClip, editClip, deleteSelectedClip } = useEditorStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)
  const [pxPerSecond, setPxPerSecond] = useState(28)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const { isPlaying, visible, error, setError, pause, seekTo, togglePlayback, onSeeked } = useTimelinePlayback(videoRef, videoUrl)
  const selectedClip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId)
  const canSplit = !!selectedClip && canSplitClip(selectedClip, project.currentTime, project.canvas.fps)
  const hasActiveVideo = !!activeVideo(project.tracks, project.currentTime)
  const timelineWidth = Math.max((project.duration + 10) * pxPerSecond, 720)
  const playheadLeft = project.currentTime * pxPerSecond

  const timeMarks = useMemo(
    () => Array.from({ length: Math.floor(project.duration / 5) + 1 }, (_, i) => i * 5),
    [project.duration],
  )

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('video/') && !(file.type === '' && /\.(mp4|webm|mov)$/i.test(file.name))) {
      setError('지원하는 영상 파일을 선택하세요.')
      event.target.value = ''
      return
    }

    pause()
    setVideoDuration(0)
    setVideoUrl(URL.createObjectURL(file))
    setVideoName(file.name)
    event.target.value = ''
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current

    if (!video || !videoName) {
      return
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      pause()
      setError('영상 길이를 읽을 수 없습니다. 다른 MP4/WebM을 선택하세요.')
      return
    }

    video.currentTime = 0
    setVideoDuration(video.duration)
    loadVideo(videoName, video.duration)
  }

  const deleteClip = (closeGap = false) => {
    pause()
    deleteSelectedClip(closeGap)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, button, [contenteditable="true"]')) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        pause()
        useEditorStore.getState().deleteSelectedClip(event.shiftKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pause])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong className="brand">MiniWorld Editor</strong>
          <span className="project-name">{project.name}</span>
        </div>
        <div className="topbar-actions">
          <button className="button ghost" disabled title="준비 중">Undo</button>
          <button className="button ghost" disabled title="준비 중">Redo</button>
          <button className="button primary" disabled title="준비 중">Export</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar left-panel">
          <h2>Media</h2>

          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleMediaChange}
          />

          <button
            className="upload-box"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="upload-icon">＋</span>
            <strong>영상 추가</strong>
            <small>MP4 · WebM · MOV</small>
          </button>

          <nav className="asset-tabs">
            <button className="active">미디어</button>
            <button disabled>텍스트</button>
            <button disabled>오디오</button>
            <button disabled>스티커</button>
          </nav>

          {videoName ? (
            <button
              className="media-card"
              onClick={() => seekTo(0)}
              title="처음으로 이동"
            >
              <span className="media-thumb">▶</span>
              <span className="media-info">
                <strong>{videoName}</strong>
                <small>원본 {formatTime(videoDuration)}</small>
              </span>
            </button>
          ) : (
            <div className="asset-empty">
              영상을 추가하면 브라우저에서 바로 미리볼 수 있습니다.
            </div>
          )}
        </aside>

        <section className="preview-area">
          <div className="preview-toolbar">
            <span>9:16</span>
            <span>{project.canvas.width} × {project.canvas.height}</span>
            <span>{project.canvas.fps} FPS</span>
          </div>

          <div className="preview-stage">
            {error && <div className="media-error" role="alert">{error}</div>}
            <div className="phone-canvas">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  className="preview-video"
                  style={{ visibility: visible && hasActiveVideo ? 'visible' : 'hidden' }}
                  src={videoUrl}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={handleLoadedMetadata}
                  onSeeked={onSeeked}
                  onError={() => { pause(); setError('이 영상은 브라우저에서 재생할 수 없습니다. 다른 MP4/WebM을 선택하세요.') }}
                />
              ) : (
                <div className="canvas-copy">
                  <span className="eyebrow">Instagram Reel</span>
                  <h1>영상 추가</h1>
                  <p>로컬 MP4를 올려 편집을 시작하세요.</p>
                </div>
              )}
            </div>
          </div>

          <div className="transport">
            <button disabled={project.duration <= 0} aria-label="1초 뒤로" onClick={() => seekTo(project.currentTime - 1)}>◀</button>
            <button
              className="play"
              onClick={togglePlayback}
              disabled={!videoUrl || project.duration <= 0 || videoDuration <= 0 || !!error}
              aria-label={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
            <button disabled={project.duration <= 0} aria-label="1초 앞으로" onClick={() => seekTo(project.currentTime + 1)}>▶|</button>
            <span>
              {formatTime(project.currentTime)} / {formatTime(project.duration)}
            </span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          <h2>Properties</h2>
          {selectedClip ? (
            <div className="clip-properties">
              <strong>{selectedClip.name}</strong>
              <dl>
                <dt>타임라인 시작</dt><dd>{selectedClip.start.toFixed(2)}초</dd>
                <dt>사용 길이</dt><dd>{selectedClip.duration.toFixed(2)}초</dd>
                <dt>원본 시작</dt><dd>{(selectedClip.sourceStart ?? 0).toFixed(2)}초</dd>
                <dt>원본 끝</dt><dd>{((selectedClip.sourceStart ?? 0) + selectedClip.duration).toFixed(2)}초</dd>
              </dl>
            </div>
          ) : <p className="panel-hint">클립을 선택하면 편집 구간이 표시됩니다.</p>}
          <p className="panel-hint">클립을 드래그해 이동하고, 양쪽 가장자리로 구간을 조절하세요.</p>
          <p className="panel-hint">방향키: 1프레임 이동 · Shift: 10프레임<br />Alt + 드래그: 스냅 해제</p>
        </aside>
      </section>

      <section className="timeline-section">
        <div className="timeline-tools">
          <div>
            <button
              className="button ghost"
              disabled={!canSplit}
              onClick={() => { pause(); splitSelectedClip(project.currentTime) }}
            >
              Split
            </button>
            <button className="button ghost" disabled={!selectedClipId} title="선택 클립 삭제 · 빈 구간 유지 (Delete)" onClick={() => deleteClip()}>
              Delete
            </button>
            <button className="button ghost" disabled={!selectedClipId} title="선택 클립 삭제 후 같은 트랙의 뒤 클립을 당김 (Shift+Delete)" onClick={() => deleteClip(true)}>
              삭제 + 당기기
            </button>
            <span className="timeline-hint">빈 구간은 검은 화면으로 재생됩니다.</span>
          </div>
          <div className="zoom-control">
            <span>Timeline</span>
            <input
              type="range"
              min="16"
              max="64"
              value={pxPerSecond}
              onChange={(event) => setPxPerSecond(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="timeline-body">
          <div className="track-labels">
            <div className="ruler-spacer" />
            {project.tracks.map((track) => (
              <div className="track-label" key={track.id}>
                {trackLabel[track.type]}
              </div>
            ))}
          </div>

          <div className="timeline-scroll" ref={timelineScrollRef}>
            <div
              className="timeline-content"
              style={{ width: timelineWidth }}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                const x = event.clientX - rect.left
                seekTo(x / pxPerSecond)
              }}
            >
              <div className="ruler">
                {timeMarks.map((time) => (
                  <span
                    className="time-mark"
                    style={{ left: time * pxPerSecond }}
                    key={time}
                  >
                    {time}s
                  </span>
                ))}
              </div>

              {project.tracks.map((track) => (
                <div className="track-row" key={track.id}>
                  {track.clips.map((clip) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      clips={track.clips}
                      selected={selectedClipId === clip.id}
                      fps={project.canvas.fps}
                      pxPerSecond={pxPerSecond}
                      playhead={project.currentTime}
                      scrollRef={timelineScrollRef}
                      onSelect={() => selectClip(clip.id)}
                      onBeginEdit={pause}
                      onCommit={(mode, target, tolerance) => editClip(clip.id, mode, target, tolerance)}
                    />
                  ))}
                </div>
              ))}

              <div
                className="playhead"
                style={{ left: playheadLeft }}
                aria-label="playhead"
              >
                <div className="playhead-handle" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
