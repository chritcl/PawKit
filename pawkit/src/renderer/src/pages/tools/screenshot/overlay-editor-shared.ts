import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Brush,
  Circle,
  Grid3X3,
  Highlighter,
  MousePointer2,
  Square,
  Type
} from 'lucide-react'
import type { CapturePoint, CaptureRect, CaptureSize, CaptureTool } from './engine/types'

export interface TextEditorState {
  rect: CaptureRect
  value: string
  style: {
    color: string
    fontSize: number
    bold: boolean
    bgColor: string | null
    align: 'left' | 'center' | 'right'
  }
  editingId?: string
}

export type MosaicSubMode = 'paint' | 'area'

export const annotationTools: Array<{ tool: CaptureTool; label: string; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: '选择', icon: MousePointer2 },
  { tool: 'rect', label: '矩形', icon: Square },
  { tool: 'ellipse', label: '椭圆', icon: Circle },
  { tool: 'arrow', label: '箭头', icon: ArrowUpRight },
  { tool: 'pen', label: '画笔', icon: Brush },
  { tool: 'text', label: '文字', icon: Type },
  { tool: 'mosaic', label: '马赛克', icon: Highlighter },
  { tool: 'step', label: '序号', icon: Grid3X3 }
]

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getStyleToolbarPosition(
  toolbarPosition: CapturePoint,
  toolbarSize: CaptureSize,
  styleToolbarSize: CaptureSize,
  viewport: CaptureSize
): CapturePoint {
  const margin = 8
  const gap = 4
  const maxX = Math.max(margin, viewport.width - styleToolbarSize.width - margin)
  const x = clampNumber(toolbarPosition.x, margin, maxX)
  const below = toolbarPosition.y + toolbarSize.height + gap
  const above = toolbarPosition.y - styleToolbarSize.height - gap
  const maxY = Math.max(margin, viewport.height - styleToolbarSize.height - margin)

  if (below + styleToolbarSize.height <= viewport.height - margin) {
    return { x, y: below }
  }
  if (above >= margin) {
    return { x, y: above }
  }
  return { x, y: clampNumber(below, margin, maxY) }
}

export function useViewportSize(): CaptureSize {
  const [size, setSize] = useState<CaptureSize>(() => ({
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight)
  }))

  useEffect(() => {
    const update = (): void => {
      setSize({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight)
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}
