import { useState } from 'react'
import { formatJson, compressJson, validateJson, exampleJson } from '../../../utils/json'

// JSON 工具组件
export function JsonToolPage(): JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 格式化
  const handleFormat = (): void => {
    const result = formatJson(input)
    if (result.success) {
      setOutput(result.result)
      setError(null)
    } else {
      setOutput('')
      setError(result.error ?? '格式化失败')
    }
  }

  // 压缩
  const handleCompress = (): void => {
    const result = compressJson(input)
    if (result.success) {
      setOutput(result.result)
      setError(null)
    } else {
      setOutput('')
      setError(result.error ?? '压缩失败')
    }
  }

  // 校验
  const handleValidate = (): void => {
    const result = validateJson(input)
    if (result.valid) {
      setError(null)
      setOutput('JSON 格式正确')
    } else {
      setError(result.error ?? '校验失败')
      setOutput('')
    }
  }

  // 复制输出
  const handleCopy = async (): Promise<void> => {
    if (output) {
      await window.electronAPI.clipboard.writeText(output)
    }
  }

  // 清空
  const handleClear = (): void => {
    setInput('')
    setOutput('')
    setError(null)
  }

  // 填充示例
  const handleExample = (): void => {
    setInput(exampleJson)
    setOutput('')
    setError(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={handleFormat}
        >
          格式化
        </button>
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={handleCompress}
        >
          压缩
        </button>
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={handleValidate}
        >
          校验
        </button>
        <div className="flex-1" />
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={handleExample}
        >
          示例
        </button>
        <button
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={handleClear}
        >
          清空
        </button>
      </div>

      {/* 输入输出区域 */}
      <div className="flex flex-1 gap-4 overflow-hidden py-4">
        {/* 输入区 */}
        <div className="flex flex-1 flex-col">
          <div className="mb-2 text-sm text-gray-400">输入 JSON</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 JSON 内容..."
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
        </div>

        {/* 输出区 */}
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-400">输出结果</span>
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
            placeholder="格式化结果将显示在这里..."
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:outline-none"
          />
        </div>
      </div>

      {/* 错误提示区 */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
