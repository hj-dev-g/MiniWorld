import { NumberField } from './NumberField'
import { useEditorStore } from '../store/editorStore'
import type { Clip, TextStyle } from '../types/editor'

export function TextProperties({ clip, onPause }: { clip: Clip; onPause: () => void }) {
  const { updateText, beginEdit, commitEdit } = useEditorStore()
  const text = clip.text!
  const change = (patch: Partial<TextStyle>) => { onPause(); updateText(clip.id, patch) }
  const group = { onFocus: () => { onPause(); beginEdit() }, onBlur: () => commitEdit() }
  return (
    <div className="text-properties" key={clip.id}>
      <div className="property-group">
        <label htmlFor="text-content">자막 내용</label>
        <textarea id="text-content" value={text.value} maxLength={1000} rows={3} {...group}
          onChange={event => change({ value: event.target.value })} />
      </div>
      <div className="property-group">
        <label htmlFor="text-font">폰트</label>
        <select id="text-font" value={text.fontFamily} {...group} onChange={event => change({ fontFamily: event.target.value as TextStyle['fontFamily'] })}>
          <option value="system-ui">기본 시스템 폰트</option>
          <option value="Malgun Gothic">맑은 고딕</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="monospace">고정폭</option>
        </select>
      </div>
      <div className="property-group">
        <label htmlFor="text-size">글자 크기 <span>{text.fontSize}px</span></label>
        <input id="text-size" type="range" min={12} max={240} value={text.fontSize} {...group} onChange={event => change({ fontSize: Number(event.target.value) })} />
      </div>
      <div className="property-group color-control">
        <label htmlFor="text-color">글자 색상</label>
        <input id="text-color" type="color" value={text.color} {...group} onChange={event => change({ color: event.target.value })} />
        <span>{text.color}</span>
      </div>
      <div className="property-group">
        <label>정렬</label>
        <div className="segmented-control">
          {(['left', 'center', 'right'] as const).map((align, index) => <button key={align} aria-pressed={text.align === align}
            onClick={() => change({ align })}>{['왼쪽', '가운데', '오른쪽'][index]}</button>)}
        </div>
      </div>
      <div className="property-group segmented-control">
        <button aria-pressed={text.bold} onClick={() => change({ bold: !text.bold })}>굵게</button>
        <button aria-pressed={text.shadow} onClick={() => change({ shadow: !text.shadow })}>그림자</button>
      </div>
      <div className="property-group two-cols">
        <NumberField label="X 위치" value={text.x} max={useEditorStore.getState().project.canvas.width} onChange={value => change({ x: value })} onBegin={group.onFocus} onEnd={group.onBlur} />
        <NumberField label="Y 위치" value={text.y} max={useEditorStore.getState().project.canvas.height} onChange={value => change({ y: value })} onBegin={group.onFocus} onEnd={group.onBlur} />
      </div>
      <p className="panel-hint">위치와 글자 크기는 원본 캔버스 기준입니다. 여러 줄은 Enter로 입력하세요.</p>
    </div>
  )
}
