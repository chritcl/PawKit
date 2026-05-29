import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import {
  Arrow,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text
} from 'react-konva'
import {
  ArrowUpRight,
  Brush,
  Check,
  Highlighter,
  MousePointer2,
  PenLine,
  RotateCcw,
  RotateCw,
  Square,
  Type,
  X
} from 'lucide-react'
import { ScreenshotCapturePayload, ScreenshotResult } from '../../../../../shared/types'
import {
  fitImageSize,
  isUsableScreenshotRect,
  mapCssRectToImageRect,
  normalizeScreenshotRect,
  ScreenshotPoint,
  ScreenshotRect,
  ScreenshotSize
} from '../../../utils/screenshot-geometry'

type CaptureStep = 'selecting' | 'editing'
type AnnotationTool = 'select' | 'pen' | 'arrow' | 'rect' | 'text' | 'mosaic'

interface BaseAnnotation {
  id: string
  type: AnnotationTool
}

interface PenAnnotation extends BaseAnnotation {
  type: 'pen'
  points: number[]
  color: string
  strokeWidth: number
}

interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow'
  points: number[]
  color: string
  strokeWidth: number
}

interface RectAnnotation extends BaseAnnotation {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  color: string
  strokeWidth: number
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

interface MosaicAnnotation extends BaseAnnotation {
  type: 'mosaic'
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
}

type Annotation = PenAnnotation | ArrowAnnotation | RectAnnotation | TextAnnotation | MosaicAnnotation
type DraftAnnotation = Exclude<Annotation, TextAnnotation | MosaicAnnotation> | RectAnnotation

interface EditorImage {
  dataUrl: string
  width: number
  height: number
}

const colors = ['#ff4d4f', '#faad14', '#52c41a', '#1677ff', '#ffffff', '#111827']
const toolItems: Array<{ tool: AnnotationTool; label: string; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: '选择', icon: MousePointer2 },
  { tool: 'pen', label: '画笔', icon: Brush },
  { tool: 'arrow', label: '箭头', icon: ArrowUpRight },
  { tool: 'rect', label: '矩形', icon: Square },
  { tool: 'text', label: '文字', icon: Type },
  { tool: 'mosaic', label: '马赛克', icon: Highlighter }
]

// 加载图片元素
function useImageElement(src: string | null): HTMLImageElement | null {
  const [loadedImage, setLoadedImage] = useState<{ src: string; image: HTMLImageElement } | null>(null)

  useEffect(() => {
    if (!src) return

    let cancelled = false
    const nextImage = new window.Image()
    nextImage.onload = () => {
      if (!cancelled) {
        setLoadedImage({ src, image: nextImage })
      }
    }
    nextImage.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return loadedImage?.src === src ? loadedImage.image : null
}

function MosaicImage({ shape }: { shape: MosaicAnnotation }): JSX.Element | null {
  const image = useImageElement(shape.dataUrl)
  if (!image) return null

  return (
    <KonvaImage
      image={image}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
    />
  )
}

// 创建马赛克图片块
async function createMosaicPatch(
  imageDataUrl: string,
  sourceSize: ScreenshotSize,
  rect: ScreenshotRect,
  stageSize: ScreenshotSize
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image()
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = () => reject(new Error('马赛克图片加载失败'))
    nextImage.src = imageDataUrl
  })

  const sourceRect = mapCssRectToImageRect(rect, stageSize, sourceSize)
  const blockWidth = Math.max(1, Math.floor(sourceRect.width / 12))
  const blockHeight = Math.max(1, Math.floor(sourceRect.height / 12))
  const tinyCanvas = document.createElement('canvas')
  const tinyContext = tinyCanvas.getContext('2d')
  const resultCanvas = document.createElement('canvas')
  const resultContext = resultCanvas.getContext('2d')
  if (!tinyContext || !resultContext) {
    throw new Error('马赛克画布创建失败')
  }

  tinyCanvas.width = blockWidth
  tinyCanvas.height = blockHeight
  resultCanvas.width = sourceRect.width
  resultCanvas.height = sourceRect.height
  tinyContext.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    blockWidth,
    blockHeight
  )
  resultContext.imageSmoothingEnabled = false
  resultContext.drawImage(tinyCanvas, 0, 0, sourceRect.width, sourceRect.height)
  return resultCanvas.toDataURL('image/png')
}

