import type {
  CapturePoint,
  CaptureRect,
  CaptureSize,
  ResizeDirection
} from './types'

export const MIN_SELECTION_SIZE = 6

export function normalizeRect(start: CapturePoint, end: CapturePoint): CaptureRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

export function constrainSquare(start: CapturePoint, end: CapturePoint): CaptureRect {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: dx >= 0 ? start.x : start.x - size,
    y: dy >= 0 ? start.y : start.y - size,
    width: size,
    height: size
  }
}

export function isUsableRect(rect: CaptureRect, minSize = MIN_SELECTION_SIZE): boolean {
  return rect.width >= minSize && rect.height >= minSize
}

export function containsPoint(rect: CaptureRect, point: CapturePoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function clampRect(rect: CaptureRect, bounds: CaptureSize, minSize = MIN_SELECTION_SIZE): CaptureRect {
  const width = Math.min(bounds.width, Math.max(minSize, rect.width))
  const height = Math.min(bounds.height, Math.max(minSize, rect.height))
  return {
    x: Math.min(Math.max(0, rect.x), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(0, rect.y), Math.max(0, bounds.height - height)),
    width,
    height
  }
}

export function moveRect(rect: CaptureRect, delta: CapturePoint, bounds: CaptureSize): CaptureRect {
  return clampRect({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, bounds)
}

export function resizeRect(
  rect: CaptureRect,
  direction: ResizeDirection,
  delta: CapturePoint,
  bounds: CaptureSize,
  minSize = MIN_SELECTION_SIZE
): CaptureRect {
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height

  if (direction.includes('left')) left = Math.min(Math.max(0, left + delta.x), right - minSize)
  if (direction.includes('right')) right = Math.max(Math.min(bounds.width, right + delta.x), left + minSize)
  if (direction.includes('top')) top = Math.min(Math.max(0, top + delta.y), bottom - minSize)
  if (direction.includes('bottom')) bottom = Math.max(Math.min(bounds.height, bottom + delta.y), top + minSize)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function getToolbarPosition(
  selection: CaptureRect,
  toolbar: CaptureSize,
  viewport: CaptureSize,
  gap = 10,
  margin = 8
): CapturePoint {
  const x = Math.min(
    Math.max(margin, selection.x + selection.width - toolbar.width),
    Math.max(margin, viewport.width - toolbar.width - margin)
  )
  const below = selection.y + selection.height + gap
  const y = below + toolbar.height <= viewport.height - margin
    ? below
    : Math.max(margin, selection.y - toolbar.height - gap)
  return { x, y }
}

export function toPixelRect(rect: CaptureRect, viewport: CaptureSize, image: CaptureSize): CaptureRect {
  const scaleX = image.width / viewport.width
  const scaleY = image.height / viewport.height
  const x = Math.max(0, Math.round(rect.x * scaleX))
  const y = Math.max(0, Math.round(rect.y * scaleY))
  const right = Math.min(image.width, Math.round((rect.x + rect.width) * scaleX))
  const bottom = Math.min(image.height, Math.round((rect.y + rect.height) * scaleY))
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
}

export function getResizeHandle(
  point: CapturePoint,
  rect: CaptureRect,
  radius = 8
): ResizeDirection | null {
  const handles: Array<[ResizeDirection, CapturePoint]> = [
    ['top-left', { x: rect.x, y: rect.y }],
    ['top', { x: rect.x + rect.width / 2, y: rect.y }],
    ['top-right', { x: rect.x + rect.width, y: rect.y }],
    ['right', { x: rect.x + rect.width, y: rect.y + rect.height / 2 }],
    ['bottom-right', { x: rect.x + rect.width, y: rect.y + rect.height }],
    ['bottom', { x: rect.x + rect.width / 2, y: rect.y + rect.height }],
    ['bottom-left', { x: rect.x, y: rect.y + rect.height }],
    ['left', { x: rect.x, y: rect.y + rect.height / 2 }]
  ]
  return handles.find(([, handle]) => Math.hypot(point.x - handle.x, point.y - handle.y) <= radius)?.[0] ?? null
}
