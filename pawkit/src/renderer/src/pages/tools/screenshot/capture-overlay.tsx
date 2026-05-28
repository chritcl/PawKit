import { useState, useRef, useEffect } from 'react'

// 区域截图覆盖层属性
interface CaptureOverlayProps {
  imageDataUrl: string
  onCapture: (croppedDataUrl: string) => void
  onCancel: () => void
}

// 区域截图覆盖层组件
export function CaptureOverlay({ imageDataUrl, onCapture, onCancel }: CaptureOverlayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null)

  // 绘制截图和选区
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // 如果有选区，绘制选区
      if (startPos && endPos) {
        const x = Math.min(startPos.x, endPos.x)
        const y = Math.min(startPos.y, endPos.y)
        const width = Math.abs(endPos.x - startPos.x)
        const height = Math.abs(endPos.y - startPos.y)

        // 绘制半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 清除选区部分
        ctx.clearRect(x, y, width, height)
        ctx.drawImage(img, x, y, width, height, x, y, width, height)

        // 绘制选区边框
        ctx.strokeStyle = '#1677ff'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)
      }
    }
    img.src = imageDataUrl
  }, [imageDataUrl, startPos, endPos])

  // 获取鼠标在画布上的位置
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  // 鼠标按下
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    setIsDrawing(true)
    setStartPos(getCanvasPos(e))
    setEndPos(null)
  }

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!isDrawing) return
    setEndPos(getCanvasPos(e))
  }

  // 鼠标松开
  const handleMouseUp = (): void => {
    setIsDrawing(false)
  }

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter' && startPos && endPos) {
        // 裁剪图片
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const x = Math.min(startPos.x, endPos.x)
        const y = Math.min(startPos.y, endPos.y)
        const width = Math.abs(endPos.x - startPos.x)
        const height = Math.abs(endPos.y - startPos.y)

        if (width > 0 && height > 0) {
          const img = new Image()
          img.onload = () => {
            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
            onCapture(canvas.toDataURL('image/png'))
          }
          img.src = imageDataUrl
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [startPos, endPos, imageDataUrl, onCapture, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative max-h-[90vh] max-w-[90vw]">
        <canvas
          ref={canvasRef}
          className="max-h-[90vh] max-w-[90vw] cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-4 py-2 text-sm text-white">
          拖拽选择区域 | ESC 取消 | Enter 确认
        </div>
      </div>
    </div>
  )
}
