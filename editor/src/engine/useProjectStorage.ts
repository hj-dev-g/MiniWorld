import { useEffect, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { captureProject, restoreSaved } from './projectFiles'

const open = () => new Promise<IDBDatabase>((resolve,reject) => {
  const request = indexedDB.open('miniworld-editor', 2)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects')
    if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets')
  }
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
})
const load = (db: IDBDatabase) => new Promise<{saved: unknown; files: Map<string, Blob>}>((resolve,reject) => {
  const transaction = db.transaction(['projects','assets'])
  const project = transaction.objectStore('projects').get('current')
  const assets = transaction.objectStore('assets').getAll()
  transaction.oncomplete = () => {
    const records = assets.result as {path: string; file: Blob}[]
    // Also accept the first prototype's combined record during database migration.
    const saved = project.result?.files ? project.result : project.result ? {...project.result,files:Object.fromEntries(records.map(a=>[a.path,a.file]))} : undefined
    resolve({saved,files:new Map(records.map(a=>[a.path,a.file]))})
  }
  transaction.onabort = () => reject(transaction.error); transaction.onerror = () => reject(transaction.error)
})
const save = (db: IDBDatabase, value: ReturnType<typeof captureProject>, stored: Map<string, Blob>) => new Promise<Map<string, Blob>>((resolve,reject) => {
  const transaction = db.transaction(['projects','assets'],'readwrite')
  transaction.objectStore('projects').put({manifest:value.manifest}, 'current')
  const assets = transaction.objectStore('assets')
  const next = new Map(Object.entries(value.files))
  for (const [path,file] of Object.entries(value.files)) if (stored.get(path) !== file) assets.put({path,file},path)
  for (const path of stored.keys()) if (!next.has(path)) assets.delete(path)
  transaction.oncomplete = () => resolve(next); transaction.onabort = () => reject(transaction.error); transaction.onerror = () => reject(transaction.error)
})
export function useProjectStorage() {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('프로젝트 복원 중…')
  useEffect(() => {
    let active = true; let db: IDBDatabase | undefined; let unsubscribe = () => {}; let timer: ReturnType<typeof setTimeout> | undefined
    let queue = Promise.resolve(); let revision = 0; let stored = new Map<string, Blob>()
    const persist = () => {
      clearTimeout(timer)
      if (!active) return
      if (!db) { setStatus('자동 저장을 사용할 수 없습니다 · 파일 저장 가능'); return }
      const epoch = revision
      try {
        const bundle = captureProject(useEditorStore.getState())
        setStatus('자동 저장 중…')
        queue = queue.catch(() => {}).then(async () => { stored = await save(db!,bundle,stored) }).then(() => { if (active && epoch === revision) setStatus('자동 저장됨') }).catch(() => { if (active) setStatus('자동 저장 실패 · 파일로 저장하세요') })
      } catch { setStatus('자동 저장 실패 · 파일로 저장하세요') }
    }
    const hidden = () => { if (document.visibilityState === 'hidden') persist() }
    void (async () => {
      try {
        db = await open()
        const loaded = await load(db); const saved = loaded.saved; stored = loaded.files
        if (!active) { db.close(); return }
        if (saved) useEditorStore.getState().restoreProject(restoreSaved(saved))
        setStatus(saved ? '저장된 프로젝트 복원됨' : '자동 저장 준비됨')
      } catch { if (active) setStatus('자동 저장을 사용할 수 없습니다 · 파일 저장 가능') }
      if (!active) return
      setReady(true)
      let previous = useEditorStore.getState()
      unsubscribe = useEditorStore.subscribe(state => {
        const changed = state.project.tracks !== previous.project.tracks || state.project.name !== previous.project.name || state.videoAssets !== previous.videoAssets || state.audioAssets !== previous.audioAssets || state.imageAssets !== previous.imageAssets || state.mediaRevision !== previous.mediaRevision
        previous = state
        if (!changed) return
        revision++; setStatus('변경 사항 저장 대기…'); clearTimeout(timer); timer = setTimeout(persist,500)
      })
      document.addEventListener('visibilitychange',hidden)
    })()
    return () => { active = false; clearTimeout(timer); unsubscribe(); document.removeEventListener('visibilitychange',hidden); void queue.finally(() => db?.close()) }
  }, [])
  return {ready, status}
}
