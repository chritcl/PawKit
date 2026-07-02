import { useMemo } from 'react'
import type { CaptureRect } from './engine/types'
import type { OcrOverlayResult } from '../../../../../shared/types'

interface OcrOverlayLayerProps {
  result: OcrOverlayResult
  selection: CaptureRect
}

export function OcrOverlayLayer({ result, selection }: OcrOverlayLayerProps): JSX.Element | null {
  // 坐标转换：选区图片像素坐标 → 选区内 CSS 坐标
  // OCR 识别的是选区导出的图片，所以 bbox 坐标直接基于选区图片
  const scaleX = selection.width / result.imageWidth
  const scaleY = selection.height / result.imageHeight

  const lineRegions = useMemo(() => {
    return result.regions.filter((r) => r.level === 'line')
  }, [result.regions])

  if (lineRegions.length === 0) return null

  return (
    <div
      className="absolute z-50"
      style={{
        left: selection.x,
        top: selection.y,
        width: selection.width,
        height: selection.height,
        overflow: 'hidden'
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        {lineRegions.map((region, index) => {
          const left = region.bbox.x0 * scaleX
          const top = region.bbox.y0 * scaleY
          const width = (region.bbox.x1 - region.bbox.x0) * scaleX
          const height = (region.bbox.y1 - region.bbox.y0) * scaleY

          // 跳过超出选区的区域
          if (left + width < 0 || top + height < 0 || left > selection.width || top > selection.height) {
            return null
          }

          return (
            <div
              key={index}
              className="ocr-line-region pointer-events-auto absolute cursor-text whitespace-pre"
              style={{
                left,
                top,
                width: Math.max(width, 4),
                height: Math.max(height, 4),
                fontSize: `${Math.max(10, height * 0.85)}px`,
                lineHeight: `${height}px`,
                color: 'transparent',
                userSelect: 'text',
              }}
              title={region.text}
            >
              {region.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}
