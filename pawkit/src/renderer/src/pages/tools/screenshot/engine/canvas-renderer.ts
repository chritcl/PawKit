import { getAnnotationBounds } from './annotations'
import { toPixelRect } from './geometry'
import type {
  CaptureAnnotation,
  CaptureDraft,
  LineAnnotation,
  CaptureRect,
  CaptureSize
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
  locked: boolean
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
    const bounds = getAnnotationBounds(selected)
    context.save()
    context.strokeStyle = '#ffffff'
    context.lineWidth = 1
    context.setLineDash([6, 4])
    context.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8)
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
  annotation: Exclude<CaptureAnnotation | CaptureDraft, { type: 'mosaic' }>
): void {
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (annotation.type === 'rect') {
    context.strokeStyle = annotation.color
    context.lineWidth = annotation.strokeWidth
    context.strokeRect(annotation.rect.x, annotation.rect.y, annotation.rect.width, annotation.rect.height)
    return
  }
  if (annotation.type === 'ellipse') {
    context.strokeStyle = annotation.color
    context.lineWidth = annotation.strokeWidth
    context.beginPath()
    context.ellipse(
      annotation.rect.x + annotation.rect.width / 2,
      annotation.rect.y + annotation.rect.height / 2,
      annotation.rect.width / 2,
      annotation.rect.height / 2,
      0,
      0,
      Math.PI * 2
    )
    context.stroke()
    return
  }
  if (annotation.type === 'text') {
    context.fillStyle = annotation.color
    context.font = `600 ${annotation.fontSize}px "Microsoft YaHei UI", sans-serif`
    context.textBaseline = 'top'
    context.fillText(annotation.text, annotation.point.x, annotation.point.y)
    return
  }

  context.strokeStyle = annotation.color
  context.fillStyle = annotation.color
  context.lineWidth = annotation.strokeWidth
  context.beginPath()
  const line = annotation as LineAnnotation
  line.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.stroke()

  if (annotation.type === 'arrow' && line.points.length >= 2) {
    const end = line.points[line.points.length - 1]
    const before = line.points[line.points.length - 2]
    const angle = Math.atan2(end.y - before.y, end.x - before.x)
    const length = Math.max(12, annotation.strokeWidth * 4)
    context.beginPath()
    context.moveTo(end.x, end.y)
    context.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6))
    context.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6))
    context.closePath()
    context.fill()
  }
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
