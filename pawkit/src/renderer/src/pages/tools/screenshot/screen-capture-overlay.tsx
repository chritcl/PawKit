import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Brush,
  Check,
  Circle,
  Clipboard,
  Grid3X3,
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
import {
  hitTestAnnotation,
  hitTestAnnotationResizeHandle,
  hitTestArrowEndpoint,
  moveAnnotation,
  resizeAnnotation,
  dragArrowEndpoint
} from './engine/annotations'
import {
  constrainSquare,
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
  MosaicStyle,
  ResizeDirection,
  StepStyle,
  ToolStyleMap
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
  | {
    type: 'resizing-annotation'
    start: CapturePoint
    annotation: CaptureAnnotation
    direction: ResizeDirection
    initialAnnotations: CaptureAnnotation[]
  }
  | {
    type: 'dragging-endpoint'
    start: CapturePoint
    annotation: CaptureAnnotation
    endpointIndex: number
    initialAnnotations: CaptureAnnotation[]
  }

interface TextEditorState {
  point: CapturePoint
  value: string
  editingId?: string
}

type MosaicSubMode = 'paint' | 'area'

const tools: Array<{ tool: CaptureTool; label: string; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: '选择', icon: MousePointer2 },
  { tool: 'rect', label: '矩形', icon: Square },
  { tool: 'ellipse', label: '椭圆', icon: Circle },
  { tool: 'arrow', label: '箭头', icon: ArrowUpRight },
  { tool: 'pen', label: '画笔', icon: Brush },
  { tool: 'text', label: '文字', icon: Type },
  { tool: 'mosaic', label: '马赛克', icon: Highlighter },
  { tool: 'step', label: '序号', icon: Grid3X3 }
]

