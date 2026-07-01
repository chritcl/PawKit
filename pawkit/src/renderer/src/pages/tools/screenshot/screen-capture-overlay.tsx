import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Clipboard,
  Image as ImageIcon,
  PaintBucket,
  Palette,
  Pin,
  QrCode,
  RotateCcw,
  RotateCw,
  Save,
  ScanText,
  SquareDashed,
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
  createTextAnnotation,
  getTextRect,
  getTextStyleFromAnnotation,
  hitTestAnnotation,
  moveAnnotation
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
  StyleActionButton,
  StyleColorControl,
  StyleNumberStepper,
  StyleSegmentedControl,
  StyleToggleButton
} from './screenshot-style-controls'
import {
  captureEditorReducer,
  createInitialCaptureEditorState
} from './engine/reducer'
import type {
  CaptureAnnotation,
  CapturePoint,
  CaptureRect,
  CaptureSize,
  MosaicStyle,
  ResizeDirection,
  StepStyle,
  TextAnnotation,
  ToolStyleMap
} from './engine/types'
import {
  annotationTools,
  getStyleToolbarPosition,
  type MosaicSubMode,
  type TextEditorState
} from './overlay-editor-shared'

type PointerInteraction =
  | { type: 'selecting'; start: CapturePoint }
  | { type: 'moving-selection'; start: CapturePoint; initial: CaptureRect }
  | { type: 'resizing-selection'; start: CapturePoint; initial: CaptureRect; direction: ResizeDirection }
  | { type: 'text-input'; start: CapturePoint; annotation?: TextAnnotation }
  | {
    type: 'moving-annotation'
    start: CapturePoint
    annotation: CaptureAnnotation
    initialAnnotations: CaptureAnnotation[]
    moved: boolean
  }

