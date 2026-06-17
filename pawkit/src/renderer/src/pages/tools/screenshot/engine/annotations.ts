import type {
  CaptureAnnotation,
  CapturePoint,
  CaptureRect,
  LineAnnotation,
  MosaicAnnotation,
  MosaicPaintAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  TextStyle
} from './types'
import { containsPoint } from './geometry'

export const TEXT_PADDING_X = 8
export const TEXT_PADDING_Y = 5
export const TEXT_MIN_WIDTH = 160

export function getAnnotationBounds(annotation: CaptureAnnotation): CaptureRect {
  if (annotation.type === 'text') {
    return annotation.rect
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

export function getTextLineHeight(fontSize: number): number {
  return Math.round(fontSize * 1.4)
}

export function getTextFont(style: Pick<TextStyle, 'fontSize' | 'bold'>): string {
  const weight = style.bold ? '700' : '600'
  return `${weight} ${style.fontSize}px "Microsoft YaHei UI", sans-serif`
}

export function normalizeTextValue(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

export function measureTextValue(
  value: string,
  style: TextStyle,
  context: CanvasRenderingContext2D | null = getMeasureContext()
): { width: number; height: number; lineHeight: number } {
  const text = normalizeTextValue(value)
  const lines = text.split('\n')
  const lineHeight = getTextLineHeight(style.fontSize)
  const maxLineWidth = Math.max(...lines.map((line) => measureLineWidth(line, style, context)), 0)
  return {
    width: Math.max(TEXT_MIN_WIDTH, Math.ceil(maxLineWidth + TEXT_PADDING_X * 2)),
    height: Math.max(lineHeight + TEXT_PADDING_Y * 2, Math.ceil(lines.length * lineHeight + TEXT_PADDING_Y * 2)),
    lineHeight
  }
}

export function getTextRect(
  point: CapturePoint,
  value: string,
  style: TextStyle,
  context?: CanvasRenderingContext2D | null
): CaptureRect {
  const size = measureTextValue(value, style, context)
  return {
    x: point.x,
    y: point.y,
    width: size.width,
    height: size.height
  }
}

export function createTextAnnotation({
  id,
  point,
  value,
  style
}: {
  id: string
  point: CapturePoint
  value: string
  style: TextStyle
}): TextAnnotation | null {
  const text = normalizeTextValue(value)
  if (text.trim().length === 0) return null
  const size = measureTextValue(text, style)
  return {
    id,
    type: 'text',
    rect: {
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height
    },
    text,
    color: style.color,
    fontSize: style.fontSize,
    lineHeight: size.lineHeight,
    bold: style.bold,
    bgColor: style.bgColor,
    align: style.align
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
    return {
      ...annotation,
      points: (annotation as LineAnnotation | MosaicPaintAnnotation).points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y
      }))
    }
  }
  if (annotation.type === 'text') {
    return {
      ...annotation,
      rect: {
        ...annotation.rect,
        x: annotation.rect.x + delta.x,
        y: annotation.rect.y + delta.y
      }
    }
  }
  if (annotation.type === 'step') {
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

export function updateAnnotationStyle(
  annotation: CaptureAnnotation,
  stylePatch: Record<string, unknown>
): CaptureAnnotation {
  if (annotation.type !== 'text') {
    return { ...annotation, ...stylePatch } as CaptureAnnotation
  }
  const updated = { ...annotation, ...stylePatch } as TextAnnotation
  const style = getTextStyleFromAnnotation(updated)
  const size = measureTextValue(updated.text, style)
  return {
    ...updated,
    rect: {
      ...updated.rect,
      width: size.width,
      height: size.height
    },
    lineHeight: size.lineHeight
  }
}

export function getTextStyleFromAnnotation(annotation: TextAnnotation): TextStyle {
  return {
    color: annotation.color,
    fontSize: annotation.fontSize,
    bold: annotation.bold ?? false,
    bgColor: annotation.bgColor ?? null,
    align: annotation.align ?? 'left'
  }
}

function isLineAnnotation(annotation: CaptureAnnotation): annotation is LineAnnotation {
  return annotation.type === 'pen' || annotation.type === 'arrow'
}

function measureLineWidth(
  line: string,
  style: TextStyle,
  context: CanvasRenderingContext2D | null
): number {
  if (context) {
    context.save()
    context.font = getTextFont(style)
    const width = context.measureText(line).width
    context.restore()
    return width
  }
  return Array.from(line).reduce((width, char) => width + estimateCharacterWidth(char, style.fontSize), 0)
}

function estimateCharacterWidth(char: string, fontSize: number): number {
  const code = char.codePointAt(0) ?? 0
  if (code === 32) return fontSize * 0.32
  if (code >= 0x2e80) return fontSize
  return fontSize * 0.58
}

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  return canvas.getContext('2d')
}
