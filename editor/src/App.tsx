import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from './store/editorStore'
import type { TrackType } from './types/editor'
import { activeVideo, canSplitClip } from './engine/timeline'
import { useTimelinePlayback } from './engine/useTimelinePlayback'
import { TimelineClip } from './components/TimelineClip'
import { PreviewOverlayLayer } from './components/PreviewOverlayLayer'
import { ImageProperties } from './components/ImageProperties'
import { useImageImports } from './engine/useImageImports'
import { AudioPlayback } from './components/AudioPlayback'
import { SoundProperties } from './components/SoundProperties'
import { useAudioImports } from './engine/useAudioImports'
import { TextProperties } from './components/TextProperties'

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
  const { project, selectedClipId, loadVideo, selectClip, splitSelectedClip, editClip, deleteSelectedClip, addText, imageAssets, insertImage, audioAssets, insertAudio, past, future, undo, redo } = useEditorStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { importFiles, busy: imageBusy, error: imageError } = useImageImports()
  const audioInputRef = useRef<HTMLInputElement>(null)
  const { importFiles: importAudio, busy: audioBusy, error: audioImportError } = useAudioImports()
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackLabelsRef = useRef<HTMLDivElement>(null)
  const [assetTab, setAssetTab] = useState<'media' | 'text' | 'image' | 'audio'>('media')

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)
  const [pxPerSecond, setPxPerSecond] = useState(28)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const { isPlaying, visible, error, setError, pause, seekTo, togglePlayback, onSeeked } = useTimelinePlayback(videoRef, videoUrl)
  const onAudioFailure = useCallback((message: string) => { pause(); setAudioPlaybackError(message) }, [pause])
  const audioClips = project.tracks.flatMap(track => track.type === 'audio' ? track.clips : [])
  const selectedClip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId)
  const canSplit = !!selectedClip && canSplitClip(selectedClip, project.currentTime, project.canvas.fps)
  const textClips = project.tracks.flatMap(track => track.type === 'text' ? track.clips : [])
  const imageClips = project.tracks.flatMap(track => track.type === 'image' ? track.clips : [])
  const selectedClipActive = !!selectedClip && project.currentTime >= selectedClip.start && project.currentTime < selectedClip.start + selectedClip.duration
  const trackHeight = (type: TrackType, count: number) => type !== 'video' ? Math.max(58, count * 48 + 10) : 58
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
    setAudioPlaybackError(null)
    loadVideo(videoName, video.duration)
  }

  const deleteClip = (closeGap = false) => {
    pause()
    deleteSelectedClip(closeGap)
  }

  const addCaption = () => { pause(); addText(); setAssetTab('text') }
  const historyAction = (action: 'undo' | 'redo') => { pause(); if (action === 'undo') undo(); else redo() }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.isComposing || target.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); pause()
        const redoKey = event.key.toLowerCase() === 'y' || event.shiftKey
        const state = useEditorStore.getState()
        if (redoKey) state.redo(); else state.undo()
        return
      }
      if (target.closest('button')) return
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
          <button className="button ghost" disabled={past.length === 0} title="실행 취소 (Ctrl/Cmd+Z)" onClick={() => historyAction('undo')}>Undo</button>
          <button className="button ghost" disabled={future.length === 0} title="다시 실행 (Ctrl+Y / Ctrl/Cmd+Shift+Z)" onClick={() => historyAction('redo')}>Redo</button>
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
            <button className={assetTab === 'media' ? 'active' : ''} onClick={() => setAssetTab('media')}>미디어</button>
            <button className={assetTab === 'text' ? 'active' : ''} onClick={() => setAssetTab('text')}>텍스트</button>
            <button className={assetTab === 'audio' ? 'active' : ''} onClick={() => setAssetTab('audio')}>오디오</button>
            <button className={assetTab === 'image' ? 'active' : ''} onClick={() => setAssetTab('image')}>이미지</button>
          </nav>

          <input ref={imageInputRef} className="file-input" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={imageBusy}
            onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; pause(); void importFiles(files) }} />
          <input ref={audioInputRef} className="file-input" type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac" disabled={audioBusy}
            onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; pause(); setAudioPlaybackError(null); void importAudio(files).then(pause) }} />
          {assetTab === 'audio' ? (
            <div className="text-library audio-library">
              <button className="button primary add-text" disabled={audioBusy} onClick={() => audioInputRef.current?.click()}>{audioBusy ? '오디오 읽는 중…' : '＋ BGM 추가'}</button>
              <p className="panel-hint">MP3 · WAV · M4A · OGG 등<br />현재 위치에 추가합니다. 목록에서 다시 사용할 수 있습니다.</p>
              {audioImportError && <p className="image-error" role="alert">{audioImportError}</p>}
              {Object.values(audioAssets).map(asset => <button className="media-card" key={asset.id}
                onClick={() => { pause(); insertAudio(asset.id) }} title="현재 위치에 BGM 추가">
                <span className="media-thumb">♪</span>
                <span className="media-info"><strong>{asset.name}</strong><small>원본 {formatTime(asset.duration)}</small></span>
              </button>)}
            </div>
          ) : assetTab === 'image' ? (
            <div className="text-library">
              <button className="button primary add-text" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>{imageBusy ? '이미지 읽는 중…' : '＋ 이미지 추가'}</button>
              <p className="panel-hint">PNG · JPG · WebP · 투명 배경 지원<br />이미지를 클릭하면 현재 위치에 다시 추가합니다.</p>
              {imageError && <p className="image-error" role="alert">{imageError}</p>}
              {Object.values(imageAssets).map(asset => <button className="media-card" key={asset.id}
                onClick={() => { pause(); insertImage(asset.id) }} title="현재 위치에 이미지 추가">
                <img className="media-thumb image-thumb" src={asset.url} alt="" />
                <span className="media-info"><strong>{asset.name}</strong><small>{asset.width} × {asset.height}</small></span>
              </button>)}
            </div>
          ) : assetTab === 'text' ? (
            <div className="text-library">
              <button className="button primary add-text" onClick={addCaption}>＋ 텍스트 추가</button>
              <p className="panel-hint">현재 재생 헤드 위치에 자막을 추가합니다.</p>
              {textClips.map(clip => <button className={`media-card${clip.id === selectedClipId ? ' active' : ''}`} key={clip.id}
                onClick={() => { pause(); selectClip(clip.id); seekTo(clip.start) }}>
                <span className="media-thumb">T</span>
                <span className="media-info"><strong>{clip.name}</strong><small>{formatTime(clip.start)} · {clip.duration.toFixed(1)}초</small></span>
              </button>)}
            </div>
          ) : videoName ? (
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
            {(error || audioPlaybackError) && <div className="media-error" role="alert">{error || audioPlaybackError}</div>}
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
              ) : textClips.length === 0 && imageClips.length === 0 && audioClips.length === 0 ? (
                <div className="canvas-copy">
                  <span className="eyebrow">Instagram Reel</span>
                  <h1>영상 추가</h1>
                  <p>로컬 MP4를 올려 편집을 시작하세요.</p>
                </div>
              ) : null}
              <PreviewOverlayLayer project={project} selectedClipId={selectedClipId} onPause={pause} />
            </div>
          </div>

          <div className="transport">
            <button disabled={project.duration <= 0} aria-label="1초 뒤로" onClick={() => seekTo(project.currentTime - 1)}>◀</button>
            <button
              className="play"
              onClick={() => { setAudioPlaybackError(null); togglePlayback() }}
              disabled={project.duration <= 0 || (!!videoUrl && (videoDuration <= 0 || !!error))}
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
                {(selectedClip.type === 'video' || selectedClip.type === 'audio') && <>
                  <dt>원본 시작</dt><dd>{(selectedClip.sourceStart ?? 0).toFixed(2)}초</dd>
                  <dt>원본 끝</dt><dd>{((selectedClip.sourceStart ?? 0) + selectedClip.duration).toFixed(2)}초</dd>
                </>}
              </dl>
            </div>
          ) : <p className="panel-hint">클립을 선택하면 편집 구간이 표시됩니다.</p>}
          {selectedClip?.text && <>
            {!selectedClipActive && <div className="caption-notice">현재 시각에는 이 자막이 표시되지 않습니다.
              <button className="button ghost" onClick={() => seekTo(selectedClip.start)}>자막 시작으로 이동</button>
            </div>}
            <TextProperties key={selectedClip.id} clip={selectedClip} onPause={pause} />
          </>}
          {selectedClip?.image && <>
            {!selectedClipActive && <div className="caption-notice">현재 시각에는 이 이미지가 표시되지 않습니다.
              <button className="button ghost" onClick={() => seekTo(selectedClip.start)}>이미지 시작으로 이동</button>
            </div>}
            <ImageProperties key={selectedClip.id} clip={selectedClip} onPause={pause} />
          </>}
          {selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio') && <>
            {selectedClip.type === 'audio' && !selectedClipActive && <div className="caption-notice">현재 시각에는 이 BGM이 재생되지 않습니다.
              <button className="button ghost" onClick={() => seekTo(selectedClip.start)}>BGM 시작으로 이동</button>
            </div>}
            <SoundProperties key={selectedClip.id} clip={selectedClip} onPause={pause} />
          </>}
          <p className="panel-hint">클립을 드래그해 이동하고, 양쪽 가장자리로 구간을 조절하세요.</p>
          <p className="panel-hint">방향키: 1프레임 이동 · Shift: 10프레임<br />Alt + 드래그: 스냅 해제</p>
        </aside>
      </section>

      <AudioPlayback project={project} isPlaying={isPlaying} onFailure={onAudioFailure} />

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
            <span className="timeline-hint">영상이 없는 구간은 검은 배경에 자막과 이미지가 표시됩니다.</span>
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
          <div className="track-labels" ref={trackLabelsRef}>
            <div className="ruler-spacer" />
            {project.tracks.map((track) => (
              <div className="track-label" key={track.id} style={{ height: trackHeight(track.type, track.clips.length) }}>
                {trackLabel[track.type]}
              </div>
            ))}
          </div>

          <div className="timeline-scroll" ref={timelineScrollRef} onScroll={event => { if (trackLabelsRef.current) trackLabelsRef.current.scrollTop = event.currentTarget.scrollTop }}>
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
                <div className="track-row" key={track.id} style={{ height: trackHeight(track.type, track.clips.length) }}>
                  {track.clips.map((clip, index) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      clips={track.clips}
                      top={track.type !== 'video' ? 8 + index * 48 : 8}
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
