import { getAnnotationBounds } from './annotations'
import { toPixelRect } from './geometry'
import type {
  CaptureAnnotation,
  CaptureDraft,
  CaptureRect,
  CaptureSize,
  LineAnnotation,
  MosaicPaintAnnotation,
  ShapeAnnotation,
  StepAnnotation
} from './types'

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  backingSize: CaptureSize,
  cssSize: CaptureSize
): CanvasRenderingContext2D {
  if (canvas.width !== backingSize.width) canvas.width = backingSize.width
  if (canvas.height !== backingSize.height) canvas.height = backingSize.height
  canvas.style.width = `${cssSize.width}px`
  canvas.style.height = `${cssSize.height}px`
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建截图画布')
  return context
}

export function drawFrozenScreen(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  imageSize: CaptureSize,
  viewport: CaptureSize
): void {
  const context = prepareCanvas(canvas, imageSize, viewport)
  context.clearRect(0, 0, imageSize.width, imageSize.height)
  context.drawImage(image, 0, 0, imageSize.width, imageSize.height)
}

export function drawAnnotationLayer(
  canvas: HTMLCanvasElement,
  backgroundCanvas: HTMLCanvasElement,
  annotations: CaptureAnnotation[],
  draft: CaptureDraft | null,
  imageSize: CaptureSize,
  viewport: CaptureSize
): void {
  const context = prepareCanvas(canvas, imageSize, viewport)
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, imageSize.width, imageSize.height)
  const scaleX = imageSize.width / viewport.width
  const scaleY = imageSize.height / viewport.height

  for (const annotation of [...annotations, ...(draft ? [draft] : [])]) {
    if (annotation.type === 'mosaic') {
      drawMosaic(context, backgroundCanvas, annotation.rect, viewport, imageSize)
      continue
    }
    if (annotation.type === 'mosaic-paint') {
      drawMosaicPaint(context, backgroundCanvas, annotation, viewport, imageSize)
      continue
    }
    context.save()
    context.scale(scaleX, scaleY)
    drawVectorAnnotation(context, annotation)
    context.restore()
  }
}

export function drawInteractionLayer(
  canvas: HTMLCanvasElement,
  selection: CaptureRect | null,
  selected: CaptureAnnotation | null,
  viewport: CaptureSize,
  locked: boolean,
  brushCursor?: { point: { x: number; y: number }; size: number } | null
): void {
  const context = prepareCanvas(canvas, viewport, viewport)
  context.clearRect(0, 0, viewport.width, viewport.height)

  if (!selection) {
    context.fillStyle = locked ? 'rgba(0, 0, 0, 0.58)' : 'rgba(0, 0, 0, 0.30)'
    context.fillRect(0, 0, viewport.width, viewport.height)
    return
  }

  context.fillStyle = locked ? 'rgba(0, 0, 0, 0.62)' : 'rgba(0, 0, 0, 0.44)'
  context.fillRect(0, 0, viewport.width, selection.y)
  context.fillRect(0, selection.y, selection.x, selection.height)
  context.fillRect(
    selection.x + selection.width,
    selection.y,
    viewport.width - selection.x - selection.width,
    selection.height
  )
  context.fillRect(
    0,
    selection.y + selection.height,
    viewport.width,
    viewport.height - selection.y - selection.height
  )

  context.strokeStyle = '#3f8cff'
  context.lineWidth = 2
  context.strokeRect(selection.x, selection.y, selection.width, selection.height)

  if (!locked) drawResizeHandles(context, selection)
  if (selected) {
    drawAnnotationSelection(context, selected)
  }

  if (brushCursor) {
    context.save()
    context.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    context.lineWidth = 1.5
    context.setLineDash([4, 4])
    context.beginPath()
    context.arc(brushCursor.point.x, brushCursor.point.y, brushCursor.size / 2, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }
}

export function exportSelectionImage(
  backgroundCanvas: HTMLCanvasElement,
  annotationCanvas: HTMLCanvasElement,
  selection: CaptureRect,
  viewport: CaptureSize,
  imageSize: CaptureSize
): { dataUrl: string; width: number; height: number } {
  const source = toPixelRect(selection, viewport, imageSize)
  const output = document.createElement('canvas')
  output.width = source.width
  output.height = source.height
  const context = output.getContext('2d')
  if (!context) throw new Error('无法创建导出画布')
  context.drawImage(
    backgroundCanvas,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    source.width,
    source.height
  )
  context.drawImage(
    annotationCanvas,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    source.width,
    source.height
  )
  return {
    dataUrl: output.toDataURL('image/png'),
    width: source.width,
    height: source.height
  }
}

function drawVectorAnnotation(
  context: CanvasRenderingContext2D,
  annotation: Exclude<CaptureAnnotation | CaptureDraft, { type: 'mosaic' } | { type: 'mosaic-paint' }>
): void {
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    drawShape(context, annotation)
    return
  }
  if (annotation.type === 'text') {
    drawText(context, annotation)
    return
  }
  if (annotation.type === 'step') {
    drawStep(context, annotation)
    return
  }

  const line = annotation as LineAnnotation
  context.strokeStyle = line.color
  context.fillStyle = line.color
  context.lineWidth = line.strokeWidth
  context.beginPath()
  line.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.stroke()

  if (line.type === 'arrow' && line.points.length >= 2) {
    const end = line.points[line.points.length - 1]
    const before = line.points[line.points.length - 2]
    const angle = Math.atan2(end.y - before.y, end.x - before.x)
    const length = Math.max(12, (line.arrowSize ?? line.strokeWidth * 4))
    context.beginPath()
    context.moveTo(end.x, end.y)
    context.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6))
    context.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6))
    context.closePath()
    context.fill()
  }
}

