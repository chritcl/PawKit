import { useMemo, useState } from 'react'
import { Binary, Braces, Clipboard, Copy, Link, RotateCcw, ScanText } from 'lucide-react'
import {
  base64Decode,
  base64Encode,
  base64UrlDecode,
  base64UrlEncode,
  decodeJwt,
  parseDataUrl,
  urlDecode,
  urlEncode
} from '../../../utils/format'

type EncodeMode = 'base64' | 'url' | 'jwt' | 'data-url'
type Base64Variant = 'standard' | 'url-safe'
type EncodeOperation = 'encode' | 'decode'

const modeItems: Array<{ mode: EncodeMode; label: string; icon: typeof Binary }> = [
  { mode: 'base64', label: 'Base64', icon: Binary },
  { mode: 'url', label: 'URL', icon: Link },
  { mode: 'jwt', label: 'JWT', icon: Braces },
  { mode: 'data-url', label: 'Data URL', icon: ScanText }
]

// 编码转换工具组件
export function Base64ToolPage(): JSX.Element {
  const [mode, setMode] = useState<EncodeMode>('base64')
  const [variant, setVariant] = useState<Base64Variant>('standard')
  const [operation, setOperation] = useState<EncodeOperation>('decode')
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('等待输入')

  const computed = useMemo(() => {
    if (!input.trim()) return { type: 'empty' as const }

    if (mode === 'base64') {
      const result = operation === 'encode'
        ? variant === 'standard' ? base64Encode(input) : base64UrlEncode(input)
        : variant === 'standard' ? base64Decode(input) : base64UrlDecode(input)
      return { type: 'text' as const, result }
    }

    if (mode === 'url') {
      const result = operation === 'encode' ? urlEncode(input) : urlDecode(input)
      return { type: 'text' as const, result }
    }

    if (mode === 'jwt') {
      return { type: 'jwt' as const, result: decodeJwt(input) }
    }

    return { type: 'data-url' as const, result: parseDataUrl(input) }
  }, [input, mode, operation, variant])

  const outputText = useMemo(() => {
    if (computed.type === 'text') return computed.result.success ? computed.result.result : computed.result.error ?? ''
    if (computed.type === 'jwt') {
      if (!computed.result.success) return computed.result.error ?? ''
      return [
        'Header',
        computed.result.headerJson,
        '',
        'Payload',
        computed.result.payloadJson,
        '',
        `Signature: ${computed.result.signature || '无'}`
      ].join('\n')
    }
    if (computed.type === 'data-url') {
      if (!computed.result.success) return computed.result.error ?? ''
      return [
        `媒体类型：${computed.result.mediaType}`,
        `编码方式：${computed.result.isBase64 ? 'Base64' : 'URL 编码'}`,
        '',
        computed.result.decodedPreview
      ].join('\n')
    }
    return ''
  }, [computed])

  const copyText = async (text: string, nextMessage = '已复制'): Promise<void> => {
    if (!text) return
    await window.electronAPI.clipboard.writeText(text)
    setMessage(nextMessage)
  }

  const pasteInput = async (): Promise<void> => {
    const text = await window.electronAPI.clipboard.readText()
    setInput(text)
    setMessage('已从剪贴板粘贴')
  }

  const clearInput = (): void => {
    setInput('')
    setMessage('已清空')
  }

  const fillExample = (): void => {
    if (mode === 'jwt') {
      setInput('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiUGF3S2l0Iiwicm9sZSI6IuW8gOWPkeiAheW3peWFtyJ9.signature')
    } else if (mode === 'data-url') {
      setInput('data:text/plain;base64,UGF3S2l0IOe8lueggei9rOaNouW3peWFtQ==')
    } else if (mode === 'url') {
      setInput('https://example.com/search?q=PawKit 编码转换&lang=zh-CN')
      setOperation('encode')
    } else {
      setInput('PawKit 编码转换')
      setOperation('encode')
    }
    setMessage('已填充示例')
  }

  const statusText = computed.type === 'empty'
    ? '等待输入'
    : outputText && !outputText.includes('失败') && !outputText.includes('不是有效') && !outputText.includes('至少需要')
      ? '转换成功'
      : outputText

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-1">
          {modeItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.mode}
                className={`flex h-9 items-center gap-2 rounded px-3 text-sm ${mode === item.mode ? 'bg-[#1677ff] text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setMode(item.mode)}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        {(mode === 'base64' || mode === 'url') && (
          <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-1">
            <button className={`h-9 rounded px-3 text-sm ${operation === 'encode' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setOperation('encode')}>
              编码
            </button>
            <button className={`h-9 rounded px-3 text-sm ${operation === 'decode' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setOperation('decode')}>
              解码
            </button>
          </div>
        )}

        {mode === 'base64' && (
          <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-1">
            <button className={`h-9 rounded px-3 text-sm ${variant === 'standard' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setVariant('standard')}>
              标准
            </button>
            <button className={`h-9 rounded px-3 text-sm ${variant === 'url-safe' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => setVariant('url-safe')}>
              URL-safe
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={pasteInput} title="粘贴">
            <Clipboard className="h-4 w-4" />
            粘贴
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={fillExample} title="示例">
            <ScanText className="h-4 w-4" />
            示例
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={clearInput} title="清空">
            <RotateCcw className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>输入</span>
            <span className="text-xs text-gray-500">{new Blob([input]).size} bytes</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={mode === 'jwt' ? '粘贴 JWT...' : mode === 'data-url' ? '粘贴 Data URL...' : '输入要转换的文本...'}
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm text-gray-100 outline-none placeholder:text-gray-600"
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>输出</span>
            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30" disabled={!outputText} onClick={() => void copyText(outputText, '输出已复制')} title="复制输出">
              <Copy className="h-3.5 w-3.5" />
              复制
            </button>
          </div>
          <textarea
            value={outputText}
            readOnly
            placeholder="转换结果将显示在这里..."
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm text-gray-100 outline-none placeholder:text-gray-600"
          />
        </section>
      </div>

      {computed.type === 'jwt' && computed.result.success && (
        <div className="grid grid-cols-3 gap-3">
          <button className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]" onClick={() => void copyText(computed.result.headerJson ?? '', 'Header 已复制')}>
            <div className="text-xs text-gray-500">Header</div>
            <div className="mt-1 truncate font-mono text-sm text-gray-200">{computed.result.headerJson}</div>
          </button>
          <button className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]" onClick={() => void copyText(computed.result.payloadJson ?? '', 'Payload 已复制')}>
            <div className="text-xs text-gray-500">Payload</div>
            <div className="mt-1 truncate font-mono text-sm text-gray-200">{computed.result.payloadJson}</div>
          </button>
          <button className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]" onClick={() => void copyText(computed.result.signature ?? '', 'Signature 已复制')}>
            <div className="text-xs text-gray-500">Signature</div>
            <div className="mt-1 truncate font-mono text-sm text-gray-200">{computed.result.signature || '无'}</div>
          </button>
        </div>
      )}

      {computed.type === 'data-url' && computed.result.success && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <div className="text-xs text-gray-500">媒体类型</div>
            <div className="mt-1 font-mono text-gray-200">{computed.result.mediaType}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
            <div className="text-xs text-gray-500">编码方式</div>
            <div className="mt-1 font-mono text-gray-200">{computed.result.isBase64 ? 'Base64' : 'URL 编码'}</div>
          </div>
          <button className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]" onClick={() => void copyText(computed.result.data ?? '', 'Data URL 内容已复制')}>
            <div className="text-xs text-gray-500">数据片段</div>
            <div className="mt-1 truncate font-mono text-gray-200">{computed.result.data}</div>
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-xs">
        <span className={statusText === '转换成功' ? 'text-emerald-300' : 'text-gray-400'}>{message}</span>
        <span className="text-gray-600">|</span>
        <span className={statusText === '转换成功' ? 'text-emerald-300' : statusText === '等待输入' ? 'text-gray-400' : 'text-red-300'}>
          {statusText}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">Base64 是编码，不是加密；JWT 只本地解码，不校验签名</span>
      </div>
    </div>
  )
}
