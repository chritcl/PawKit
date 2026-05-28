import { useState } from 'react'
import { base64Encode, base64Decode, urlEncode, urlDecode } from '../../../utils/format'

// Base64/URL 编解码工具组件
export function Base64ToolPage(): JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'base64' | 'url'>('base64')

  // 编码
  const handleEncode = (): void => {
    if (!input.trim()) {
      setError('请输入要编码的内容')
      setOutput('')
      return
    }

    const result = mode === 'base64' ? base64Encode(input) : urlEncode(input)
    if (result.success) {
      setOutput(result.result)
      setError(null)
    } else {
      setOutput('')
      setError(result.error ?? '编码失败')
    }
  }

  // 解码
  const handleDecode = (): void => {
    if (!input.trim()) {
      setError('请输入要解码的内容')
      setOutput('')
      return
    }

    const result = mode === 'base64' ? base64Decode(input) : urlDecode(input)
    if (result.success) {
      setOutput(result.result)
      setError(null)
    } else {
      setOutput('')
      setError(result.error ?? '解码失败')
    }
  }

  // 复制输出
  const handleCopy = async (): Promise<void> => {
    if (output) {
      await window.electronAPI?.clipboard?.writeText(output)
    }
  }

  // 清空
  const handleClear = (): void => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* 模式选择 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">编码工具</h3>
        <p className="mt-1 text-sm text-gray-400">Base64 和 URL 编解码</p>

        <div className="mt-4 flex gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm ${
              mode === 'base64' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
            onClick={() => setMode('base64')}
          >
            Base64
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm ${
              mode === 'url' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
            onClick={() => setMode('url')}
          >
            URL
          </button>
        </div>
      </div>

      {/* 输入输出 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        {/* 工具栏 */}
        <div className="mb-4 flex gap-2">
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleEncode}
          >
            编码
          </button>
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleDecode}
          >
            解码
          </button>
          <div className="flex-1" />
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleClear}
          >
            清空
          </button>
        </div>

        {/* 输入区 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-gray-400">输入</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'base64' ? '输入要编码/解码的文本...' : '输入要编码/解码的 URL...'}
            className="h-32 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
        </div>

        {/* 输出区 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm text-gray-400">输出</label>
            {output && (
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                onClick={handleCopy}
              >
                复制
              </button>
            )}
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="结果将显示在这里..."
            className="h-32 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:outline-none"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
