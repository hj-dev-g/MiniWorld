import type { ProjectBundle } from '../types/editor'
import { readVideoMetadata } from './videoMetadata'
import { readAudioDuration } from './audioMetadata'

export function releaseBundle(bundle: ProjectBundle) {
  for (const asset of [...Object.values(bundle.videoAssets), ...Object.values(bundle.audioAssets), ...Object.values(bundle.imageAssets)]) URL.revokeObjectURL(asset.url)
}
export async function validateProjectMedia(bundle: ProjectBundle) {
  const abort = new AbortController()
  try {
    for (const asset of Object.values(bundle.videoAssets)) {
      const metadata = await readVideoMetadata(asset.url,abort.signal)
      if (Math.abs(metadata.duration-asset.duration) > .1 || metadata.width !== asset.width || metadata.height !== asset.height) throw new Error(`${asset.name}: 원본 영상 정보가 일치하지 않습니다.`)
    }
    for (const asset of Object.values(bundle.audioAssets)) {
      const duration = await readAudioDuration(asset.url,abort.signal)
      if (Math.abs(duration-asset.duration) > .1) throw new Error(`${asset.name}: 원본 오디오 정보가 일치하지 않습니다.`)
    }
    for (const asset of Object.values(bundle.imageAssets)) {
      const image = new Image(); image.src = asset.url
      await image.decode()
      if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) throw new Error(`${asset.name}: 원본 이미지 정보가 일치하지 않습니다.`)
    }
  } catch (error) {
    releaseBundle(bundle)
    throw new Error(error instanceof Error && error.message.includes(':') ? error.message : '프로젝트의 원본 미디어를 읽을 수 없습니다. 현재 편집은 유지됩니다.')
  } finally { abort.abort() }
}