export function ScreenCaptureOverlay(): JSX.Element {
  const [payload, setPayload] = useState<ScreenCaptureDisplayPayload | null>(null)
  const [sessionState, setSessionState] = useState<ScreenCaptureSessionState | null>(null)
  const [state, dispatch] = useReducer(captureEditorReducer, undefined, createInitialCaptureEditorState)
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)
  const [toolbarSize, setToolbarSize] = useState<CaptureSize>({ width: 690, height: 46 })
  const [styleToolbarSize, setStyleToolbarSize] = useState<CaptureSize>({ width: 420, height: 44 })
  const [styleToolbarNode, setStyleToolbarNode] = useState<HTMLDivElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cursor, setCursor] = useState('crosshair')
  const [mosaicSubMode, setMosaicSubMode] = useState<MosaicSubMode>('paint')
  const [brushPoint, setBrushPoint] = useState<{ x: number; y: number } | null>(null)
  const backgroundRef = useRef<HTMLCanvasElement>(null)
  const annotationRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<HTMLCanvasElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pointerInteractionRef = useRef<PointerInteraction | null>(null)
  const shapeStartRef = useRef<CapturePoint | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const mosaicPaintingRef = useRef(false)
  const textComposingRef = useRef(false)
  const skipTextCommitRef = useRef(false)

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
  const hasTextEditor = Boolean(textEditor)
  const shouldSelectTextEditor = Boolean(textEditor?.editingId)
  const textEditorFocusX = textEditor?.rect.x
  const textEditorFocusY = textEditor?.rect.y

  const toolbarPosition = useMemo(
    () => state.selection
      ? getToolbarPosition(state.selection, toolbarSize, viewport)
      : { x: 8, y: 8 },
    [state.selection, toolbarSize, viewport]
  )
  const styleToolbarPosition = useMemo(
    () => state.selection
      ? getStyleToolbarPosition(toolbarPosition, toolbarSize, styleToolbarSize, viewport)
      : { x: 8, y: toolbarSize.height + 12 },
    [state.selection, styleToolbarSize, toolbarPosition, toolbarSize, viewport]
  )
  const setStyleToolbarRef = useCallback((node: HTMLDivElement | null): void => {
    setStyleToolbarNode(node)
  }, [])

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

  useEffect(() => {
    if (!styleToolbarNode) return
    const update = (): void => setStyleToolbarSize({
      width: styleToolbarNode.offsetWidth,
      height: styleToolbarNode.offsetHeight
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(styleToolbarNode)
    return () => observer.disconnect()
  }, [styleToolbarNode])

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

  const pinCurrent = useCallback(async (): Promise<void> => {
    if (!payload || !state.selection) return
    const exported = exportCurrent()
    if (!exported) return
    try {
      const response = await window.electronAPI.pinned.create({
        dataUrl: exported.dataUrl,
        width: exported.width,
        height: exported.height,
        displayId: payload.displayId,
        bounds: {
          x: payload.bounds.x + state.selection.x,
          y: payload.bounds.y + state.selection.y,
          width: state.selection.width,
          height: state.selection.height
        }
      })
      if (response.status === 'pinned') {
        window.electronAPI.screenCapture.cancel()
      } else {
        setMessage(response.message)
      }
    } catch {
      setMessage('创建置顶截图失败')
    }
  }, [exportCurrent, payload, state.selection])

  const sendCurrentToImageTool = useCallback(async (): Promise<void> => {
    const exported = exportCurrent()
    if (!exported) return
    try {
      const source = await window.electronAPI.imageTool.sendToTool({
        dataUrl: exported.dataUrl,
        name: `screenshot-${Date.now()}.png`,
        sourceKind: 'screenshot'
      })
      setMessage(source ? '已发送到图片处理' : '发送到图片处理失败')
    } catch {
      setMessage('发送到图片处理失败')
    }
  }, [exportCurrent])

  const sendCurrentToOcrTool = useCallback(async (): Promise<void> => {
    const exported = exportCurrent()
    if (!exported) return
    try {
      const source = await window.electronAPI.ocr.sendToTool({
        dataUrl: exported.dataUrl,
        name: `screenshot-${Date.now()}.png`,
        sourceKind: 'screenshot',
        mode: 'auto'
      })
      if (source) {
        window.electronAPI.screenCapture.cancel()
      } else {
        setMessage('发送到 OCR 识别失败')
      }
    } catch {
      setMessage('发送到 OCR 识别失败')
    }
  }, [exportCurrent])

  const detectCurrentQrCode = useCallback(async (): Promise<void> => {
    const exported = exportCurrent()
    if (!exported) return
    try {
      const result = await window.electronAPI.ocr.detectQr({
        source: { kind: 'screenshot', dataUrl: exported.dataUrl },
        mode: 'auto'
      })
      const text = result.qrCodes?.map((item) => item.text).join('\n') ?? ''
      if (text) {
        await window.electronAPI.ocr.copyText(text)
      }
      setMessage(result.success ? '二维码内容已复制' : result.message)
    } catch {
      setMessage('二维码识别失败')
    }
  }, [exportCurrent])

  const extractCurrentColors = useCallback(async (): Promise<void> => {
    const exported = exportCurrent()
    if (!exported) return
    try {
      const result = await window.electronAPI.ocr.extractColors({
        source: { kind: 'screenshot', dataUrl: exported.dataUrl },
        mode: 'auto'
      })
      const text = result.colors?.map((color) => color.hex).join('\n') ?? ''
      if (text) {
        await window.electronAPI.ocr.copyText(text)
      }
      setMessage(result.success ? '颜色已复制' : result.message)
    } catch {
      setMessage('颜色提取失败')
    }
  }, [exportCurrent])

  const beginTextInputAtPoint = useCallback((point: CapturePoint, annotation?: TextAnnotation): void => {
    const style = annotation
      ? getTextStyleFromAnnotation(annotation)
      : state.toolStyles.text
    const rect = annotation
      ? annotation.rect
      : getTextRect(point, '', style)
    skipTextCommitRef.current = false
    textComposingRef.current = false
    setMessage(null)
    setTextEditor({
      rect,
      value: annotation?.text ?? '',
      style,
      editingId: annotation?.id
    })
    dispatch({ type: 'set-selected', id: annotation?.id ?? null })
    dispatch({ type: 'set-phase', phase: 'typing' })
  }, [state.toolStyles.text])

  const cancelTextInput = useCallback((): void => {
    skipTextCommitRef.current = true
    textComposingRef.current = false
    setTextEditor(null)
    dispatch({ type: 'set-phase', phase: 'editing' })
  }, [])

  const updateTextEditorStyle = useCallback((patch: Record<string, unknown>): void => {
    setTextEditor((current) => {
      if (!current) return current
      const style = {
        ...current.style,
        ...patch
      } as TextEditorState['style']
      return {
        ...current,
        style,
        rect: getTextRect({ x: current.rect.x, y: current.rect.y }, current.value, style)
      }
    })
  }, [])

  useEffect(() => {
    if (!hasTextEditor) return
    const frame = window.requestAnimationFrame(() => {
      const textarea = textAreaRef.current
      if (!textarea) return
      textarea.focus()
      if (shouldSelectTextEditor) {
        textarea.setSelectionRange(0, textarea.value.length)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hasTextEditor, shouldSelectTextEditor, textEditorFocusX, textEditorFocusY])

  const commitText = useCallback((): void => {
    if (skipTextCommitRef.current) {
      skipTextCommitRef.current = false
      return
    }
    if (!textEditor) return
    const annotation = createTextAnnotation({
      id: textEditor.editingId ?? crypto.randomUUID(),
      point: { x: textEditor.rect.x, y: textEditor.rect.y },
      value: textEditor.value,
      style: textEditor.style
    })
    if (annotation) {
      const annotations = textEditor.editingId
        ? state.annotations.map((item) => item.id === textEditor.editingId ? annotation : item)
        : [...state.annotations, annotation]
      dispatch({
        type: 'commit-annotations',
        annotations,
        previous: state.annotations,
        selectedId: annotation.id
      })
    } else if (textEditor.editingId) {
      dispatch({
        type: 'commit-annotations',
        annotations: state.annotations.filter((item) => item.id !== textEditor.editingId),
        previous: state.annotations
      })
    } else {
      dispatch({ type: 'set-phase', phase: 'editing' })
    }
    textComposingRef.current = false
    setTextEditor(null)
  }, [state.annotations, textEditor])

  const handleTextEditorBlur = useCallback((event: React.FocusEvent<HTMLTextAreaElement>): void => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && styleToolbarNode?.contains(nextTarget)) return
    commitText()
  }, [commitText, styleToolbarNode])

  const handleStyleToolbarBlur = useCallback((event: React.FocusEvent<HTMLDivElement>): void => {
    if (!textEditor) return
    const nextTarget = event.relatedTarget
    if (
      nextTarget instanceof Node &&
      (styleToolbarNode?.contains(nextTarget) || textAreaRef.current?.contains(nextTarget))
    ) return
    commitText()
  }, [commitText, styleToolbarNode, textEditor])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): CapturePoint => ({
    x: event.clientX,
    y: event.clientY
  })

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return
    if (locked) {
      if (state.tool === 'text') setMessage('请在当前操作的显示器添加文字')
      return
    }
    window.electronAPI.screenCapture.claim()
    const point = getPoint(event)
    const hitAnnotation = state.selection && containsPoint(state.selection, point)
      ? hitTestAnnotation(state.annotations, point)
      : null

    if (state.tool === 'text') {
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerInteractionRef.current = {
        type: 'text-input',
        start: point,
        annotation: hitAnnotation?.type === 'text' ? hitAnnotation : undefined
      }
      return
    }

    if (hitAnnotation && state.tool === 'select') {
      event.currentTarget.setPointerCapture(event.pointerId)
      dispatch({ type: 'set-selected', id: hitAnnotation.id })
      pointerInteractionRef.current = {
        type: 'moving-annotation',
        start: point,
        annotation: hitAnnotation,
        initialAnnotations: state.annotations,
        moved: false
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
        ]
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
        if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) {
          interaction.moved = true
          dispatch({
            type: 'preview-annotations',
            annotations: interaction.initialAnnotations.map((annotation) =>
              annotation.id === interaction.annotation.id ? moveAnnotation(annotation, delta) : annotation
            )
          })
        }
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

    if (state.tool === 'text' && hitTestAnnotation(state.annotations, point)?.type === 'text') {
      setCursor('text')
      return
    }

    if (state.tool !== 'select') {
      setCursor('crosshair')
      return
    }

    const handle = state.selection ? getResizeHandle(point, state.selection) : null
    if (handle) {
      setCursor(getResizeCursor(handle))
    } else if (hitTestAnnotation(state.annotations, point)) {
      setCursor('move')
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

    if (interaction?.type === 'text-input') {
      if (!state.selection) {
        setMessage('请先框选截图区域')
        return
      }
      if (!containsPoint(state.selection, interaction.start)) {
        setMessage('请在选区内添加文字')
        return
      }
      beginTextInputAtPoint(interaction.start, interaction.annotation)
      return
    }

    if (interaction?.type === 'selecting') {
      const selection = state.selection && isUsableRect(state.selection)
        ? state.selection
        : { x: 0, y: 0, width: viewport.width, height: viewport.height }
      dispatch({ type: 'set-selection', selection })
      return
    }
    if (interaction?.type === 'moving-annotation') {
      if (interaction.moved) {
        dispatch({
          type: 'commit-annotations',
          annotations: state.annotations,
          previous: interaction.initialAnnotations,
          selectedId: interaction.annotation.id
        })
      } else {
        dispatch({ type: 'set-selected', id: interaction.annotation.id })
      }
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

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (locked || !state.selection || textEditor) return
    const point = { x: event.clientX, y: event.clientY }
    const hitAnnotation = hitTestAnnotation(state.annotations, point)
    if (hitAnnotation?.type !== 'text') return
    event.preventDefault()
    beginTextInputAtPoint(point, hitAnnotation)
  }

  const handleContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault()
    if (textEditor) {
      cancelTextInput()
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

    const tool = textEditor
      ? 'text'
      : selectedAnnotation
      ? selectedAnnotation.type === 'mosaic-paint' ? 'mosaic' : selectedAnnotation.type === 'step' ? 'step' : selectedAnnotation.type
      : state.tool
    if (tool === 'select') return null

    if (tool === 'mosaic') {
      const style = state.toolStyles.mosaic as MosaicStyle
      const ann = selectedAnnotation?.type === 'mosaic-paint' ? selectedAnnotation : null
      const brushSize = ann?.brushSize ?? style.brushSize
      const strength = ann?.strength ?? style.strength
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'mosaic', patch })
        }
      }
      return (
        <div className="screenshot-style-row">
          <StyleSegmentedControl
            label="模式"
            value={mosaicSubMode}
            options={[
              { value: 'paint', label: '涂抹' },
              { value: 'area', label: '区域' }
            ]}
            onChange={(value) => setMosaicSubMode(value as MosaicSubMode)}
          />
          <StyleNumberStepper
            label="笔刷"
            value={brushSize}
            min={8}
            max={60}
            unit="px"
            onChange={(value) => updateStyle({ brushSize: value })}
          />
          <StyleNumberStepper
            label="强度"
            value={strength}
            min={4}
            max={24}
            onChange={(value) => updateStyle({ strength: value })}
          />
        </div>
      )
    }

    if (tool === 'text') {
      const style = state.toolStyles.text
      const ann = selectedAnnotation?.type === 'text' ? selectedAnnotation : null
      const color = textEditor?.style.color ?? ann?.color ?? style.color
      const fontSize = textEditor?.style.fontSize ?? ann?.fontSize ?? style.fontSize
      const bold = textEditor?.style.bold ?? ann?.bold ?? style.bold
      const bgColor = textEditor?.style.bgColor ?? ann?.bgColor ?? style.bgColor
      const align = textEditor?.style.align ?? ann?.align ?? style.align
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (textEditor) {
          updateTextEditorStyle(patch)
        } else if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'text', patch })
        }
      }
      return (
        <div className="screenshot-style-row">
          <StyleColorControl label="文字" value={color} onChange={(value) => updateStyle({ color: value })} />
          <StyleNumberStepper
            label="字号"
            value={fontSize}
            min={12}
            max={48}
            unit="px"
            onChange={(value) => updateStyle({ fontSize: value })}
          />
          <div className="screenshot-style-group" role="group" aria-label="文字样式">
            <StyleToggleButton label="粗体" active={bold} onClick={() => updateStyle({ bold: !bold })}>
              <Bold className="h-4 w-4" />
            </StyleToggleButton>
            <StyleToggleButton label="背景" active={Boolean(bgColor)} onClick={() => updateStyle({ bgColor: bgColor ? null : 'rgba(0,0,0,0.5)' })}>
              <PaintBucket className="h-4 w-4" />
            </StyleToggleButton>
          </div>
          <div className="screenshot-style-group" role="group" aria-label="文字对齐">
            <StyleToggleButton label="左对齐" active={align === 'left'} showLabel={false} onClick={() => updateStyle({ align: 'left' })}>
              <AlignLeft className="h-4 w-4" />
            </StyleToggleButton>
            <StyleToggleButton label="居中对齐" active={align === 'center'} showLabel={false} onClick={() => updateStyle({ align: 'center' })}>
              <AlignCenter className="h-4 w-4" />
            </StyleToggleButton>
            <StyleToggleButton label="右对齐" active={align === 'right'} showLabel={false} onClick={() => updateStyle({ align: 'right' })}>
              <AlignRight className="h-4 w-4" />
            </StyleToggleButton>
          </div>
        </div>
      )
    }

    if (tool === 'step') {
      const style = state.toolStyles.step as StepStyle
      const ann = selectedAnnotation?.type === 'step' ? selectedAnnotation : null
      const bgColor = ann?.bgColor ?? style.bgColor
      const size = ann?.size ?? style.size
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'step', patch })
        }
      }
      return (
        <div className="screenshot-style-row">
          <StyleColorControl label="底色" value={bgColor} onChange={(value) => updateStyle({ bgColor: value })} />
          <StyleNumberStepper
            label="大小"
            value={size}
            min={20}
            max={48}
            unit="px"
            onChange={(value) => updateStyle({ size: value })}
          />
          <StyleActionButton label="重置序号" onClick={() => dispatch({ type: 'reset-step-counter' })}>
            <RotateCcw className="h-4 w-4" />
          </StyleActionButton>
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
        <div className="screenshot-style-row">
          <StyleColorControl label="描边" value={color} onChange={(value) => updateStyle({ color: value })} />
          <StyleNumberStepper
            label="线宽"
            value={strokeWidth}
            min={2}
            max={14}
            unit="px"
            onChange={(value) => updateStyle({ strokeWidth: value })}
          />
          <div className="screenshot-style-group" role="group" aria-label="形状样式">
            <StyleToggleButton label="虚线" active={Boolean(dashed)} onClick={() => updateStyle({ dashed: !dashed })}>
              <SquareDashed className="h-4 w-4" />
            </StyleToggleButton>
            <StyleToggleButton label="填充" active={Boolean(fillColor)} onClick={() => updateStyle({ fillColor: fillColor ? null : 'rgba(255,77,79,0.15)' })}>
              <PaintBucket className="h-4 w-4" />
            </StyleToggleButton>
          </div>
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
        <div className="screenshot-style-row">
          <StyleColorControl label="颜色" value={color} onChange={(value) => updateStyle({ color: value })} />
          <StyleNumberStepper
            label="线宽"
            value={strokeWidth}
            min={2}
            max={14}
            unit="px"
            onChange={(value) => updateStyle({ strokeWidth: value })}
          />
          <StyleNumberStepper
            label="箭头"
            value={arrowSize}
            min={8}
            max={32}
            unit="px"
            onChange={(value) => updateStyle({ arrowSize: value })}
          />
        </div>
      )
    }

    if (tool === 'pen') {
      const style = state.toolStyles.pen
      const ann = selectedAnnotation?.type === 'pen' ? selectedAnnotation : null
      const color = ann?.color ?? style.color
      const strokeWidth = ann?.strokeWidth ?? style.strokeWidth
      const updateStyle = (patch: Record<string, unknown>): void => {
        if (ann) {
          dispatch({ type: 'update-selected-style', patch })
        } else {
          dispatch({ type: 'set-tool-style', tool: 'pen', patch })
        }
      }
      return (
        <div className="screenshot-style-row">
          <StyleColorControl label="画笔" value={color} onChange={(value) => updateStyle({ color: value })} />
          <StyleNumberStepper
            label="线宽"
            value={strokeWidth}
            min={2}
            max={14}
            unit="px"
            onChange={(value) => updateStyle({ strokeWidth: value })}
          />
        </div>
      )
    }

    return null
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (textEditor) {
        if (event.key === 'Escape') {
          cancelTextInput()
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
          annotations: state.annotations.filter((annotation) => annotation.id !== state.selectedId),
          previous: state.annotations
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
  }, [cancelTextInput, performOutput, state.annotations, state.selectedId, state.selection, textEditor])

  if (!payload) {
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-white">正在冻结屏幕...</div>
  }

  const styleEditor = getStyleEditor()

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
        onDoubleClick={handleDoubleClick}
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
            {annotationTools.map((item) => {
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
            <ToolbarButton title="复制图片 Ctrl+C" onClick={() => void performOutput('copy')}><Clipboard className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="OCR 识别" onClick={() => void sendCurrentToOcrTool()}><ScanText className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="识别二维码" onClick={() => void detectCurrentQrCode()}><QrCode className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="提取颜色" onClick={() => void extractCurrentColors()}><Palette className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="钉在桌面" onClick={() => void pinCurrent()}><Pin className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="发送到图片处理" onClick={() => void sendCurrentToImageTool()}><ImageIcon className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="保存 Ctrl+S" onClick={() => void performOutput('save')}><Save className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton title="取消 Esc" onClick={() => window.electronAPI.screenCapture.cancel()}><X className="h-4 w-4" /></ToolbarButton>
            <button className="flex h-8 items-center gap-1 rounded-md bg-[#3f8cff] px-3 text-sm hover:bg-[#277bf5]" onClick={() => void performOutput('complete')} title="复制并关闭 Enter">
              <Check className="h-4 w-4" />复制并关闭
            </button>
          </div>
          {styleEditor && (
            <div
              ref={setStyleToolbarRef}
              className="screenshot-style-toolbar"
              style={{ left: styleToolbarPosition.x, top: styleToolbarPosition.y }}
              onBlur={handleStyleToolbarBlur}
            >
              {styleEditor}
            </div>
          )}
        </>
      )}

      {textEditor && (
        <textarea
          ref={textAreaRef}
          autoFocus
          wrap="off"
          value={textEditor.value}
          onChange={(event) => setTextEditor((current) => {
            if (!current) return current
            const value = event.target.value
            return {
              ...current,
              value,
              rect: getTextRect({ x: current.rect.x, y: current.rect.y }, value, current.style)
            }
          })}
          onBlur={handleTextEditorBlur}
          onCompositionStart={() => {
            textComposingRef.current = true
          }}
          onCompositionEnd={() => {
            textComposingRef.current = false
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || textComposingRef.current) {
              event.stopPropagation()
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelTextInput()
            }
            event.stopPropagation()
          }}
          className="absolute rounded border-2 border-[#3f8cff] px-2 py-[5px] text-white outline-none resize-none overflow-hidden"
          style={{
            zIndex: 1000,
            pointerEvents: 'auto',
            left: textEditor.rect.x,
            top: textEditor.rect.y,
            width: textEditor.rect.width,
            height: textEditor.rect.height,
            fontSize: textEditor.style.fontSize,
            lineHeight: `${Math.round(textEditor.style.fontSize * 1.4)}px`,
            fontFamily: '"Microsoft YaHei UI", sans-serif',
            fontWeight: textEditor.style.bold ? 700 : 600,
            color: textEditor.style.color,
            backgroundColor: textEditor.style.bgColor ?? 'rgba(0, 0, 0, 0.8)',
            textAlign: textEditor.style.align,
            boxShadow: '0 0 0 2px rgba(63, 140, 255, 0.35), 0 12px 32px rgba(0, 0, 0, 0.38)'
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
