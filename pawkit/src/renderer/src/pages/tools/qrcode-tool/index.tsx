import { useState } from 'react'
import QRCode from 'qrcode'

// 二维码工具组件
export function QRCodeToolPage(): JSX.Element {
  const [input, setInput] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 生成二维码
  const handleGenerate = async (): Promise<void> => {
    if (!input.trim()) {
      setError('请输入要生成二维码的内容')
      setQrDataUrl(null)
      return
    }

    try {
      const dataUrl = await QRCode.toDataURL(input, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      setQrDataUrl(dataUrl)
      setError(null)
    } catch {
      setError('生成二维码失败')
      setQrDataUrl(null)
    }
  }

  // 复制二维码图片
  const handleCopy = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      await window.electronAPI?.screenshot?.copyImageToClipboard(qrDataUrl)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  // 保存二维码图片
  const handleSave = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const result = await window.electronAPI?.screenshot?.saveImage(qrDataUrl)
      if (result?.success) {
        setError(null)
      }
    } catch (error) {
      console.error('保存失败:', error)
    }
  }

  // 清空
  const handleClear = (): void => {
    setInput('')
    setQrDataUrl(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* 输入区 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">二维码生成</h3>
        <p className="mt-1 text-sm text-gray-400">输入文本或 URL 生成二维码</p>

        <div className="mt-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要生成二维码的内容..."
            className="h-24 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleGenerate}
          >
            生成二维码
          </button>
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleClear}
          >
            清空
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* 二维码预览 */}
      {qrDataUrl && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">二维码预览</h3>
          <div className="mt-4 flex flex-col items-center">
            <div className="rounded-lg bg-white p-4">
              <img src={qrDataUrl} alt="二维码" className="h-64 w-64" />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={handleCopy}
              >
                复制图片
              </button>
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={handleSave}
              >
                保存图片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
