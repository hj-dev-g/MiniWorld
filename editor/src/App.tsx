import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from './store/editorStore'
import type { TrackType } from './types/editor'

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
  const { project, setCurrentTime, loadVideo } = useEditorStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const pxPerSecond = 28
  const timelineWidth = Math.max(project.duration * pxPerSecond, 720)
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

    if (!file.type.startsWith('video/')) {
      event.target.value = ''
      return
    }

    setVideoUrl(URL.createObjectURL(file))
    setVideoName(file.name)
    setIsPlaying(false)
    event.target.value = ''
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current

    if (!video || !videoName || !Number.isFinite(video.duration)) {
      return
    }

    video.currentTime = 0
    loadVideo(videoName, video.duration)
  }

  const seekTo = (time: number) => {
    const safeTime = Math.min(Math.max(time, 0), project.duration)

    setCurrentTime(safeTime)

    if (videoRef.current) {
      videoRef.current.currentTime = safeTime
    }
  }

  const togglePlayback = async () => {
    const video = videoRef.current

    if (!videoUrl || !video) {
      return
    }

    if (video.paused) {
      if (video.currentTime >= video.duration) {
        seekTo(0)
      }

      try {
        await video.play()
      } catch {
        setIsPlaying(false)
      }
    } else {
      video.pause()
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <strong className="brand">MiniWorld Editor</strong>
          <span className="project-name">{project.name}</span>
        </div>
        <div className="topbar-actions">
          <button className="button ghost">Undo</button>
          <button className="button ghost">Redo</button>
          <button className="button primary">Export</button>
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
            <button>텍스트</button>
            <button>오디오</button>
            <button>스티커</button>
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
                <small>{formatTime(project.duration)}</small>
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
            <div className="phone-canvas">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  className="preview-video"
                  src={videoUrl}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime)
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false)
                    setCurrentTime(project.duration)
                  }}
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
            <button onClick={() => seekTo(project.currentTime - 1)}>◀</button>
            <button
              className="play"
              onClick={togglePlayback}
              disabled={!videoUrl}
              aria-label={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
            <button onClick={() => seekTo(project.currentTime + 1)}>▶|</button>
            <span>
              {formatTime(project.currentTime)} / {formatTime(project.duration)}
            </span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          <h2>Properties</h2>
          <div className="property-group">
            <label>Position</label>
            <div className="two-cols">
              <input value="X  0" readOnly />
              <input value="Y  0" readOnly />
            </div>
          </div>

          <div className="property-group">
            <label>Scale</label>
            <input value="100%" readOnly />
          </div>

          <div className="property-group">
            <label>Opacity</label>
            <input type="range" min="0" max="100" defaultValue="100" />
          </div>

          <div className="property-group">
            <label>Canvas</label>
            <select defaultValue="9:16">
              <option>9:16</option>
              <option>4:5</option>
              <option>1:1</option>
            </select>
          </div>
        </aside>
      </section>

      <section className="timeline-section">
        <div className="timeline-tools">
          <div>
            <button className="button ghost">Split</button>
            <button className="button ghost">Delete</button>
          </div>
          <div className="zoom-control">
            <span>Timeline</span>
            <input type="range" min="16" max="48" defaultValue={pxPerSecond} />
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

          <div className="timeline-scroll">
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
                    <div
                      key={clip.id}
                      className={`clip clip-${clip.type}`}
                      style={{
                        left: clip.start * pxPerSecond,
                        width: clip.duration * pxPerSecond,
                      }}
                    >
                      <span>{clip.name}</span>
                    </div>
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
