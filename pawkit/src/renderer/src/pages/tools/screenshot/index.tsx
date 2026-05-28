import { useState } from 'react'
import { ScreenshotResult } from '../../../../../shared/types'
import { CaptureOverlay } from './capture-overlay'

// 截图工具组件
export function ScreenshotPage(): JSX.Element {
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // 全屏截图
  const handleCaptureFullScreen = async (): Promise<void> => {
    setIsCapturing(true)
    setMessage(null)
    try {
      const result = await window.electronAPI.screenshot.captureFullScreen()
      if (result) {
        setScreenshot(result)
        setMessage('截图成功，可以点击"区域裁剪"选择特定区域')
      } else {
        setMessage('截图失败')
      }
    } catch {
      setMessage('截图失败')
    } finally {
      setIsCapturing(false)
    }
  }

  // 复制到剪贴板
  const handleCopyToClipboard = async (dataUrl?: string): Promise<void> => {
    const target = dataUrl || screenshot?.dataUrl
    if (!target) return
    try {
      const success = await window.electronAPI.screenshot.copyImageToClipboard(target)
      setMessage(success ? '已复制到剪贴板' : '复制失败')
    } catch {
      setMessage('复制失败')
    }
  }

  // 保存到本地
  const handleSaveImage = async (dataUrl?: string): Promise<void> => {
    const target = dataUrl || screenshot?.dataUrl
    if (!target) return
    try {
      const result = await window.electronAPI.screenshot.saveImage(target)
      if (result.success) {
        setMessage(`已保存到: ${result.path}`)
      } else {
        setMessage('保存已取消')
      }
    } catch {
      setMessage('保存失败')
    }
  }

  // 区域裁剪完成
  const handleCaptureComplete = (croppedDataUrl: string): void => {
    setShowOverlay(false)

    // 获取裁剪后的图片尺寸
    const img = new Image()
    img.onload = () => {
      setScreenshot({
        dataUrl: croppedDataUrl,
        width: img.width,
        height: img.height,
        createdAt: new Date().toISOString()
      })
      setMessage('区域截图完成')
    }
    img.onerror = () => {
      // 如果无法获取尺寸，仍然保存截图
      setScreenshot({
        dataUrl: croppedDataUrl,
        width: 0,
        height: 0,
        createdAt: new Date().toISOString()
      })
      setMessage('区域截图完成')
    }
    img.src = croppedDataUrl
  }

  // 取消区域裁剪
  const handleCaptureCancel = (): void => {
    setShowOverlay(false)
  }

  return (
    <div className="space-y-6">
      {/* 截图工具栏 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">截图工具</h3>
        <p className="mt-1 text-sm text-gray-400">截取屏幕内容</p>

        <div className="mt-4 flex gap-3">
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
            onClick={handleCaptureFullScreen}
            disabled={isCapturing}
          >
            {isCapturing ? '截图中...' : '全屏截图'}
          </button>

          {screenshot && (
            <>
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => setShowOverlay(true)}
              >
                区域裁剪
              </button>
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => handleCopyToClipboard()}
              >
                复制到剪贴板
              </button>
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => handleSaveImage()}
              >
                保存图片
              </button>
            </>
          )}
        </div>

        {message && (
          <div className="mt-3 rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-400">
            {message}
          </div>
        )}
      </div>

      {/* 截图预览 */}
      {screenshot && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">截图预览</h3>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/20">
            <img
              src={screenshot.dataUrl}
              alt="截图预览"
              className="max-h-[500px] w-full object-contain"
            />
          </div>
          <div className="mt-3 flex gap-4 text-sm text-gray-400">
            {screenshot.width > 0 && <span>尺寸: {screenshot.width} x {screenshot.height}</span>}
            <span>时间: {new Date(screenshot.createdAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>
      )}

      {/* 区域截图覆盖层 */}
      {showOverlay && screenshot && (
        <CaptureOverlay
          imageDataUrl={screenshot.dataUrl}
          onCapture={handleCaptureComplete}
          onCancel={handleCaptureCancel}
        />
      )}
    </div>
  )
}
