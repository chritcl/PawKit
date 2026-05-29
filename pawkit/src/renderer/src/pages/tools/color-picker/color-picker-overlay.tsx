import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ScreenColorPickerPayload,
  ScreenColorPickerSource,
  ScreenColorPickResult
} from '../../../../../shared/types'
import { rgbToHex } from '../../../utils/color'

type CanvasMap = Map<string, HTMLCanvasElement>

// 加载屏幕图片到离屏画布
function loadSourceCanvas(source: ScreenColorPickerSource): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = source.height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('无法创建画布上下文'))
        return
      }
      context.drawImage(image, 0, 0, source.width, source.height)
      resolve(canvas)
    }
    image.onerror = () => reject(new Error('屏幕图片加载失败'))
    image.src = source.dataUrl
  })
}

// 限制数值范围
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// 全屏滴管覆盖层
export function ColorPickerOverlay(): JSX.Element {
  const [payload, setPayload] = useState<ScreenColorPickerPayload | null>(null)
  const [ready, setReady] = useState(false)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [picked, setPicked] = useState<ScreenColorPickResult | null>(null)
  const canvasesRef = useRef<CanvasMap>(new Map())

  useEffect(() => {
    const removeListener = window.electronAPI.screenshot.onColorPickerData((data) => {
      setPayload(data)
    })
    window.electronAPI.screenshot.colorPickerReady()

    return () => {
      removeListener()
    }
  }, [])

  useEffect(() => {
    if (!payload) return

    let active = true
    Promise.all(payload.sources.map(async (source) => {
      const canvas = await loadSourceCanvas(source)
      return [source.displayId, canvas] as const
    })).then((items) => {
      if (!active) return
      canvasesRef.current = new Map(items)
      setReady(true)
    }).catch(() => {
      window.electronAPI.screenshot.cancelColorPick()
    })

    return () => {
      active = false
    }
  }, [payload])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        window.electronAPI.screenshot.cancelColorPick()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.focus()
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const activeSource = useMemo(() => {
    if (!payload || !picked) return null
    return payload.sources.find((source) => source.displayId === picked.displayId) ?? null
  }, [payload, picked])

  const getSourceAtPoint = useCallback((clientX: number, clientY: number): ScreenColorPickerSource | null => {
    if (!payload) return null

    const absoluteX = payload.virtualBounds.x + clientX
    const absoluteY = payload.virtualBounds.y + clientY

    return payload.sources.find((source) => (
      absoluteX >= source.bounds.x &&
      absoluteX < source.bounds.x + source.bounds.width &&
      absoluteY >= source.bounds.y &&
      absoluteY < source.bounds.y + source.bounds.height
    )) ?? null
  }, [payload])

  const sampleAtPoint = useCallback((clientX: number, clientY: number): ScreenColorPickResult | null => {
    if (!payload || !ready) return null

    const source = getSourceAtPoint(clientX, clientY)
    if (!source) return null

    const canvas = canvasesRef.current.get(source.displayId)
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return null

    const absoluteX = payload.virtualBounds.x + clientX
    const absoluteY = payload.virtualBounds.y + clientY
    const localX = absoluteX - source.bounds.x
    const localY = absoluteY - source.bounds.y
    const pixelX = clamp(Math.floor((localX / source.bounds.width) * source.width), 0, source.width - 1)
    const pixelY = clamp(Math.floor((localY / source.bounds.height) * source.height), 0, source.height - 1)
    const pixel = context.getImageData(pixelX, pixelY, 1, 1).data
    const rgb = { r: pixel[0], g: pixel[1], b: pixel[2] }

    return {
      hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      rgb,
      point: { x: Math.round(absoluteX), y: Math.round(absoluteY) },
      displayId: source.displayId,
      createdAt: new Date().toISOString()
    }
  }, [getSourceAtPoint, payload, ready])

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    setCursor({ x: event.clientX, y: event.clientY })
    const result = sampleAtPoint(event.clientX, event.clientY)
    if (result) setPicked(result)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const result = sampleAtPoint(event.clientX, event.clientY) ?? picked
    if (result) {
      window.electronAPI.screenshot.finishColorPick(result)
    }
  }

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    window.electronAPI.screenshot.cancelColorPick()
  }

  const magnifierStyle = useMemo(() => {
    if (!payload || !activeSource) return undefined
    const absoluteX = payload.virtualBounds.x + cursor.x
    const absoluteY = payload.virtualBounds.y + cursor.y
    const localX = absoluteX - activeSource.bounds.x
    const localY = absoluteY - activeSource.bounds.y
    const zoom = 8
    const size = 128

    return {
      left: cursor.x + 18,
      top: cursor.y + 18,
      width: size,
      height: size,
      backgroundImage: `url(${activeSource.dataUrl})`,
      backgroundSize: `${activeSource.bounds.width * zoom}px ${activeSource.bounds.height * zoom}px`,
      backgroundPosition: `${-(localX * zoom - size / 2)}px ${-(localY * zoom - size / 2)}px`
    }
  }, [activeSource, cursor, payload])

  if (!payload || !ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-white">
        准备取色...
      </div>
    )
  }

  return (
    <div
      className="relative h-screen w-screen cursor-none overflow-hidden bg-black text-white"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {payload.sources.map((source) => (
        <img
          key={source.displayId}
          src={source.dataUrl}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: source.bounds.x - payload.virtualBounds.x,
            top: source.bounds.y - payload.virtualBounds.y,
            width: source.bounds.width,
            height: source.bounds.height
          }}
          draggable={false}
        />
      ))}

      <div
        className="pointer-events-none fixed z-10 h-px w-screen bg-white/60 mix-blend-difference"
        style={{ top: cursor.y }}
      />
      <div
        className="pointer-events-none fixed z-10 h-screen w-px bg-white/60 mix-blend-difference"
        style={{ left: cursor.x }}
      />

      {magnifierStyle && (
        <div
          className="pointer-events-none fixed z-20 overflow-hidden rounded-full border-2 border-white shadow-2xl shadow-black/60"
          style={magnifierStyle}
        >
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
        </div>
      )}

      {picked && (
        <div
          className="pointer-events-none fixed z-30 rounded-lg border border-white/20 bg-black/80 px-3 py-2 shadow-xl backdrop-blur"
          style={{ left: cursor.x + 22, top: cursor.y + 154 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded border border-white/30"
              style={{ backgroundColor: picked.hex }}
            />
            <span className="font-mono text-sm">{picked.hex}</span>
          </div>
          <div className="mt-1 font-mono text-xs text-white/60">
            {picked.rgb.r}, {picked.rgb.g}, {picked.rgb.b}
          </div>
        </div>
      )}
    </div>
  )
}