function drawShape(context: CanvasRenderingContext2D, shape: ShapeAnnotation): void {
  context.strokeStyle = shape.color
  context.lineWidth = shape.strokeWidth
  if (shape.dashed) {
    context.setLineDash([shape.strokeWidth * 2, shape.strokeWidth])
  } else {
    context.setLineDash([])
  }

  if (shape.type === 'rect') {
    if (shape.fillColor) {
      context.fillStyle = shape.fillColor
      context.fillRect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height)
    }
    context.strokeRect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height)
  } else {
    context.beginPath()
    context.ellipse(
      shape.rect.x + shape.rect.width / 2,
      shape.rect.y + shape.rect.height / 2,
      shape.rect.width / 2,
      shape.rect.height / 2,
      0,
      0,
      Math.PI * 2
    )
    if (shape.fillColor) {
      context.fillStyle = shape.fillColor
      context.fill()
    }
    context.stroke()
  }
  context.setLineDash([])
}

function drawText(context: CanvasRenderingContext2D, annotation: { point: { x: number; y: number }; text: string; color: string; fontSize: number; bold?: boolean; bgColor?: string | null; align?: string }): void {
  const lines = annotation.text.split('\n')
  const lineHeight = annotation.fontSize * 1.4
  const weight = annotation.bold ? '700' : '600'
  context.font = `${weight} ${annotation.fontSize}px "Microsoft YaHei UI", sans-serif`
  context.textBaseline = 'top'

  if (annotation.align === 'center') context.textAlign = 'center'
  else if (annotation.align === 'right') context.textAlign = 'right'
  else context.textAlign = 'left'

  if (annotation.bgColor) {
    const maxWidth = Math.max(...lines.map((l) => context.measureText(l).width))
    const totalHeight = lines.length * lineHeight
    let bgX = annotation.point.x - 4
    if (annotation.align === 'center') bgX = annotation.point.x - maxWidth / 2 - 4
    else if (annotation.align === 'right') bgX = annotation.point.x - maxWidth - 4
    context.fillStyle = annotation.bgColor
    context.fillRect(bgX, annotation.point.y - 2, maxWidth + 8, totalHeight + 4)
  }

  context.fillStyle = annotation.color
  lines.forEach((line, i) => {
    context.fillText(line, annotation.point.x, annotation.point.y + i * lineHeight)
  })
}

