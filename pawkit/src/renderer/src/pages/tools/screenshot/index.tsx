import { useEffect, useState } from 'react'
import { Camera, Clipboard, Download, Image as ImageIcon, RotateCcw } from 'lucide-react'
import { ScreenshotResult } from '../../../../../shared/types'

// 截图工具组件
export function ScreenshotPage(): JSX.Element {
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const removeListener = window.electronAPI.screenshot.onCaptureResult((response) => {
      if (response.status === 'captured' && response.result) {
        setScreenshot(response.result)
        setMessage('截图完成，可以复制或保存')
        return
      }
      setMessage(response.message)
    })

    return () => removeListener()
  }, [])

  // 启动系统级截图
  const handleStartCapture = async (): Promise<void> => {
    setIsCapturing(true)
    setMessage(null)
    try {
      const response = await window.electronAPI.screenshot.startCapture()
      if (response.status === 'captured' && response.result) {
        setScreenshot(response.result)
        setMessage('截图完成，可以复制或保存')
      } else {
        setMessage(response.message)
      }
    } catch {
      setMessage('截图失败')
    } finally {
      setIsCapturing(false)
    }
  }

  // 复制到剪贴板
  const handleCopyToClipboard = async (): Promise<void> => {
    if (!screenshot) return
    try {
      const success = await window.electronAPI.screenshot.copyImageToClipboard(screenshot.dataUrl)
      setMessage(success ? '已复制到剪贴板' : '复制失败')
    } catch {
      setMessage('复制失败')
    }
  }

  // 保存到本地
  const handleSaveImage = async (): Promise<void> => {
    if (!screenshot) return
    try {
      const result = await window.electronAPI.screenshot.saveImage(screenshot.dataUrl)
      if (result.status === 'saved') {
        setMessage(`已保存到：${result.path}`)
      } else {
        setMessage(result.message ?? '保存失败')
      }
    } catch {
      setMessage('保存失败')
    }
  }

  // 清空当前截图
  const handleClear = (): void => {
    setScreenshot(null)
    setMessage(null)
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1677ff] px-4 text-sm font-medium text-white hover:bg-[#2f86ff] disabled:opacity-60"
          onClick={handleStartCapture}
          disabled={isCapturing}
          title="系统级截图"
        >
          <Camera className="h-4 w-4" />
          {isCapturing ? '截图中...' : '开始截图'}
        </button>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
          onClick={handleCopyToClipboard}
          disabled={!screenshot}
          title="复制图片"
        >
          <Clipboard className="h-4 w-4" />
          复制
        </button>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
          onClick={handleSaveImage}
          disabled={!screenshot}
          title="保存 PNG"
        >
          <Download className="h-4 w-4" />
          保存
        </button>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
          onClick={handleClear}
          disabled={!screenshot}
          title="清空预览"
        >
          <RotateCcw className="h-4 w-4" />
          清空
        </button>

        <div className="ml-auto text-sm text-gray-400">
          快捷键：Alt + A
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
          {message}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-white/10 bg-black/20">
        {screenshot ? (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <ImageIcon className="h-4 w-4 text-[#1677ff]" />
                截图预览
              </div>
              <div className="text-xs text-gray-500">
                {screenshot.width} x {screenshot.height} · {new Date(screenshot.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              <img
                src={screenshot.dataUrl}
                alt="截图预览"
                className="max-h-full max-w-full rounded-sm object-contain shadow-2xl"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-500">
            <Camera className="h-10 w-10 text-gray-600" />
            <div className="text-sm">暂无截图</div>
          </div>
        )}
      </div>
    </div>
  )
}
