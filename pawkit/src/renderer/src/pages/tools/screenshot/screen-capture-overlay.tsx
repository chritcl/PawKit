import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Brush,
  Check,
  Circle,
  Clipboard,
  Highlighter,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Save,
  Square,
  Type,
  X
} from 'lucide-react'
import type {
  ScreenCaptureDisplayPayload,
  ScreenCaptureSessionState
} from '../../../../../shared/types'
import {
  drawAnnotationLayer,
  drawFrozenScreen,
  drawInteractionLayer,
  exportSelectionImage
} from './engine/canvas-renderer'
import { hitTestAnnotation, moveAnnotation } from './engine/annotations'
import {
  containsPoint,
  getResizeHandle,
  getToolbarPosition,
  isUsableRect,
  moveRect,
  normalizeRect,
  resizeRect
} from './engine/geometry'
import {
  captureEditorReducer,
  createInitialCaptureEditorState
} from './engine/reducer'
import type {
  CaptureAnnotation,
  CapturePoint,
  CaptureRect,
  CaptureSize,
  CaptureTool,
  ResizeDirection
} from './engine/types'

type PointerInteraction =
  | { type: 'selecting'; start: CapturePoint }
  | { type: 'moving-selection'; start: CapturePoint; initial: CaptureRect }
  | { type: 'resizing-selection'; start: CapturePoint; initial: CaptureRect; direction: ResizeDirection }
  | {
    type: 'moving-annotation'
    start: CapturePoint
    annotation: CaptureAnnotation
    initialAnnotations: CaptureAnnotation[]
  }

interface TextEditorState {
  point: CapturePoint
  value: string
}

const tools: Array<{ tool: CaptureTool; label: string; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: '选择', icon: MousePointer2 },
  { tool: 'rect', label: '矩形', icon: Square },
  { tool: 'ellipse', label: '椭圆', icon: Circle },
  { tool: 'arrow', label: '箭头', icon: ArrowUpRight },
  { tool: 'pen', label: '画笔', icon: Brush },
  { tool: 'text', label: '文字', icon: Type },
  { tool: 'mosaic', label: '马赛克', icon: Highlighter }
]

