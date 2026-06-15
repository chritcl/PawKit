import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ScreenColorPickerPayload,
  ScreenColorPickerSource,
  ScreenColorPickResult
} from '../../../../../shared/types'
import {
  getContrastRatio,
  getReadableTextColor,
  rgbToHex,
  rgbToHsl
} from '../../../utils/color'

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
  const [showDetails, setShowDetails] = useState(false)
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
      if (event.key === 'Tab') {
        event.preventDefault()
        setShowDetails((current) => !current)
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
    const zoom = 10
    const size = 150
    const gap = 18
    const left = cursor.x + gap + size + 260 > window.innerWidth ? cursor.x - size - gap : cursor.x + gap
    const top = cursor.y + gap + size + 150 > window.innerHeight ? cursor.y - size - gap : cursor.y + gap

    return {
      left: clamp(left, 8, window.innerWidth - size - 8),
      top: clamp(top, 8, window.innerHeight - size - 8),
      width: size,
      height: size,
      backgroundImage: `url(${activeSource.dataUrl})`,
      backgroundSize: `${activeSource.bounds.width * zoom}px ${activeSource.bounds.height * zoom}px`,
      backgroundPosition: `${-(localX * zoom - size / 2)}px ${-(localY * zoom - size / 2)}px`,
      imageRendering: 'pixelated' as const
    }
  }, [activeSource, cursor, payload])

  const infoStyle = useMemo(() => {
    const width = 248
    const height = showDetails ? 154 : 132
    const gap = 18
    const magnifierSize = 150
    const preferRight = cursor.x + gap + magnifierSize + width + 8 <= window.innerWidth
    const left = preferRight ? cursor.x + gap + magnifierSize + 10 : cursor.x - magnifierSize - gap
    const top = cursor.y + gap + magnifierSize + height + 8 <= window.innerHeight
      ? cursor.y + gap + magnifierSize + 10
      : cursor.y - height - gap
    return {
      left: clamp(left, 8, window.innerWidth - width - 8),
      top: clamp(top, 8, window.innerHeight - height - 8),
      width
    }
  }, [cursor, showDetails])

  const readability = useMemo(() => {
    if (!picked) return null
    const blackRatio = getContrastRatio({ r: 0, g: 0, b: 0 }, picked.rgb)
    const whiteRatio = getContrastRatio({ r: 255, g: 255, b: 255 }, picked.rgb)
    const recommended = getReadableTextColor(picked.rgb)
    return {
      blackRatio,
      whiteRatio,
      recommended,
      ratio: recommended === '#000000' ? blackRatio : whiteRatio,
      hsl: rgbToHsl(picked.rgb.r, picked.rgb.g, picked.rgb.b)
    }
  }, [picked])

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
          className="color-picker-magnifier pointer-events-none fixed z-20 overflow-hidden border-2 border-white shadow-2xl shadow-black/60"
          style={magnifierStyle}
        >
          <div className="color-picker-pixel-grid" />
          <div className="color-picker-center-pixel" />
        </div>
      )}

      {picked && readability && (
        <div
          className="color-picker-info pointer-events-none fixed z-30 rounded-lg border border-white/20 bg-black/85 px-3 py-2.5 shadow-xl backdrop-blur"
          style={infoStyle}
        >
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <span
              className="h-7 w-7 rounded border border-white/30"
              style={{ backgroundColor: picked.hex }}
            />
            <div>
              <div className="font-mono text-sm font-semibold">{picked.hex}</div>
              <div className="font-mono text-[11px] text-white/55">
                {picked.rgb.r}, {picked.rgb.g}, {picked.rgb.b}
              </div>
            </div>
            <span className="ml-auto rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/55">Tab 详情</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-white/65">
            <span>坐标</span>
            <span className="text-right text-white/90">{picked.point.x}, {picked.point.y}</span>
            <span>推荐文字</span>
            <span className="text-right text-white/90">
              {readability.recommended === '#000000' ? '黑色' : '白色'} · {readability.ratio}:1
            </span>
            {showDetails && (
              <>
                <span>HSL</span>
                <span className="text-right text-white/90">{readability.hsl.h}°, {readability.hsl.s}%, {readability.hsl.l}%</span>
                <span>黑 / 白对比</span>
                <span className="text-right text-white/90">{readability.blackRatio}:1 / {readability.whiteRatio}:1</span>
                <span>透明度</span>
                <span className="text-right text-white/90">100%</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
