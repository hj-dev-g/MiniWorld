import { useMemo } from 'react'
import { useEditorStore } from './store/editorStore'
import type { TrackType } from './types/editor'

const trackLabel: Record<TrackType, string> = {
  video: 'VIDEO',
  text: 'TEXT',
  audio: 'AUDIO',
  image: 'IMAGE',
}

export function App() {
  const { project, setCurrentTime } = useEditorStore()

  const pxPerSecond = 28
  const timelineWidth = project.duration * pxPerSecond
  const playheadLeft = project.currentTime * pxPerSecond

  const timeMarks = useMemo(
    () => Array.from({ length: Math.floor(project.duration / 5) + 1 }, (_, i) => i * 5),
    [project.duration],
  )

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
          <button className="upload-box">
            <span className="upload-icon">＋</span>
            <strong>미디어 추가</strong>
            <small>MP4 · PNG · JPG · MP3</small>
          </button>

          <nav className="asset-tabs">
            <button className="active">미디어</button>
            <button>텍스트</button>
            <button>오디오</button>
            <button>스티커</button>
          </nav>

          <div className="asset-empty">
            업로드한 미디어가 여기에 표시됩니다.
          </div>
        </aside>

        <section className="preview-area">
          <div className="preview-toolbar">
            <span>9:16</span>
            <span>{project.canvas.width} × {project.canvas.height}</span>
            <span>{project.canvas.fps} FPS</span>
          </div>

          <div className="preview-stage">
            <div className="phone-canvas">
              <div className="canvas-copy">
                <span className="eyebrow">Instagram Reel</span>
                <h1>오늘도 그림중</h1>
                <p>Preview Canvas</p>
              </div>
            </div>
          </div>

          <div className="transport">
            <button>◀</button>
            <button className="play">▶</button>
            <button>▶|</button>
            <span>
              {project.currentTime.toFixed(1)}s / {project.duration.toFixed(1)}s
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
                setCurrentTime(x / pxPerSecond)
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