function drawStep(context: CanvasRenderingContext2D, step: StepAnnotation): void {
  context.beginPath()
  context.arc(step.point.x, step.point.y, step.size, 0, Math.PI * 2)
  context.fillStyle = step.bgColor
  context.fill()

  context.fillStyle = step.color
  context.font = `bold ${step.size}px "Microsoft YaHei UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(step.number), step.point.x, step.point.y)
}

function drawMosaic(
  context: CanvasRenderingContext2D,
  backgroundCanvas: HTMLCanvasElement,
  rect: CaptureRect,
  viewport: CaptureSize,
  imageSize: CaptureSize
): void {
  const source = toPixelRect(rect, viewport, imageSize)
  if (source.width <= 0 || source.height <= 0) return
  const block = Math.max(6, Math.round(Math.min(source.width, source.height) / 18))
  const tiny = document.createElement('canvas')
  tiny.width = Math.max(1, Math.ceil(source.width / block))
  tiny.height = Math.max(1, Math.ceil(source.height / block))
  const tinyContext = tiny.getContext('2d')
  if (!tinyContext) return
  tinyContext.drawImage(
    backgroundCanvas,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    tiny.width,
    tiny.height
  )
  context.save()
  context.imageSmoothingEnabled = false
  context.drawImage(tiny, 0, 0, tiny.width, tiny.height, source.x, source.y, source.width, source.height)
  context.restore()
}

function drawMosaicPaint(
  context: CanvasRenderingContext2D,
  backgroundCanvas: HTMLCanvasElement,
  annotation: MosaicPaintAnnotation,
  viewport: CaptureSize,
  imageSize: CaptureSize
): void {
  if (annotation.points.length === 0) return
  const scaleX = imageSize.width / viewport.width
  const scaleY = imageSize.height / viewport.height
  const block = Math.max(4, Math.round(annotation.strength))

  for (const point of annotation.points) {
    const px = Math.round(point.x * scaleX)
    const py = Math.round(point.y * scaleY)
    const r = Math.round((annotation.brushSize / 2) * Math.min(scaleX, scaleY))

    const sx = Math.max(0, px - r)
    const sy = Math.max(0, py - r)
    const sw = Math.min(imageSize.width - sx, r * 2)
    const sh = Math.min(imageSize.height - sy, r * 2)
    if (sw <= 0 || sh <= 0) continue

    const tinyW = Math.max(1, Math.ceil(sw / block))
    const tinyH = Math.max(1, Math.ceil(sh / block))
    const tiny = document.createElement('canvas')
    tiny.width = tinyW
    tiny.height = tinyH
    const tinyCtx = tiny.getContext('2d')
    if (!tinyCtx) continue
    tinyCtx.drawImage(backgroundCanvas, sx, sy, sw, sh, 0, 0, tinyW, tinyH)

    context.save()
    context.imageSmoothingEnabled = false
    context.drawImage(tiny, 0, 0, tinyW, tinyH, sx, sy, sw, sh)
    context.restore()
  }
}

function drawAnnotationSelection(context: CanvasRenderingContext2D, selected: CaptureAnnotation): void {
  const bounds = getAnnotationBounds(selected)
  context.save()
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1
  context.setLineDash([6, 4])
  context.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8)
  context.restore()

  if (selected.type === 'rect' || selected.type === 'ellipse') {
    drawResizeHandles(context, selected.rect)
  }
  if (selected.type === 'arrow' && selected.points.length >= 2) {
    drawEndpointHandle(context, selected.points[0])
    drawEndpointHandle(context, selected.points[selected.points.length - 1])
  }
}

function drawEndpointHandle(context: CanvasRenderingContext2D, point: { x: number; y: number }): void {
  context.save()
  context.fillStyle = '#ffffff'
  context.strokeStyle = '#3f8cff'
  context.lineWidth = 2
  context.beginPath()
  context.arc(point.x, point.y, 6, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.restore()
}

function drawResizeHandles(context: CanvasRenderingContext2D, rect: CaptureRect): void {
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.width / 2, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height / 2],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width / 2, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
    [rect.x, rect.y + rect.height / 2]
  ]
  context.fillStyle = '#ffffff'
  context.strokeStyle = '#3f8cff'
  context.lineWidth = 2
  for (const [x, y] of points) {
    context.beginPath()
    context.arc(x, y, 5, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
}