export function ScreenCaptureOverlay(): JSX.Element {
  const [payload, setPayload] = useState<ScreenCaptureDisplayPayload | null>(null)
  const [sessionState, setSessionState] = useState<ScreenCaptureSessionState | null>(null)
  const [state, dispatch] = useReducer(captureEditorReducer, undefined, createInitialCaptureEditorState)
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)
  const [toolbarSize, setToolbarSize] = useState<CaptureSize>({ width: 690, height: 46 })
  const [message, setMessage] = useState<string | null>(null)
  const [cursor, setCursor] = useState('crosshair')
  const [mosaicSubMode, setMosaicSubMode] = useState<MosaicSubMode>('paint')
  const [brushPoint, setBrushPoint] = useState<{ x: number; y: number } | null>(null)
  const backgroundRef = useRef<HTMLCanvasElement>(null)
  const annotationRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<HTMLCanvasElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pointerInteractionRef = useRef<PointerInteraction | null>(null)
  const shapeStartRef = useRef<CapturePoint | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const mosaicPaintingRef = useRef(false)

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
    const brush = state.tool === 'mosaic' && mosaicSubMode === 'paint' && brushPoint
      ? { point: brushPoint, size: (state.toolStyles.mosaic as MosaicStyle).brushSize }
      : null
    drawInteractionLayer(
      interactionRef.current,
      state.selection,
      selectedAnnotation,
      viewport,
      Boolean(locked),
      brush
    )
  }, [locked, selectedAnnotation, state.selection, viewport, brushPoint, state.tool, mosaicSubMode, state.toolStyles])

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
      const style = state.toolStyles.text
      if (textEditor.editingId) {
        dispatch({
          type: 'commit-annotations',
          annotations: state.annotations.map((a) =>
            a.id === textEditor.editingId && a.type === 'text'
              ? { ...a, text }
              : a
          ),
          previous: state.annotations
        })
      } else {
        dispatch({
          type: 'commit-annotations',
          annotations: [
            ...state.annotations,
            {
              id: crypto.randomUUID(),
              type: 'text',
              point: textEditor.point,
              text,
              color: style.color,
              fontSize: style.fontSize,
              bold: style.bold,
              bgColor: style.bgColor,
              align: style.align
            }
          ],
          selectedId: null
        })
      }
    } else if (textEditor?.editingId) {
      setTextEditor(null)
    }
    setTextEditor(null)
    dispatch({ type: 'set-phase', phase: 'editing' })
  }, [state.annotations, state.toolStyles.text, textEditor])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): CapturePoint => ({
    x: event.clientX,
    y: event.clientY
  })

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0 || locked) return
    window.electronAPI.screenCapture.claim()
    const point = getPoint(event)

    // === 通用标注交互（所有工具） ===
    if (selectedAnnotation) {
      const annResizeHandle = hitTestAnnotationResizeHandle(selectedAnnotation, point)
      if (annResizeHandle) {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerInteractionRef.current = {
          type: 'resizing-annotation',
          start: point,
          annotation: selectedAnnotation,
          direction: annResizeHandle,
          initialAnnotations: state.annotations
        }
        return
      }
      if (selectedAnnotation.type === 'arrow') {
        const epIndex = hitTestArrowEndpoint(selectedAnnotation, point)
        if (epIndex !== null) {
          event.currentTarget.setPointerCapture(event.pointerId)
          pointerInteractionRef.current = {
            type: 'dragging-endpoint',
            start: point,
            annotation: selectedAnnotation,
            endpointIndex: epIndex,
            initialAnnotations: state.annotations
          }
          return
        }
      }
    }

    // 点击到已有标注 → 选中并开始拖动（所有工具通用）
    const hitAnnotation = state.selection
      ? hitTestAnnotation(state.annotations, point)
      : null
    if (hitAnnotation) {
      event.currentTarget.setPointerCapture(event.pointerId)
      dispatch({ type: 'set-selected', id: hitAnnotation.id })
      pointerInteractionRef.current = {
        type: 'moving-annotation',
        start: point,
        annotation: hitAnnotation,
        initialAnnotations: state.annotations
      }
      return
    }

    // === select 工具特有逻辑 ===
    if (state.tool === 'select') {
      const handle = state.selection ? getResizeHandle(point, state.selection) : null
      if (state.selection && handle) {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerInteractionRef.current = {
          type: 'resizing-selection',
          start: point,
          initial: state.selection,
          direction: handle
        }
        return
      }

      if (state.selection && containsPoint(state.selection, point)) {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerInteractionRef.current = {
          type: 'moving-selection',
          start: point,
          initial: state.selection
        }
        dispatch({ type: 'set-selected', id: null })
        return
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      pointerInteractionRef.current = { type: 'selecting', start: point }
      dispatch({
        type: 'set-selection',
        selection: { x: point.x, y: point.y, width: 0, height: 0 },
        clearAnnotations: true
      })
      dispatch({ type: 'set-phase', phase: 'selecting' })
      return
    }

    // === 非 select 工具：必须在选区内 ===
    if (!state.selection || !containsPoint(state.selection, point)) return

    // === 工具特定创建 ===
    if (state.tool === 'text') {
      const existingText = hitTestAnnotation(state.annotations, point)
      if (existingText && existingText.type === 'text') {
        setTextEditor({ point: existingText.point, value: existingText.text, editingId: existingText.id })
        dispatch({ type: 'set-phase', phase: 'typing' })
        return
      }
      setTextEditor({ point, value: '' })
      dispatch({ type: 'set-phase', phase: 'typing' })
      return
    }

    if (state.tool === 'step') {
      const stepStyle = state.toolStyles.step as StepStyle
      dispatch({
        type: 'commit-annotations',
        annotations: [
          ...state.annotations,
          {
            id: crypto.randomUUID(),
            type: 'step',
            point,
            number: state.stepCounter,
            color: stepStyle.color,
            bgColor: stepStyle.bgColor,
            size: stepStyle.size
          }
        ],
        selectedId: null
      })
      dispatch({ type: 'increment-step' })
      return
    }

    // 以下工具需要拖动，设置指针捕获
    event.currentTarget.setPointerCapture(event.pointerId)

    if (state.tool === 'mosaic' && mosaicSubMode === 'paint') {
      const mosaicStyle = state.toolStyles.mosaic as MosaicStyle
      dispatch({
        type: 'set-draft',
        draft: {
          id: crypto.randomUUID(),
          type: 'mosaic-paint',
          points: [point],
          brushSize: mosaicStyle.brushSize,
          strength: mosaicStyle.strength
        }
      })
      mosaicPaintingRef.current = true
      return
    }

    if (state.tool === 'pen' || state.tool === 'arrow') {
      const toolStyle = state.toolStyles[state.tool]
      dispatch({
        type: 'set-draft',
        draft: {
          id: crypto.randomUUID(),
          type: state.tool,
          points: [point],
          color: toolStyle.color,
          strokeWidth: toolStyle.strokeWidth,
          ...(state.tool === 'arrow' ? { arrowSize: (toolStyle as { arrowSize?: number }).arrowSize } : {})
        }
      })
      return
    }

    const toolStyle = state.toolStyles[state.tool as keyof ToolStyleMap]
    if (state.tool === 'mosaic') {
      dispatch({
        type: 'set-draft',
        draft: {
          id: crypto.randomUUID(),
          type: 'mosaic',
          rect: { x: point.x, y: point.y, width: 0, height: 0 }
        }
      })
    } else {
      dispatch({
        type: 'set-draft',
        draft: {
          id: crypto.randomUUID(),
          type: state.tool,
          rect: { x: point.x, y: point.y, width: 0, height: 0 },
          ...(['rect', 'ellipse'].includes(state.tool)
            ? {
              color: (toolStyle as { color: string }).color,
              strokeWidth: (toolStyle as { strokeWidth: number }).strokeWidth,
              dashed: (toolStyle as { dashed?: boolean }).dashed ?? false,
              fillColor: (toolStyle as { fillColor?: string | null }).fillColor ?? null
            }
            : {})
        } as NonNullable<typeof state.draft>
      })
    }
    shapeStartRef.current = point
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (locked) return
    const point = getPoint(event)
    const interaction = pointerInteractionRef.current

    if (state.tool === 'mosaic' && mosaicSubMode === 'paint') {
      setBrushPoint(point)
    }

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
      } else if (interaction.type === 'moving-annotation') {
        dispatch({
          type: 'preview-annotations',
          annotations: interaction.initialAnnotations.map((annotation) =>
            annotation.id === interaction.annotation.id ? moveAnnotation(annotation, delta) : annotation
          )
        })
      } else if (interaction.type === 'resizing-annotation') {
        dispatch({
          type: 'preview-annotations',
          annotations: interaction.initialAnnotations.map((annotation) =>
            annotation.id === interaction.annotation.id
              ? resizeAnnotation(annotation, interaction.direction, delta)
              : annotation
          )
        })
      } else if (interaction.type === 'dragging-endpoint') {
        dispatch({
          type: 'preview-annotations',
          annotations: interaction.initialAnnotations.map((annotation) =>
            annotation.id === interaction.annotation.id
              ? dragArrowEndpoint(annotation, interaction.endpointIndex, point)
              : annotation
          )
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
      } else if ('points' in state.draft && state.draft.type === 'mosaic-paint') {
        dispatch({
          type: 'set-draft',
          draft: { ...state.draft, points: [...state.draft.points, point] }
        })
      } else {
        if (!('rect' in state.draft)) return
        const start = shapeStartRef.current ?? { x: state.draft.rect.x, y: state.draft.rect.y }
        const newRect = event.shiftKey
          ? constrainSquare(start, point)
          : normalizeRect(start, point)
        dispatch({
          type: 'set-draft',
          draft: {
            ...state.draft,
            rect: newRect
          }
        })
      }
      return
    }

    if (selectedAnnotation) {
      const annHandle = hitTestAnnotationResizeHandle(selectedAnnotation, point)
      if (annHandle) {
        setCursor(getResizeCursor(annHandle))
        return
      }
      if (selectedAnnotation.type === 'arrow' && hitTestArrowEndpoint(selectedAnnotation, point)) {
        setCursor('move')
        return
      }
    }

    if (hitTestAnnotation(state.annotations, point)) {
      setCursor('move')
      return
    }

    if (state.tool !== 'select') {
      setCursor('crosshair')
      return
    }

    const handle = state.selection ? getResizeHandle(point, state.selection) : null
    if (handle) {
      setCursor(getResizeCursor(handle))
    } else if (state.selection && containsPoint(state.selection, point)) {
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
    mosaicPaintingRef.current = false

    if (interaction?.type === 'selecting') {
      const selection = state.selection && isUsableRect(state.selection)
        ? state.selection
        : { x: 0, y: 0, width: viewport.width, height: viewport.height }
      dispatch({ type: 'set-selection', selection })
      return
    }
    if (interaction?.type === 'moving-annotation' || interaction?.type === 'resizing-annotation' || interaction?.type === 'dragging-endpoint') {
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
        const newId = state.draft.id
        dispatch({
          type: 'commit-annotations',
          annotations: [...state.annotations, state.draft],
          selectedId: newId
        })
      } else {
        dispatch({ type: 'set-draft', draft: null })
      }
    }
  }

  const handleContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault()
    if (textEditor) {
      setTextEditor(null)
      dispatch({ type: 'set-phase', phase: 'editing' })
      return
    }
    if (state.draft) {
      dispatch({ type: 'set-draft', draft: null })
    } else if (state.selection) {
      dispatch({ type: 'reset' })
    } else {
      window.electronAPI.screenCapture.cancel()
    }
  }

  const getStyleEditor = (): JSX.Element | null => {
    if (!state.selection) return null
    if (textEditor) return null

    const tool = selectedAnnotation
      ? selectedAnnotation.type === 'mosaic-paint' ? 'mosaic' : selectedAnnotation.type === 'step' ? 'step' : selectedAnnotation.type
      : state.tool
    if (tool === 'select') return null

    if (tool === 'mosaic') {
      const style = state.toolStyles.mosaic as MosaicStyle
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">模式</label>
          <button
            className={`rounded px-2 py-0.5 text-xs ${mosaicSubMode === 'paint' ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => setMosaicSubMode('paint')}
          >涂抹</button>
          <button
            className={`rounded px-2 py-0.5 text-xs ${mosaicSubMode === 'area' ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => setMosaicSubMode('area')}
          >区域</button>
          <label className="text-xs text-slate-400">笔刷</label>
          <input type="range" min={8} max={60} value={style.brushSize}
            onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'mosaic', patch: { brushSize: Number(e.target.value) } })}
            className="w-16" title={`笔刷 ${style.brushSize}px`} />
          <label className="text-xs text-slate-400">强度</label>
          <input type="range" min={4} max={24} value={style.strength}
            onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'mosaic', patch: { strength: Number(e.target.value) } })}
            className="w-16" title={`强度 ${style.strength}`} />
        </div>
      )
    }

    if (tool === 'text') {
      const style = state.toolStyles.text
      const ann = selectedAnnotation?.type === 'text' ? selectedAnnotation : null
      const color = ann?.color ?? style.color
      const fontSize = ann?.fontSize ?? style.fontSize
      const bold = ann?.bold ?? style.bold
      const bgColor = ann?.bgColor ?? style.bgColor
      const align = ann?.align ?? style.align
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'text', patch })
        }
      }
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => updateStyle({ color: e.target.value })} className="h-7 w-8 cursor-pointer bg-transparent" title="文字颜色" />
          <input type="range" min={12} max={48} value={fontSize} onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })} className="w-16" title={`字号 ${fontSize}px`} />
          <button className={`rounded px-2 py-0.5 text-xs ${bold ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => updateStyle({ bold: !bold })}>粗体</button>
          <button className={`rounded px-2 py-0.5 text-xs ${bgColor ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => updateStyle({ bgColor: bgColor ? null : 'rgba(0,0,0,0.5)' })}>背景</button>
          <select value={align} onChange={(e) => updateStyle({ align: e.target.value })}
            className="rounded bg-transparent text-xs text-slate-300">
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </div>
      )
    }

    if (tool === 'step') {
      const style = state.toolStyles.step as StepStyle
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={style.bgColor} onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'step', patch: { bgColor: e.target.value } })} className="h-7 w-8 cursor-pointer bg-transparent" title="序号底色" />
          <input type="range" min={20} max={48} value={style.size} onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'step', patch: { size: Number(e.target.value) } })} className="w-16" title={`大小 ${style.size}px`} />
          <button className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10"
            onClick={() => dispatch({ type: 'reset-step-counter' })}>重置序号</button>
        </div>
      )
    }

    if (tool === 'rect' || tool === 'ellipse') {
      const style = state.toolStyles[tool]
      const ann = selectedAnnotation?.type === tool ? selectedAnnotation : null
      const color = ann?.color ?? style.color
      const strokeWidth = ann?.strokeWidth ?? style.strokeWidth
      const dashed = ann?.dashed ?? style.dashed
      const fillColor = ann?.fillColor ?? style.fillColor
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool, patch })
        }
      }
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => updateStyle({ color: e.target.value })} className="h-7 w-8 cursor-pointer bg-transparent" title="描边颜色" />
          <input type="range" min={2} max={14} value={strokeWidth} onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })} className="w-16" title={`线宽 ${strokeWidth}px`} />
          <button className={`rounded px-2 py-0.5 text-xs ${dashed ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => updateStyle({ dashed: !dashed })}>虚线</button>
          <button className={`rounded px-2 py-0.5 text-xs ${fillColor ? 'bg-[#3f8cff] text-white' : 'text-slate-300 hover:bg-white/10'}`}
            onClick={() => updateStyle({ fillColor: fillColor ? null : 'rgba(255,77,79,0.15)' })}>填充</button>
        </div>
      )
    }

    if (tool === 'arrow') {
      const style = state.toolStyles.arrow
      const ann = selectedAnnotation?.type === 'arrow' ? selectedAnnotation : null
      const color = ann?.color ?? style.color
      const strokeWidth = ann?.strokeWidth ?? style.strokeWidth
      const arrowSize = ann?.arrowSize ?? style.arrowSize
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'arrow', patch })
        }
      }
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => updateStyle({ color: e.target.value })} className="h-7 w-8 cursor-pointer bg-transparent" title="箭头颜色" />
          <input type="range" min={2} max={14} value={strokeWidth} onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })} className="w-16" title={`线宽 ${strokeWidth}px`} />
          <input type="range" min={8} max={32} value={arrowSize} onChange={(e) => updateStyle({ arrowSize: Number(e.target.value) })} className="w-16" title={`箭头 ${arrowSize}px`} />
        </div>
      )
    }

    if (tool === 'pen') {
      const style = state.toolStyles.pen
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={style.color} onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'pen', patch: { color: e.target.value } })} className="h-7 w-8 cursor-pointer bg-transparent" title="画笔颜色" />
          <input type="range" min={2} max={14} value={style.strokeWidth} onChange={(e) => dispatch({ type: 'set-tool-style', tool: 'pen', patch: { strokeWidth: Number(e.target.value) } })} className="w-16" title={`线宽 ${style.strokeWidth}px`} />
        </div>
      )
    }

    return null
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (textEditor) {
        if (event.key === 'Escape') {
          setTextEditor(null)
          dispatch({ type: 'set-phase', phase: 'editing' })
        }
        return
      }
      if (event.key === 'Escape') {
        if (state.selectedId) {
          dispatch({ type: 'set-selected', id: null })
        } else {
          window.electronAPI.screenCapture.cancel()
        }
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
      } else if (event.key === 'Enter' && state.selection && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        void performOutput('complete')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [performOutput, state.annotations, state.selectedId, state.selection, textEditor])

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
            <ToolbarButton title="撤销 Ctrl+Z" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}><RotateCcw className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="重做 Ctrl+Y" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })}><RotateCw className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="复制 Ctrl+C" onClick={() => void performOutput('copy')}><Clipboard className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="保存 Ctrl+S" onClick={() => void performOutput('save')}><Save className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="取消 Esc" onClick={() => window.electronAPI.screenCapture.cancel()}><X className="h-4 w-4" /></ToolbarButton>
            <button className="flex h-8 items-center gap-1 rounded-md bg-[#3f8cff] px-3 text-sm hover:bg-[#277bf5]" onClick={() => void performOutput('complete')} title="复制并关闭 Enter">
              <Check className="h-4 w-4" />复制并关闭
            </button>
          </div>
          {getStyleEditor() && (
            <div
              className="absolute flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-lg border border-white/15 bg-[#101827]/95 px-2 py-1.5 shadow-2xl backdrop-blur"
              style={{ left: toolbarPosition.x, top: toolbarPosition.y + toolbarSize.height + 4 }}
            >
              {getStyleEditor()}
            </div>
          )}
        </>
      )}

      {textEditor && (
        <textarea
          autoFocus
          value={textEditor.value}
          onChange={(event) => setTextEditor({ ...textEditor, value: event.target.value })}
          onBlur={commitText}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setTextEditor(null)
              dispatch({ type: 'set-phase', phase: 'editing' })
            }
            event.stopPropagation()
          }}
          className="absolute z-50 min-w-40 min-h-[2.5rem] rounded border border-[#3f8cff] bg-black/80 px-2 py-1 text-white outline-none resize-none"
          style={{
            left: textEditor.point.x,
            top: textEditor.point.y,
            fontSize: state.toolStyles.text.fontSize,
            fontWeight: state.toolStyles.text.bold ? 700 : 400,
            color: state.toolStyles.text.color,
            textAlign: state.toolStyles.text.align
          }}
          placeholder="输入标注文字（Shift+Enter 换行）"
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
