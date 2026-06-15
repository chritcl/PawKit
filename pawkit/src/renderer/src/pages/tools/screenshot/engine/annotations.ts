import type {
  CaptureAnnotation,
  CapturePoint,
  CaptureRect,
  LineAnnotation,
  MosaicAnnotation,
  MosaicPaintAnnotation,
  ResizeDirection,
  ShapeAnnotation
} from './types'
import { containsPoint } from './geometry'

export function getAnnotationBounds(annotation: CaptureAnnotation): CaptureRect {
  if (annotation.type === 'text') {
    const lines = annotation.text.split('\n')
    const maxLineLength = Math.max(...lines.map((l) => l.length), 1)
    const lineHeight = annotation.fontSize * 1.4
    return {
      x: annotation.point.x,
      y: annotation.point.y,
      width: Math.max(30, maxLineLength * annotation.fontSize * 0.6),
      height: Math.max(lineHeight, lines.length * lineHeight)
    }
  }
  if (annotation.type === 'step') {
    return {
      x: annotation.point.x - annotation.size,
      y: annotation.point.y - annotation.size,
      width: annotation.size * 2,
      height: annotation.size * 2
    }
  }
  if (annotation.type === 'mosaic-paint') {
    if (annotation.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
    const xs = annotation.points.map((p) => p.x)
    const ys = annotation.points.map((p) => p.y)
    const r = annotation.brushSize / 2
    const minX = Math.min(...xs) - r
    const minY = Math.min(...ys) - r
    return {
      x: minX,
      y: minY,
      width: Math.max(1, Math.max(...xs) + r - minX),
      height: Math.max(1, Math.max(...ys) + r - minY)
    }
  }
  if (!isLineAnnotation(annotation)) {
    return annotation.rect
  }
  const xs = annotation.points.map((point: CapturePoint) => point.x)
  const ys = annotation.points.map((point: CapturePoint) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y)
  }
}

export function hitTestAnnotation(
  annotations: CaptureAnnotation[],
  point: CapturePoint,
  tolerance = 8
): CaptureAnnotation | null {
  return [...annotations].reverse().find((annotation) => {
    if (annotation.type === 'step') {
      const dx = point.x - annotation.point.x
      const dy = point.y - annotation.point.y
      return Math.hypot(dx, dy) <= annotation.size + tolerance
    }
    if (annotation.type === 'mosaic-paint') {
      return annotation.points.some((p) => Math.hypot(point.x - p.x, point.y - p.y) <= annotation.brushSize / 2 + tolerance)
    }
    const bounds = getAnnotationBounds(annotation)
    return containsPoint({
      x: bounds.x - tolerance,
      y: bounds.y - tolerance,
      width: bounds.width + tolerance * 2,
      height: bounds.height + tolerance * 2
    }, point)
  }) ?? null
}

export function moveAnnotation(
  annotation: CaptureAnnotation,
  delta: CapturePoint
): CaptureAnnotation {
  if (isLineAnnotation(annotation) || annotation.type === 'mosaic-paint') {
    const key = 'points' in annotation ? 'points' : null
    if (!key) return annotation
    return {
      ...annotation,
      points: (annotation as LineAnnotation | MosaicPaintAnnotation).points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y
      }))
    }
  }
  if (annotation.type === 'text' || annotation.type === 'step') {
    return {
      ...annotation,
      point: {
        x: annotation.point.x + delta.x,
        y: annotation.point.y + delta.y
      }
    }
  }
  const rectAnnotation = annotation as ShapeAnnotation | MosaicAnnotation
  return {
    ...rectAnnotation,
    rect: {
      ...rectAnnotation.rect,
      x: rectAnnotation.rect.x + delta.x,
      y: rectAnnotation.rect.y + delta.y
    }
  }
}

export function resizeAnnotation(
  annotation: CaptureAnnotation,
  direction: ResizeDirection,
  delta: CapturePoint,
  minSize = 6
): CaptureAnnotation {
  if (annotation.type !== 'rect' && annotation.type !== 'ellipse') return annotation
  const rect = annotation.rect
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height

  if (direction.includes('left')) left = Math.min(left + delta.x, right - minSize)
  if (direction.includes('right')) right = Math.max(right + delta.x, left + minSize)
  if (direction.includes('top')) top = Math.min(top + delta.y, bottom - minSize)
  if (direction.includes('bottom')) bottom = Math.max(bottom + delta.y, top + minSize)

  return {
    ...annotation,
    rect: { x: left, y: top, width: right - left, height: bottom - top }
  }
}

export function dragArrowEndpoint(
  annotation: CaptureAnnotation,
  endpointIndex: number,
  point: CapturePoint
): CaptureAnnotation {
  if (annotation.type !== 'arrow' && annotation.type !== 'pen') return annotation
  const points = [...annotation.points]
  if (endpointIndex < 0 || endpointIndex >= points.length) return annotation
  points[endpointIndex] = point
  return { ...annotation, points }
}

export function updateAnnotationStyle(
  annotation: CaptureAnnotation,
  stylePatch: Record<string, unknown>
): CaptureAnnotation {
  return { ...annotation, ...stylePatch } as CaptureAnnotation
}

export function hitTestAnnotationResizeHandle(
  annotation: CaptureAnnotation,
  point: CapturePoint,
  radius = 8
): ResizeDirection | null {
  if (annotation.type !== 'rect' && annotation.type !== 'ellipse') return null
  const rect = annotation.rect
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

export function hitTestArrowEndpoint(
  annotation: CaptureAnnotation,
  point: CapturePoint,
  radius = 10
): number | null {
  if (annotation.type !== 'arrow') return null
  const len = annotation.points.length
  if (len < 2) return null
  if (Math.hypot(point.x - annotation.points[0].x, point.y - annotation.points[0].y) <= radius) return 0
  if (Math.hypot(point.x - annotation.points[len - 1].x, point.y - annotation.points[len - 1].y) <= radius) return len - 1
  return null
}

function isLineAnnotation(annotation: CaptureAnnotation): annotation is LineAnnotation {
  return annotation.type === 'pen' || annotation.type === 'arrow'
}
