import type { EditorProject, ImageAsset, ImageStyle } from '../types/editor'

type Canvas = EditorProject['canvas']
export type ImagePatch = Partial<Omit<ImageStyle, 'assetId'>>
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function fitImageSize(asset: ImageAsset, canvas: Canvas) {
  const width = Math.min(canvas.width * .5, canvas.height * .5 * asset.width / asset.height)
  return { width, height: width * asset.height / asset.width }
}

export function constrainImage(image: ImageStyle, patch: ImagePatch, asset: ImageAsset, canvas: Canvas): ImageStyle {
  const ratio = asset.width / asset.height
  const maxWidth = Math.min(canvas.width, canvas.height * ratio)
  const minWidth = Math.min(maxWidth, 16 * Math.max(1, ratio))
  const requested = Number.isFinite(patch.width) ? patch.width!
    : Number.isFinite(patch.height) ? patch.height! * ratio : image.width
  const width = clamp(requested, minWidth, maxWidth)
  const height = width / ratio
  return { ...image, width, height,
    x: clamp(Number.isFinite(patch.x) ? patch.x! : image.x, width / 2, canvas.width - width / 2),
    y: clamp(Number.isFinite(patch.y) ? patch.y! : image.y, height / 2, canvas.height - height / 2),
    opacity: clamp(Number.isFinite(patch.opacity) ? patch.opacity! : image.opacity, 0, 1),
  }
}

/** Keep the opposite corner fixed and preserve aspect ratio throughout a resize. */
export function resizeImage(image: ImageStyle, dx: number, dy: number, sx: number, sy: number, canvas: Canvas): ImagePatch {
  const ratio = image.width / image.height
  const anchorX = image.x - sx * image.width / 2
  const anchorY = image.y - sy * image.height / 2
  const maxWidth = Math.min(sx > 0 ? canvas.width - anchorX : anchorX,
    (sy > 0 ? canvas.height - anchorY : anchorY) * ratio)
  const minWidth = Math.min(maxWidth, 16 * Math.max(1, ratio))
  const deltaWidth = (sx * dx + sy * dy / ratio) / (1 + 1 / ratio ** 2)
  const width = clamp(image.width + deltaWidth, minWidth, maxWidth)
  const height = width / ratio
  return { width, height, x: anchorX + sx * width / 2, y: anchorY + sy * height / 2 }
}
