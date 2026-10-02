import { useEditorStore } from '../store/editorStore'
import type { Clip } from '../types/editor'
import type { ImagePatch } from '../engine/imageGeometry'
import { NumberField } from './NumberField'

export function ImageProperties({ clip, onPause }: { clip: Clip; onPause: () => void }) {
  const { project, updateImage, beginEdit, commitEdit } = useEditorStore()
  const image = clip.image!
  const change = (patch: ImagePatch) => { onPause(); updateImage(clip.id, patch) }
  const begin = () => { onPause(); beginEdit() }
  const end = () => commitEdit()
  return <div className="image-properties">
    <div className="property-group two-cols">
      <NumberField label="X 위치" value={image.x} max={project.canvas.width} onChange={x => change({ x })} onBegin={begin} onEnd={end} />
      <NumberField label="Y 위치" value={image.y} max={project.canvas.height} onChange={y => change({ y })} onBegin={begin} onEnd={end} />
    </div>
    <div className="property-group two-cols">
      <NumberField label="이미지 너비" value={image.width} max={project.canvas.width} onChange={width => change({ width })} onBegin={begin} onEnd={end} />
      <NumberField label="이미지 높이" value={image.height} max={project.canvas.height} onChange={height => change({ height })} onBegin={begin} onEnd={end} />
    </div>
    <div className="property-group">
      <label htmlFor="image-opacity">불투명도 <span>{Math.round(image.opacity * 100)}%</span></label>
      <input id="image-opacity" type="range" min={0} max={100} value={image.opacity * 100} onFocus={begin} onBlur={end} onChange={event => change({ opacity: Number(event.target.value) / 100 })} />
    </div>
    <p className="panel-hint">모서리를 드래그해 크기를 조절하세요. 원본 비율을 유지하며, 위치와 크기는 캔버스 기준입니다.</p>
  </div>
}
