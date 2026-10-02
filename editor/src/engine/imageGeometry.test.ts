import { describe, expect, it } from 'vitest'
import { constrainImage, fitImageSize, resizeImage } from './imageGeometry'
import type { ImageStyle } from '../types/editor'

const canvas = { width: 1080, height: 1920, fps: 30 }
const asset = { id: 'sticker', name: 'sticker.png', url: 'blob:test', width: 400, height: 200 }
const image: ImageStyle = { assetId: asset.id, x: 540, y: 960, width: 540, height: 270, opacity: 1 }

describe('image geometry', () => {
  it('fits wide and tall images into half of the canvas, preserving ratio', () => {
    expect(fitImageSize(asset, canvas)).toEqual({ width: 540, height: 270 })
    expect(fitImageSize({ ...asset, width: 100, height: 1000 }, canvas)).toEqual({ width: 96, height: 960 })
  })
  it('preserves aspect ratio, clamps size/position/opacity, and ignores nonfinite patches', () => {
    expect(constrainImage(image, { width: 9999, x: -1, y: 9999, opacity: -2 }, asset, canvas))
      .toMatchObject({ width: 1080, height: 540, x: 540, y: 1650, opacity: 0 })
    expect(constrainImage(image, { height: 100 }, asset, canvas)).toMatchObject({ width: 200, height: 100 })
    expect(constrainImage(image, { width: 0 }, asset, canvas)).toMatchObject({ width: 32, height: 16 })
    expect(constrainImage(image, { x: NaN, width: Infinity, opacity: NaN }, asset, canvas)).toEqual(image)
  })
  it.each([[-1, -1], [-1, 1], [1, -1], [1, 1]])('keeps the opposite corner fixed for resize %i,%i', (sx, sy) => {
    const patch = resizeImage(image, sx * 100, sy * 50, sx, sy, canvas)
    expect(patch.width).toBeCloseTo(640)
    expect(patch.height).toBeCloseTo(320)
    expect(patch.x! - sx * patch.width! / 2).toBeCloseTo(image.x - sx * image.width / 2)
    expect(patch.y! - sy * patch.height! / 2).toBeCloseTo(image.y - sy * image.height / 2)
    const huge = resizeImage(image, sx * 9999, sy * 9999, sx, sy, canvas)
    expect(huge.x! - huge.width! / 2).toBeGreaterThanOrEqual(0)
    expect(huge.x! + huge.width! / 2).toBeLessThanOrEqual(canvas.width)
    expect(huge.y! - huge.height! / 2).toBeGreaterThanOrEqual(0)
    expect(huge.y! + huge.height! / 2).toBeLessThanOrEqual(canvas.height)
  })
})
