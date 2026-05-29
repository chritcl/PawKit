import { useEffect, useState } from 'react'
import { Camera, Clipboard, Download, Image as ImageIcon, RotateCcw } from 'lucide-react'
import { ScreenshotResult } from '../../../../../shared/types'

// 截图工具组件
export function ScreenshotPage(): JSX.Element {
  const screenshotApi = window.electronAPI?.screenshot
  const screenshotAvailable = Boolean(screenshotApi)
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [message, setMessage] = useState<string | null>(
    screenshotAvailable ? null : '当前浏览器环境不可用，桌面应用内可使用系统截图'
  )

  useEffect(() => {
    if (!screenshotApi) {
      return
    }

    const removeListener = screenshotApi.onCaptureResult((response) => {
      if (response.status === 'captured' && response.result) {
        setScreenshot(response.result)
        setMessage('截图完成，可以复制或保存')
        return
      }
      setMessage(response.message)
    })

    return () => removeListener()
  }, [screenshotApi])

  // 启动系统级截图
  const handleStartCapture = async (): Promise<void> => {
    if (!screenshotApi) {
      setMessage('当前浏览器环境不可用，桌面应用内可使用系统截图')
      return
    }

    setIsCapturing(true)
    setMessage(null)
    try {
      const response = await screenshotApi.startCapture()
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
    if (!screenshot || !screenshotApi) return
    try {
      const success = await screenshotApi.copyImageToClipboard(screenshot.dataUrl)
      setMessage(success ? '已复制到剪贴板' : '复制失败')
    } catch {
      setMessage('复制失败')
    }
  }

  // 保存到本地
  const handleSaveImage = async (): Promise<void> => {
    if (!screenshot || !screenshotApi) return
    try {
      const result = await screenshotApi.saveImage(screenshot.dataUrl)
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
    <div className="tool-page">
      <div className="toolbar-surface tool-toolbar">
        <button
          className="toolbar-button-primary disabled:opacity-60"
          onClick={handleStartCapture}
          disabled={isCapturing || !screenshotAvailable}
          title="系统级截图"
        >
          <Camera className="h-4 w-4" />
          {isCapturing ? '截图中...' : '开始截图'}
        </button>

        <button
          className="toolbar-button disabled:opacity-40"
          onClick={handleCopyToClipboard}
          disabled={!screenshot || !screenshotAvailable}
          title="复制图片"
        >
          <Clipboard className="h-4 w-4" />
          复制
        </button>

        <button
          className="toolbar-button disabled:opacity-40"
          onClick={handleSaveImage}
          disabled={!screenshot || !screenshotAvailable}
          title="保存 PNG"
        >
          <Download className="h-4 w-4" />
          保存
        </button>

        <button
          className="toolbar-button disabled:opacity-40"
          onClick={handleClear}
          disabled={!screenshot}
          title="清空预览"
        >
          <RotateCcw className="h-4 w-4" />
          清空
        </button>

        <div className="toolbar-push text-sm text-[color:var(--text-muted)]">
          快捷键：Alt + A
        </div>
      </div>

      {message && (
        <div className="status-strip text-sm text-[color:var(--text-secondary)]">
          {message}
        </div>
      )}

      <div className="editor-surface tool-panel">
        {screenshot ? (
          <>
            <div className="panel-header">
              <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                <ImageIcon className="h-4 w-4 text-[rgb(var(--color-primary-rgb))]" />
                截图预览
              </div>
              <div className="text-xs text-[color:var(--text-muted)]">
                {screenshot.width} x {screenshot.height} · {new Date(screenshot.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="panel-body flex items-center justify-center overflow-auto p-4">
              <img
                src={screenshot.dataUrl}
                alt="截图预览"
                className="max-h-full max-w-full rounded-sm object-contain shadow-2xl"
              />
            </div>
          </>
        ) : (
          <div className="empty-state flex-col gap-3">
            <Camera className="h-10 w-10" />
            <div className="text-sm">{screenshotAvailable ? '暂无截图' : '浏览器环境不可用'}</div>
            {!screenshotAvailable && (
              <div className="max-w-md text-center text-xs text-[color:var(--text-muted)]">
                系统级截图依赖桌面 preload 能力，普通浏览器预览时会保持页面可见但禁用操作。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