// 系统级截图覆盖层
export function ScreenshotCaptureOverlay(): JSX.Element {
  const [payload, setPayload] = useState<ScreenshotCapturePayload | null>(null)
  const [step, setStep] = useState<CaptureStep>('selecting')
  const [startPoint, setStartPoint] = useState<ScreenshotPoint | null>(null)
  const [endPoint, setEndPoint] = useState<ScreenshotPoint | null>(null)
  const [editorImage, setEditorImage] = useState<EditorImage | null>(null)
  const [tool, setTool] = useState<AnnotationTool>('select')
  const [color, setColor] = useState(colors[0])
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [history, setHistory] = useState<Annotation[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [draft, setDraft] = useState<DraftAnnotation | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<ScreenshotSize>({
    width: window.innerWidth,
    height: window.innerHeight
  })
  const stageRef = useRef<Konva.Stage>(null)
  const backgroundImage = useImageElement(editorImage?.dataUrl ?? null)
  const screenshotImage = useImageElement(payload?.screenshot.dataUrl ?? null)

  const selectionRect = useMemo(() => {
    if (!startPoint || !endPoint) return null
    return normalizeScreenshotRect(startPoint, endPoint)
  }, [startPoint, endPoint])

  const stageSize = useMemo(() => {
    if (!editorImage) return { width: 1, height: 1 }
    return fitImageSize(editorImage, {
      width: Math.max(320, viewport.width - 260),
      height: Math.max(240, viewport.height - 96)
    })
  }, [editorImage, viewport])

  const commitAnnotations = useCallback((nextAnnotations: Annotation[]) => {
    setAnnotations(nextAnnotations)
    setHistory((currentHistory) => {
      const nextHistory = currentHistory.slice(0, historyIndex + 1)
      nextHistory.push(nextAnnotations)
      return nextHistory
    })
    setHistoryIndex((index) => index + 1)
  }, [historyIndex])

  useEffect(() => {
    const removeListener = window.electronAPI.screenshot.onCaptureData((nextPayload) => {
      setPayload(nextPayload)
    })
    window.electronAPI.screenshot.captureOverlayReady()
    return () => removeListener()
  }, [])

  useEffect(() => {
    const handleResize = (): void => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const cancelCapture = useCallback((): void => {
    window.electronAPI.screenshot.cancelCapture()
  }, [])

  const enterEditing = useCallback((): void => {
    if (!payload || !selectionRect || !screenshotImage) return
    if (!isUsableScreenshotRect(selectionRect)) return

    const imageRect = mapCssRectToImageRect(
      selectionRect,
      { width: window.innerWidth, height: window.innerHeight },
      { width: payload.screenshot.width, height: payload.screenshot.height }
    )
    if (!isUsableScreenshotRect(imageRect, 1)) return

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = imageRect.width
    canvas.height = imageRect.height
    context.drawImage(
      screenshotImage,
      imageRect.x,
      imageRect.y,
      imageRect.width,
      imageRect.height,
      0,
      0,
      imageRect.width,
      imageRect.height
    )

    setEditorImage({
      dataUrl: canvas.toDataURL('image/png'),
      width: imageRect.width,
      height: imageRect.height
    })
    setAnnotations([])
    setHistory([[]])
    setHistoryIndex(0)
    setSelectedId(null)
    setStep('editing')
  }, [payload, screenshotImage, selectionRect])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        cancelCapture()
        return
      }
      if (event.key === 'Enter' && step === 'selecting') {
        enterEditing()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && step === 'editing') {
        event.preventDefault()
        if (historyIndex > 0) {
          const nextIndex = historyIndex - 1
          setHistoryIndex(nextIndex)
          setAnnotations(history[nextIndex])
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && step === 'editing') {
        event.preventDefault()
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1
          setHistoryIndex(nextIndex)
          setAnnotations(history[nextIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelCapture, enterEditing, history, historyIndex, step])

  const handleSelectMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    setStartPoint({ x: event.clientX, y: event.clientY })
    setEndPoint({ x: event.clientX, y: event.clientY })
  }

  const handleSelectMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!startPoint) return
    setEndPoint({ x: event.clientX, y: event.clientY })
  }

  const handleSelectMouseUp = (): void => {
    if (selectionRect && isUsableScreenshotRect(selectionRect)) {
      enterEditing()
    }
  }

  const getStagePoint = (): ScreenshotPoint | null => {
    const stage = stageRef.current
    if (!stage) return null
    const point = stage.getPointerPosition()
    return point ? { x: point.x, y: point.y } : null
  }

  const handleStageMouseDown = (): void => {
    const point = getStagePoint()
    if (!point) return

    if (tool === 'select') {
      setSelectedId(null)
      return
    }

    if (tool === 'text') {
      const text = window.prompt('请输入标注文字')
      if (text) {
        commitAnnotations([
          ...annotations,
          {
            id: crypto.randomUUID(),
            type: 'text',
            x: point.x,
            y: point.y,
            text,
            color,
            fontSize: 20
          }
        ])
      }
      return
    }

    if (tool === 'pen') {
      setDraft({
        id: crypto.randomUUID(),
        type: 'pen',
        points: [point.x, point.y],
        color,
        strokeWidth
      })
      return
    }

    if (tool === 'arrow') {
      setDraft({
        id: crypto.randomUUID(),
        type: 'arrow',
        points: [point.x, point.y, point.x, point.y],
        color,
        strokeWidth
      })
      return
    }

    setDraft({
      id: crypto.randomUUID(),
      type: 'rect',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      color,
      strokeWidth
    })
  }

  const handleStageMouseMove = (): void => {
    if (!draft) return
    const point = getStagePoint()
    if (!point) return

    if (draft.type === 'pen') {
      setDraft({ ...draft, points: [...draft.points, point.x, point.y] })
      return
    }

    if (draft.type === 'arrow') {
      setDraft({
        ...draft,
        points: [draft.points[0], draft.points[1], point.x, point.y]
      })
      return
    }

    setDraft({
      ...draft,
      width: point.x - draft.x,
      height: point.y - draft.y
    })
  }

  const finishDraft = async (): Promise<void> => {
    if (!draft || !editorImage) return

    if (draft.type === 'pen') {
      if (draft.points.length > 4) {
        commitAnnotations([...annotations, draft])
      }
      setDraft(null)
      return
    }

    if (draft.type === 'arrow') {
      const width = Math.abs(draft.points[2] - draft.points[0])
      const height = Math.abs(draft.points[3] - draft.points[1])
      if (width >= 6 || height >= 6) {
        commitAnnotations([...annotations, draft])
      }
      setDraft(null)
      return
    }

    const normalized = normalizeScreenshotRect(
      { x: draft.x, y: draft.y },
      { x: draft.x + draft.width, y: draft.y + draft.height }
    )
    if (!isUsableScreenshotRect(normalized)) {
      setDraft(null)
      return
    }

    if (tool === 'mosaic') {
      try {
        const dataUrl = await createMosaicPatch(editorImage.dataUrl, editorImage, normalized, stageSize)
        commitAnnotations([
          ...annotations,
          {
            id: draft.id,
            type: 'mosaic',
            x: normalized.x,
            y: normalized.y,
            width: normalized.width,
            height: normalized.height,
            dataUrl
          }
        ])
      } catch {
        // 马赛克失败时忽略本次绘制
      }
    } else {
      commitAnnotations([
        ...annotations,
        {
          id: draft.id,
          type: 'rect',
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
          color: draft.color,
          strokeWidth: draft.strokeWidth
        }
      ])
    }

    setDraft(null)
  }

  const moveAnnotation = (id: string, dx: number, dy: number): void => {
    const nextAnnotations = annotations.map((item) => {
      if (item.id !== id) return item
      if (item.type === 'pen' || item.type === 'arrow') {
        return {
          ...item,
          points: item.points.map((value, index) => value + (index % 2 === 0 ? dx : dy))
        }
      }
      return {
        ...item,
        x: item.x + dx,
        y: item.y + dy
      }
    })
    commitAnnotations(nextAnnotations)
  }

  const undo = (): void => {
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setAnnotations(history[nextIndex])
  }

  const redo = (): void => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    setAnnotations(history[nextIndex])
  }

  const finishCapture = (): void => {
    if (!payload || !editorImage || !stageRef.current) return
    const pixelRatio = editorImage.width / stageSize.width
    const dataUrl = stageRef.current.toDataURL({
      pixelRatio,
      mimeType: 'image/png'
    })
    const result: ScreenshotResult = {
      dataUrl,
      width: editorImage.width,
      height: editorImage.height,
      createdAt: new Date().toISOString(),
      displayId: payload.screenshot.displayId,
      displayBounds: payload.displayBounds,
      scaleFactor: payload.scaleFactor
    }
    window.electronAPI.screenshot.finishCapture(result)
  }

  const renderAnnotation = (annotation: Annotation | DraftAnnotation): JSX.Element | null => {
    const commonProps = {
      draggable: tool === 'select',
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true
        setSelectedId(annotation.id)
      },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        const dx = event.target.x()
        const dy = event.target.y()
        event.target.position({ x: 0, y: 0 })
        moveAnnotation(annotation.id, dx, dy)
      }
    }

    if (annotation.type === 'pen') {
      return (
        <Line
          key={annotation.id}
          points={annotation.points}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          tension={0.45}
          lineCap="round"
          lineJoin="round"
          {...commonProps}
        />
      )
    }

    if (annotation.type === 'arrow') {
      return (
        <Arrow
          key={annotation.id}
          points={annotation.points}
          stroke={annotation.color}
          fill={annotation.color}
          strokeWidth={annotation.strokeWidth}
          pointerLength={14}
          pointerWidth={14}
          {...commonProps}
        />
      )
    }

    if (annotation.type === 'rect') {
      return (
        <Rect
          key={annotation.id}
          x={annotation.x}
          y={annotation.y}
          width={annotation.width}
          height={annotation.height}
          stroke={annotation.id === selectedId ? '#ffffff' : annotation.color}
          strokeWidth={annotation.strokeWidth}
          dash={annotation.id === selectedId ? [8, 4] : undefined}
          {...commonProps}
        />
      )
    }

    if (annotation.type === 'text') {
      return (
        <Text
          key={annotation.id}
          x={annotation.x}
          y={annotation.y}
          text={annotation.text}
          fill={annotation.color}
          fontSize={annotation.fontSize}
          fontStyle="bold"
          padding={4}
          {...commonProps}
        />
      )
    }

    return <MosaicImage key={annotation.id} shape={annotation} />
  }

  if (!payload) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-white">
        正在准备截图...
      </div>
    )
  }

  if (step === 'selecting') {
    return (
      <div
        className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-black"
        onMouseDown={handleSelectMouseDown}
        onMouseMove={handleSelectMouseMove}
        onMouseUp={handleSelectMouseUp}
      >
        <img
          src={payload.screenshot.dataUrl}
          alt="屏幕截图"
          className="h-full w-full select-none object-fill"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/20" />
        {selectionRect && (
          <>
            <div
              className="pointer-events-none absolute border-2 border-[#1677ff] bg-[#1677ff]/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height
              }}
            />
            <div
              className="pointer-events-none absolute rounded bg-black/70 px-2 py-1 text-xs text-white"
              style={{
                left: selectionRect.x,
                top: Math.max(8, selectionRect.y - 30)
              }}
            >
              {Math.round(selectionRect.width)} x {Math.round(selectionRect.height)}
            </div>
          </>
        )}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-[8px] border border-[var(--glass-border)] bg-[var(--window-surface-strong)] px-4 py-2 text-sm text-[color:var(--text-primary)] shadow-2xl">
          拖拽选择区域，松开进入标注，ESC 取消
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg-deep)] text-[color:var(--text-primary)]">
      <aside className="flex w-64 flex-col border-r border-[var(--glass-border)] bg-[var(--window-surface)] p-4">
        <div>
          <div className="text-sm font-medium">截图标注</div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            完成后回到截图页复制或保存
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {toolItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.tool}
                className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm transition ${
                  tool === item.tool
                    ? 'border-[rgba(var(--color-primary-rgb),0.55)] bg-[var(--color-primary-soft)] text-[color:var(--text-primary)]'
                    : 'border-[var(--glass-border)] bg-[var(--input-surface)] text-[color:var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
                }`}
                onClick={() => setTool(item.tool)}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="mt-5 space-y-3">
          <div className="text-xs text-[color:var(--text-muted)]">颜色</div>
          <div className="flex flex-wrap gap-2">
            {colors.map((item) => (
              <button
                key={item}
                className={`h-7 w-7 rounded-full border ${color === item ? 'border-[color:var(--text-primary)]' : 'border-[var(--glass-border)]'}`}
                style={{ backgroundColor: item }}
                onClick={() => setColor(item)}
                title={item}
              />
            ))}
          </div>
        </div>

        <label className="mt-5 block">
          <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--text-muted)]">
            <span>线宽</span>
            <span>{strokeWidth}px</span>
          </div>
          <input
            type="range"
            min={2}
            max={14}
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
            className="w-full"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="toolbar-button h-9 min-h-9 disabled:opacity-40"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="撤销"
          >
            <RotateCcw className="h-4 w-4" />
            撤销
          </button>
          <button
            className="toolbar-button h-9 min-h-9 disabled:opacity-40"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="重做"
          >
            <RotateCw className="h-4 w-4" />
            重做
          </button>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            className="toolbar-button h-10 min-h-10"
            onClick={cancelCapture}
            title="取消"
          >
            <X className="h-4 w-4" />
            取消
          </button>
          <button
            className="toolbar-button-primary h-10 min-h-10"
            onClick={finishCapture}
            title="完成"
          >
            <Check className="h-4 w-4" />
            完成
          </button>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div className="rounded-[8px] border border-[var(--glass-border)] bg-[var(--window-surface)] p-2 shadow-2xl">
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={() => void finishDraft()}
            className="overflow-hidden rounded-sm"
          >
            <Layer>
              {backgroundImage && (
                <KonvaImage
                  image={backgroundImage}
                  width={stageSize.width}
                  height={stageSize.height}
                />
              )}
              {annotations.map((annotation) => renderAnnotation(annotation))}
              {draft && renderAnnotation(draft)}
            </Layer>
          </Stage>
        </div>
      </main>

      <div className="absolute bottom-4 right-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--window-surface-strong)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
        <PenLine className="mr-1 inline h-3.5 w-3.5" />
        Ctrl+Z 撤销，Ctrl+Y 重做，ESC 取消
      </div>
    </div>
  )
}
