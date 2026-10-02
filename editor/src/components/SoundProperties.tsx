import { useEditorStore } from '../store/editorStore'
import type { Clip } from '../types/editor'

export function SoundProperties({ clip, onPause }: { clip: Clip; onPause: () => void }) {
  const { updateSound, beginEdit, commitEdit } = useEditorStore()
  const sound = clip.sound ?? { volume: 1, muted: false }
  return <div className="sound-properties">
    <div className="property-group">
      <label htmlFor="clip-volume">{clip.type === 'video' ? '영상 원본 볼륨' : 'BGM 볼륨'} <span>{Math.round(sound.volume * 100)}%</span></label>
      <input id="clip-volume" type="range" min={0} max={100} value={sound.volume * 100}
        onFocus={() => { onPause(); beginEdit() }} onBlur={() => commitEdit()}
        onChange={event => { onPause(); updateSound(clip.id, { volume: Number(event.target.value) / 100 }) }} />
    </div>
    <div className="property-group segmented-control">
      <button aria-pressed={sound.muted} onClick={() => { onPause(); updateSound(clip.id, { muted: !sound.muted }) }}>음소거</button>
    </div>
    <p className="panel-hint">볼륨은 선택한 클립에만 적용됩니다. 오디오가 겹치는 구간은 함께 재생됩니다.</p>
  </div>
}
