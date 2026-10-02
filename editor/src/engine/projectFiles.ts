import { z } from 'zod'
import type { ProjectBundle, AudioAsset, ImageAsset, VideoAsset } from '../types/editor'
import { projectDuration } from './timeline'

const number = z.number().finite()
const time = number.min(0).max(24 * 3600)
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/)
const name = z.string().max(1000)
const kind = z.enum(['video', 'audio', 'text', 'image'])
const text = z.object({ value: z.string().max(1000), fontFamily: z.enum(['system-ui', 'Malgun Gothic', 'Arial', 'Georgia', 'monospace']), fontSize: number.min(12).max(240), color: z.string().regex(/^#[0-9a-f]{6}$/i), align: z.enum(['left', 'center', 'right']), bold: z.boolean(), shadow: z.boolean(), x: number.min(0).max(1080), y: number.min(0).max(1920) })
const clip = z.object({ id, name, type: kind, start: time, duration: time.positive(), sourceStart: time.optional(), sourceDuration: time.optional(), sourceLength: time.optional(), videoAssetId: id.optional(), audioAssetId: id.optional(), sound: z.object({volume: number.min(0).max(1), muted: z.boolean()}).optional(), text: text.optional(), image: z.object({assetId: id, x: number.min(0).max(1080), y: number.min(0).max(1920), width: number.positive().max(1080), height: number.positive().max(1920), opacity: number.min(0).max(1)}).optional() })
const schema = z.object({ version: z.literal(1), project: z.object({id, name: z.string().max(100), canvas: z.object({width: z.literal(1080), height: z.literal(1920), fps: z.literal(30)}), duration: time, currentTime: time, tracks: z.array(z.object({id, type: kind, clips: z.array(clip).max(1000)})).length(4) }), assets: z.array(z.object({id, name, kind: z.enum(['video', 'audio', 'image']), mime: z.string().max(100), duration: time.positive().optional(), width: number.positive().max(32768).optional(), height: number.positive().max(32768).optional()})).max(1000) })
export type ProjectManifest = z.infer<typeof schema>
export interface SavedProject { manifest: ProjectManifest; files: Record<string, Blob> }
export const assetPath = (assetId: string) => `media/${assetId}`
export function captureProject(bundle: ProjectBundle): SavedProject {
  const files: Record<string, Blob> = {}
  const assets: ProjectManifest['assets'] = []
  for (const kind of ['video', 'audio', 'image'] as const) {
    const registry = kind === 'video' ? bundle.videoAssets : kind === 'audio' ? bundle.audioAssets : bundle.imageAssets
    for (const asset of Object.values(registry)) {
      if (!asset.file) throw new Error(`${asset.name}: 원본 파일이 없어 저장할 수 없습니다.`)
      files[assetPath(asset.id)] = asset.file
      assets.push({id: asset.id, name: asset.name, kind, mime: asset.file.type,
        ...('duration' in asset ? {duration: asset.duration} : {}), ...('width' in asset ? {width: asset.width, height: asset.height} : {})})
    }
  }
  return { manifest: schema.parse({version: 1, project: bundle.project, assets}), files }
}
export function restoreSaved(saved: unknown): ProjectBundle {
  if (!saved || typeof saved !== 'object' || !('manifest' in saved) || !('files' in saved)) throw new Error('프로젝트 형식이 올바르지 않습니다.')
  const result = schema.safeParse(saved.manifest)
  if (!result.success) throw new Error('지원하지 않거나 손상된 프로젝트 파일입니다.')
  const { project, assets } = result.data
  const files = saved.files as Record<string, Blob>
  const ids = new Set<string>(); const types = new Set<string>()
  const assetMap = new Map(assets.map(a => [a.id, a]))
  if (assetMap.size !== assets.length || !files || typeof files !== 'object') throw new Error('중복되거나 누락된 미디어입니다.')
  for (const asset of assets) {
    if (!(files[assetPath(asset.id)] instanceof Blob) || files[assetPath(asset.id)].size === 0 || (asset.kind !== 'image' && !asset.duration) || (asset.kind !== 'audio' && (!asset.width || !asset.height))) throw new Error('원본 미디어가 누락되었습니다.')
  }
  for (const track of project.tracks) {
    if (types.has(track.type) || ids.has(track.id)) throw new Error('트랙 구성이 올바르지 않습니다.')
    types.add(track.type); ids.add(track.id)
    let videoEnd = 0
    for (const c of track.clips.sort((a,b) => a.start - b.start)) {
      if (ids.has(c.id) || c.type !== track.type || c.start + c.duration > 86400) throw new Error('클립 구성이 올바르지 않습니다.')
      ids.add(c.id)
      if (c.type === 'text' && !c.text) throw new Error('자막 데이터가 누락되었습니다.')
      if (c.type !== 'text') {
        const asset = assetMap.get(c.type === 'video' ? c.videoAssetId ?? '' : c.type === 'audio' ? c.audioAssetId ?? '' : c.image?.assetId ?? '')
        if (!asset || asset.kind !== c.type) throw new Error('클립의 원본 미디어가 누락되었습니다.')
        if (c.type !== 'image' && (c.sourceStart ?? 0) + c.duration > asset.duration! + 1 / 30) throw new Error('원본 영상/오디오 범위를 벗어난 클립입니다.')
        if (asset.duration) { c.sourceLength = asset.duration; c.sourceDuration = c.duration }
      }
      if (c.type === 'video') { if (c.start < videoEnd - .000001) throw new Error('영상 클립이 겹칩니다.'); videoEnd = c.start + c.duration }
    }
  }
  project.duration = projectDuration(project.tracks); project.currentTime = Math.min(project.currentTime, project.duration)
  const bundle: ProjectBundle = {project, videoAssets: {}, audioAssets: {}, imageAssets: {}}
  const urls: string[] = []
  try {
    for (const asset of assets) {
      const file = files[assetPath(asset.id)]; const url = URL.createObjectURL(file); urls.push(url)
      const base = {id: asset.id, name: asset.name, url, file}
      if (asset.kind === 'video') bundle.videoAssets[asset.id] = {...base, duration: asset.duration!, width: asset.width!, height: asset.height!} satisfies VideoAsset
      else if (asset.kind === 'audio') bundle.audioAssets[asset.id] = {...base, duration: asset.duration!} satisfies AudioAsset
      else bundle.imageAssets[asset.id] = {...base, width: asset.width!, height: asset.height!} satisfies ImageAsset
    }
    return bundle
  } catch (error) { urls.forEach(URL.revokeObjectURL); throw error }
}
const MAX_ARCHIVE = 512 * 1024 * 1024
export async function writeProject(bundle: ProjectBundle): Promise<Blob> {
  const saved = captureProject(bundle)
  if (Object.values(saved.files).reduce((n,f) => n+f.size, 0) > MAX_ARCHIVE) throw new Error('프로젝트 파일 저장은 원본 합계 512MB까지 지원합니다.')
  const {zip} = await import('fflate')
  const entries: Record<string, Uint8Array<ArrayBuffer>> = { 'project.json': new TextEncoder().encode(JSON.stringify(saved.manifest)) }
  for (const [path,file] of Object.entries(saved.files)) entries[path] = new Uint8Array(await file.arrayBuffer())
  const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve,reject) => zip(entries,{level:0},(error, data) => error ? reject(error) : resolve(data as Uint8Array<ArrayBuffer>)))
  return new Blob([bytes],{type:'application/zip'})
}
export async function readProject(file: File): Promise<ProjectBundle> {
  if (file.size > MAX_ARCHIVE + 2 * 1024 * 1024) throw new Error('512MB를 넘는 프로젝트 파일은 불러올 수 없습니다.')
  const {unzip} = await import('fflate')
  let total = 0; let invalid = false
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise<Record<string, Uint8Array<ArrayBuffer>>>((resolve,reject) => unzip(bytes,{filter: info => {
    total += info.originalSize
    const valid = (info.name === 'project.json' && info.originalSize <= 2 * 1024 * 1024) || /^media\/[a-zA-Z0-9_-]{1,100}$/.test(info.name)
    if (!valid || total > MAX_ARCHIVE + 2 * 1024 * 1024) invalid = true
    return valid && !invalid
  }}, (error,data) => error ? reject(new Error('프로젝트 파일을 읽을 수 없습니다.')) : resolve(data as Record<string, Uint8Array<ArrayBuffer>>)))
  if (invalid || !entries['project.json']) throw new Error('프로젝트 파일 구성이 올바르지 않습니다.')
  let manifest: unknown
  try { manifest = JSON.parse(new TextDecoder().decode(entries['project.json'])) } catch { throw new Error('프로젝트 정보를 읽을 수 없습니다.') }
  const parsed = schema.safeParse(manifest)
  if (!parsed.success) throw new Error('지원하지 않는 프로젝트 형식입니다.')
  const files: Record<string, Blob> = {}
  for (const asset of parsed.data.assets) {
    const path = assetPath(asset.id); const data = entries[path]
    if (!data) throw new Error('원본 미디어가 누락되었습니다.')
    files[path] = new Blob([data], {type: asset.mime})
  }
  return restoreSaved({manifest: parsed.data, files})
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export const fileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').slice(0,100) || 'MiniWorld'
