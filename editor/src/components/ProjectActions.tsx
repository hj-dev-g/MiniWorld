import { useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { readProject, writeProject, downloadBlob, fileName } from '../engine/projectFiles'
import { validateProjectMedia } from '../engine/validateProjectMedia'
import type { ExportProgress } from '../engine/exportVideo'

export function ProjectActions({ready, status, onPause}: {ready:boolean; status:string; onPause:()=>void}) {
  const duration = useEditorStore(s => s.project.duration)
  const input = useRef<HTMLInputElement>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [showExport,setShowExport] = useState(false)
  const [height,setHeight] = useState<1280|1920>(1280)
  const [exporting,setExporting] = useState(false)
  const [progress,setProgress] = useState<ExportProgress>({percent:0,stage:''})
  const controller = useRef<AbortController | null>(null)
  const save = async () => {
    onPause(); useEditorStore.getState().commitEdit(); setBusy(true); setMessage('프로젝트 파일 만드는 중…')
    try { const state = useEditorStore.getState(); downloadBlob(await writeProject(state),`${fileName(state.project.name)}.miniworld`); setMessage('프로젝트 파일 저장 완료') }
    catch (error) { setMessage(error instanceof Error ? error.message : '프로젝트 저장에 실패했습니다.') }
    finally { setBusy(false) }
  }
  const load = async (file: File) => {
    onPause(); setBusy(true); setMessage('프로젝트 파일 읽는 중…')
    try { const bundle = await readProject(file); await validateProjectMedia(bundle); useEditorStore.getState().restoreProject(bundle); setMessage('프로젝트 불러오기 완료') }
    catch (error) { setMessage(error instanceof Error ? error.message : '프로젝트를 읽을 수 없습니다.') }
    finally { setBusy(false) }
  }
  const exportMP4 = async () => {
    onPause(); useEditorStore.getState().commitEdit(); setExporting(true); setMessage(''); setProgress({percent:0,stage:'내보내기 준비 중…'})
    const abort = new AbortController(); controller.current = abort
    try {
      const state = useEditorStore.getState()
      const {exportVideo} = await import('../engine/exportVideo')
      const blob = await exportVideo(state,height,abort.signal,setProgress)
      downloadBlob(blob,`${fileName(state.project.name)}.mp4`); setMessage('MP4 내보내기 완료'); setShowExport(false)
    } catch (error) { setMessage(error instanceof DOMException && error.name === 'AbortError' ? '내보내기를 취소했습니다.' : error instanceof Error ? error.message : 'MP4 내보내기에 실패했습니다.') }
    finally { setExporting(false); controller.current = null }
  }
  return <>
    <span className="save-status" role="status" title={status}>{status}</span>
    <input ref={input} className="file-input" type="file" accept=".miniworld" disabled={!ready || busy || exporting} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; if(file) void load(file)}} />
    <button className="button ghost" disabled={!ready || busy || exporting} onClick={() => input.current?.click()}>불러오기</button>
    <button className="button ghost" disabled={!ready || busy || exporting} onClick={() => void save()}>프로젝트 저장</button>
    <button className="button primary" disabled={!ready || busy || exporting || duration <= 0} onClick={() => {onPause(); setMessage(''); setShowExport(true)}}>MP4 내보내기</button>
    {message && <div className="project-message" role="status">{message}<button aria-label="알림 닫기" onClick={() => setMessage('')}>×</button></div>}
    {showExport && <div className="modal-backdrop"><section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <h2 id="export-title">MP4 내보내기</h2>
      <p>영상·자막·이미지·음악을 하나의 파일로 저장합니다.</p>
      <label>해상도 <select disabled={exporting} value={height} onChange={e => setHeight(Number(e.target.value) as 1280|1920)}><option value={1280}>720 × 1280</option><option value={1920}>1080 × 1920</option></select></label>
      <p className="panel-hint">30 FPS · H.264 / AAC · 워터마크 없음<br />내보내는 동안 이 창을 열어두세요. · 최대 10분</p>
      <a className="licenses-link" href="/licenses/NOTICE.txt" target="_blank" rel="noreferrer">오픈소스 안내</a>
      {exporting && <div role="status"><progress max={100} value={progress.percent}/><p>{progress.stage} {progress.percent}%</p></div>}
      <div className="dialog-actions"><button className="button ghost" onClick={() => exporting ? (controller.current?.abort(), setProgress(value => ({...value,stage:'내보내기 취소 중…'}))) : setShowExport(false)}>{exporting ? '내보내기 취소' : '닫기'}</button><button className="button primary" disabled={exporting} onClick={() => void exportMP4()}>MP4 저장</button></div>
    </section></div>}
  </>
}
