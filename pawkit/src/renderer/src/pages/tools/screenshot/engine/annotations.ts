import type {
  CaptureAnnotation,
  CapturePoint,
  CaptureRect,
  LineAnnotation,
  MosaicAnnotation,
  ShapeAnnotation
} from './types'
import { containsPoint } from './geometry'

export function getAnnotationBounds(annotation: CaptureAnnotation): CaptureRect {
  if (annotation.type === 'text') {
    return {
      x: annotation.point.x,
      y: annotation.point.y,
      width: Math.max(30, annotation.text.length * annotation.fontSize),
      height: annotation.fontSize + 8
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
  if (isLineAnnotation(annotation)) {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y
      }))
    }
  }
  if (annotation.type === 'text') {
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

function isLineAnnotation(annotation: CaptureAnnotation): annotation is LineAnnotation {
  return annotation.type === 'pen' || annotation.type === 'arrow'
}