// 全新 Canvas 截图覆盖层
export function ScreenCaptureOverlay(): JSX.Element {
  const [payload, setPayload] = useState<ScreenCaptureDisplayPayload | null>(null)
  const [sessionState, setSessionState] = useState<ScreenCaptureSessionState | null>(null)
  const [state, dispatch] = useReducer(captureEditorReducer, undefined, createInitialCaptureEditorState)
  const [color, setColor] = useState('#ff4d4f')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)
  const [toolbarSize, setToolbarSize] = useState<CaptureSize>({ width: 690, height: 46 })
  const [message, setMessage] = useState<string | null>(null)
  const [cursor, setCursor] = useState('crosshair')
  const backgroundRef = useRef<HTMLCanvasElement>(null)
  const annotationRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<HTMLCanvasElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pointerInteractionRef = useRef<PointerInteraction | null>(null)
  const shapeStartRef = useRef<CapturePoint | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const viewport = useMemo<CaptureSize>(() => ({
    width: payload?.bounds.width ?? window.innerWidth,
    height: payload?.bounds.height ?? window.innerHeight
  }), [payload])
  const imageSize = useMemo<CaptureSize>(() => ({
    width: payload?.width ?? 1,
    height: payload?.height ?? 1
  }), [payload])
  const locked = sessionState?.status === 'locked'
  const selectedAnnotation = useMemo(
    () => state.annotations.find((annotation) => annotation.id === state.selectedId) ?? null,
    [state.annotations, state.selectedId]
  )
  const toolbarPosition = useMemo(
    () => state.selection
      ? getToolbarPosition(state.selection, toolbarSize, viewport)
      : { x: 8, y: 8 },
    [state.selection, toolbarSize, viewport]
  )

  useEffect(() => {
    const removePayload = window.electronAPI.screenCapture.onPayload((nextPayload) => {
      setPayload(nextPayload)
      setColor(nextPayload.preferences.annotationColor)
      setStrokeWidth(nextPayload.preferences.strokeWidth)
    })
    const removeState = window.electronAPI.screenCapture.onSessionState(setSessionState)
    window.electronAPI.screenCapture.overlayReady()
    return () => {
      removePayload()
      removeState()
    }
  }, [])

  useEffect(() => {
    if (!payload || !backgroundRef.current) return
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled || !backgroundRef.current) return
      imageRef.current = image
      drawFrozenScreen(backgroundRef.current, image, imageSize, viewport)
    }
    image.src = payload.dataUrl
    return () => {
      cancelled = true
    }
  }, [imageSize, payload, viewport])

  useEffect(() => {
    if (!payload || !annotationRef.current || !backgroundRef.current) return
    drawAnnotationLayer(
      annotationRef.current,
      backgroundRef.current,
      state.annotations,
      state.draft,
      imageSize,
      viewport
    )
  }, [imageSize, payload, state.annotations, state.draft, viewport])

  useEffect(() => {
    if (!interactionRef.current) return
    drawInteractionLayer(
      interactionRef.current,
      state.selection,
      selectedAnnotation,
      viewport,
      Boolean(locked)
    )
  }, [locked, selectedAnnotation, state.selection, viewport])

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const update = (): void => setToolbarSize({ width: toolbar.offsetWidth, height: toolbar.offsetHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [state.selection])

  const exportCurrent = useCallback(() => {
    if (
      !payload ||
      !state.selection ||
      !backgroundRef.current ||
      !annotationRef.current
    ) return null
    return exportSelectionImage(
      backgroundRef.current,
      annotationRef.current,
      state.selection,
      viewport,
      imageSize
    )
  }, [imageSize, payload, state.selection, viewport])

  const performOutput = useCallback(async (action: 'copy' | 'complete' | 'save'): Promise<void> => {
    if (!payload) return
    const exported = exportCurrent()
    if (!exported) return
    try {
      const response = await window.electronAPI.screenCapture.performAction({
        action,
        dataUrl: exported.dataUrl,
        width: exported.width,
        height: exported.height,
        displayId: payload.displayId
      })
      if (response.status === 'error') setMessage(response.message)
      if (response.status === 'copied' && action === 'copy') setMessage(response.message)
    } catch {
      setMessage(action === 'save' ? '保存截图失败' : '复制截图失败')
    }
  }, [exportCurrent, payload])

  const commitText = useCallback((): void => {
    const text = textEditor?.value.trim()
    if (textEditor && text) {
      dispatch({
        type: 'commit-annotations',
        annotations: [
          ...state.annotations,
          {
            id: crypto.randomUUID(),
            type: 'text',
            point: textEditor.point,
            text,
            color,
            fontSize: Math.max(16, strokeWidth * 5)
          }
        ]
      })
    }
    setTextEditor(null)
    dispatch({ type: 'set-phase', phase: 'editing' })
  }, [color, state.annotations, strokeWidth, textEditor])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (textEditor) {
        if (event.key === 'Escape') setTextEditor(null)
        return
      }
      if (event.key === 'Escape') {
        window.electronAPI.screenCapture.cancel()
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedId) {
        event.preventDefault()
        dispatch({
          type: 'commit-annotations',
          annotations: state.annotations.filter((annotation) => annotation.id !== state.selectedId)
        })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: 'undo' })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        dispatch({ type: 'redo' })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void performOutput('copy')
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void performOutput('save')
      } else if (event.key === 'Enter' && state.selection) {
        event.preventDefault()
        void performOutput('complete')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [performOutput, state.annotations, state.selectedId, state.selection, textEditor])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): CapturePoint => ({
    x: event.clientX,
    y: event.clientY
  })

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0 || locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    window.electronAPI.screenCapture.claim()
    const point = getPoint(event)

    if (state.tool === 'select') {
      const handle = state.selection ? getResizeHandle(point, state.selection) : null
      if (state.selection && handle) {
        pointerInteractionRef.current = {
          type: 'resizing-selection',
          start: point,
          initial: state.selection,
          direction: handle
        }
        return
      }

      const annotation = state.selection
        ? hitTestAnnotation(state.annotations, point)
        : null
      if (annotation) {
        dispatch({ type: 'set-selected', id: annotation.id })
        pointerInteractionRef.current = {
          type: 'moving-annotation',
          start: point,
          annotation,
          initialAnnotations: state.annotations
        }
        return
      }

      if (state.selection && containsPoint(state.selection, point)) {
        pointerInteractionRef.current = {
          type: 'moving-selection',
          start: point,
          initial: state.selection
        }
        dispatch({ type: 'set-selected', id: null })
        return
      }

      pointerInteractionRef.current = { type: 'selecting', start: point }
      dispatch({
        type: 'set-selection',
        selection: { x: point.x, y: point.y, width: 0, height: 0 },
        clearAnnotations: true
      })
      dispatch({ type: 'set-phase', phase: 'selecting' })
      return
    }

    if (!state.selection || !containsPoint(state.selection, point)) return
    if (state.tool === 'text') {
      setTextEditor({ point, value: '' })
      dispatch({ type: 'set-phase', phase: 'typing' })
      return
    }
    if (state.tool === 'pen' || state.tool === 'arrow') {
      dispatch({
        type: 'set-draft',
        draft: {
          id: crypto.randomUUID(),
          type: state.tool,
          points: [point],
          color,
          strokeWidth
        }
      })
      return
    }
    dispatch({
      type: 'set-draft',
      draft: {
        id: crypto.randomUUID(),
        type: state.tool,
        rect: { x: point.x, y: point.y, width: 0, height: 0 },
        ...(['rect', 'ellipse'].includes(state.tool) ? { color, strokeWidth } : {})
      } as NonNullable<typeof state.draft>
    })
    shapeStartRef.current = point
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (locked) return
    const point = getPoint(event)
    const interaction = pointerInteractionRef.current
    if (interaction) {
      const delta = { x: point.x - interaction.start.x, y: point.y - interaction.start.y }
      if (interaction.type === 'selecting') {
        dispatch({ type: 'set-selection', selection: normalizeRect(interaction.start, point) })
      } else if (interaction.type === 'moving-selection') {
        dispatch({ type: 'set-selection', selection: moveRect(interaction.initial, delta, viewport) })
      } else if (interaction.type === 'resizing-selection') {
        dispatch({
          type: 'set-selection',
          selection: resizeRect(interaction.initial, interaction.direction, delta, viewport)
        })
      } else {
        dispatch({
          type: 'preview-annotations',
          annotations: interaction.initialAnnotations.map((annotation) => (
            annotation.id === interaction.annotation.id ? moveAnnotation(annotation, delta) : annotation
          ))
        })
      }
      return
    }

    if (state.draft) {
      if ('points' in state.draft && state.draft.type === 'pen') {
        dispatch({
          type: 'set-draft',
          draft: { ...state.draft, points: [...state.draft.points, point] }
        })
      } else if ('points' in state.draft && state.draft.type === 'arrow') {
        dispatch({
          type: 'set-draft',
          draft: { ...state.draft, points: [state.draft.points[0], point] }
        })
      } else {
        if (!('rect' in state.draft)) return
        const start = shapeStartRef.current ?? { x: state.draft.rect.x, y: state.draft.rect.y }
        dispatch({
          type: 'set-draft',
          draft: {
            ...state.draft,
            rect: normalizeRect(start, point)
          }
        })
      }
      return
    }

    if (state.tool !== 'select') {
      setCursor('crosshair')
      return
    }
    const handle = state.selection ? getResizeHandle(point, state.selection) : null
    if (handle) {
      setCursor(getResizeCursor(handle))
    } else if (
      (state.selection && containsPoint(state.selection, point)) ||
      hitTestAnnotation(state.annotations, point)
    ) {
      setCursor('move')
    } else {
      setCursor('crosshair')
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const interaction = pointerInteractionRef.current
    pointerInteractionRef.current = null
    shapeStartRef.current = null

    if (interaction?.type === 'selecting') {
      const selection = state.selection && isUsableRect(state.selection)
        ? state.selection
        : { x: 0, y: 0, width: viewport.width, height: viewport.height }
      dispatch({ type: 'set-selection', selection })
      return
    }
    if (interaction?.type === 'moving-annotation') {
      dispatch({
        type: 'commit-annotations',
        annotations: state.annotations,
        previous: interaction.initialAnnotations
      })
      return
    }
    if (state.draft) {
      const valid = 'points' in state.draft
        ? state.draft.points.length >= 2
        : isUsableRect(state.draft.rect)
      if (valid) {
        dispatch({
          type: 'commit-annotations',
          annotations: [...state.annotations, state.draft]
        })
      } else {
        dispatch({ type: 'set-draft', draft: null })
      }
    }
  }

  const handleContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault()
    if (state.draft) {
      dispatch({ type: 'set-draft', draft: null })
    } else if (state.selection) {
      dispatch({ type: 'reset' })
    } else {
      window.electronAPI.screenCapture.cancel()
    }
  }

  if (!payload) {
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-white">正在冻结屏幕...</div>
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white" onContextMenu={handleContextMenu}>
      <canvas ref={backgroundRef} className="pointer-events-none absolute inset-0" />
      <canvas ref={annotationRef} className="pointer-events-none absolute inset-0" />
      <canvas
        ref={interactionRef}
        className="absolute inset-0"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => {
          if (state.selection && !locked) void performOutput('complete')
        }}
      />

      {locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-black/75 px-4 py-2 text-sm shadow-2xl">
          请在当前操作的显示器完成截图
        </div>
      )}

      {state.selection && !locked && (
        <>
          <div
            className="pointer-events-none absolute rounded bg-black/75 px-2 py-1 text-xs"
            style={{ left: state.selection.x, top: Math.max(8, state.selection.y - 30) }}
          >
            {Math.round(state.selection.width)} x {Math.round(state.selection.height)}
          </div>
          <div
            ref={toolbarRef}
            className="absolute flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-lg border border-white/15 bg-[#101827]/95 p-1.5 shadow-2xl backdrop-blur"
            style={{ left: toolbarPosition.x, top: toolbarPosition.y }}
          >
            {tools.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.tool}
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${
                    state.tool === item.tool ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                  onClick={() => dispatch({ type: 'set-tool', tool: item.tool })}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
            <div className="mx-1 h-6 w-px bg-white/15" />
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-8 cursor-pointer bg-transparent" title="标注颜色" />
            <input type="range" min={2} max={14} value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} className="w-20" title={`线宽 ${strokeWidth}px`} />
            <div className="mx-1 h-6 w-px bg-white/15" />
            <ToolbarButton title="撤销" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}><RotateCcw className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="重做" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })}><RotateCw className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="复制 Ctrl+C" onClick={() => void performOutput('copy')}><Clipboard className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="保存 Ctrl+S" onClick={() => void performOutput('save')}><Save className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="取消 Esc" onClick={() => window.electronAPI.screenCapture.cancel()}><X className="h-4 w-4" /></ToolbarButton>
            <button className="flex h-8 items-center gap-1 rounded-md bg-[#3f8cff] px-3 text-sm hover:bg-[#277bf5]" onClick={() => void performOutput('complete')} title="完成并复制 Enter">
              <Check className="h-4 w-4" />完成
            </button>
          </div>
        </>
      )}

      {textEditor && (
        <input
          autoFocus
          value={textEditor.value}
          onChange={(event) => setTextEditor({ ...textEditor, value: event.target.value })}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className="absolute min-w-40 rounded border border-[#3f8cff] bg-black/80 px-2 py-1 text-white outline-none"
          style={{ left: textEditor.point.x, top: textEditor.point.y }}
          placeholder="输入标注文字"
        />
      )}

      {message && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-4 py-2 text-sm shadow-xl">
          {message}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  children,
  title,
  disabled,
  onClick
}: {
  children: React.ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

function getResizeCursor(direction: ResizeDirection): string {
  if (direction === 'top' || direction === 'bottom') return 'ns-resize'
  if (direction === 'left' || direction === 'right') return 'ew-resize'
  if (direction === 'top-left' || direction === 'bottom-right') return 'nwse-resize'
  return 'nesw-resize'
}
