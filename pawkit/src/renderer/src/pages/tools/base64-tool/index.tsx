import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Binary,
  Braces,
  Clipboard,
  Copy,
  Info,
  Link,
  RotateCcw,
  ScanText
} from 'lucide-react'
import {
  DataUrlParseResult,
  FormatResult,
  JwtDecodeResult,
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
type ComputedResult =
  | { type: 'empty' }
  | { type: 'text'; result: FormatResult }
  | { type: 'jwt'; result: JwtDecodeResult }
  | { type: 'data-url'; result: DataUrlParseResult }

const modeItems: Array<{ mode: EncodeMode; label: string; icon: typeof Binary }> = [
  { mode: 'base64', label: 'Base64', icon: Binary },
  { mode: 'url', label: 'URL', icon: Link },
  { mode: 'jwt', label: 'JWT', icon: Braces },
  { mode: 'data-url', label: 'Data URL', icon: ScanText }
]

function getTextBytes(text: string): number {
  return new Blob([text]).size
}

function formatTextStats(text: string): string {
  return `${Array.from(text).length} 字符 · ${getTextBytes(text)} B`
}

function formatBytes(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getModeHint(mode: EncodeMode, operation: EncodeOperation, variant: Base64Variant): string {
  if (mode === 'base64') {
    return variant === 'url-safe'
      ? 'URL-safe 会自动处理 -、_ 和缺失 padding'
      : 'Base64 是编码，不是加密'
  }
  if (mode === 'url') {
    return operation === 'encode'
      ? '当前按 URI Component 语义编码，不会保留 ?、=、&'
      : 'URL 解码会检查不完整的 % 转义'
  }
  if (mode === 'jwt') {
    return 'JWT 只本地解码，不验证签名，不代表令牌可信'
  }
  return 'Data URL 会解析媒体类型、编码方式和文本预览'
}

function getErrorText(computed: ComputedResult): string {
  if (computed.type === 'text' && !computed.result.success) return computed.result.error ?? '转换失败'
  if (computed.type === 'jwt' && !computed.result.success) return computed.result.error ?? 'JWT 解码失败'
  if (computed.type === 'data-url' && !computed.result.success) return computed.result.error ?? 'Data URL 解析失败'
  return ''
}

function getOutputText(computed: ComputedResult): string {
  if (computed.type === 'text') return computed.result.success ? computed.result.result : ''
  if (computed.type === 'jwt') {
    if (!computed.result.success) return ''
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
    if (!computed.result.success || !computed.result.textPreviewable) return ''
    return computed.result.decodedPreview ?? ''
  }
  return ''
}

function getPlaceholder(mode: EncodeMode): string {
  if (mode === 'jwt') return '粘贴 JWT，支持两段或三段 token'
  if (mode === 'data-url') return '粘贴 data:text/plain;base64,...'
  return '粘贴编码文本后实时转换'
}

// 编码转换工具组件
export function Base64ToolPage(): JSX.Element {
  const [mode, setMode] = useState<EncodeMode>('base64')
  const [variant, setVariant] = useState<Base64Variant>('standard')
  const [operation, setOperation] = useState<EncodeOperation>('decode')
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('等待输入')

  const computed = useMemo<ComputedResult>(() => {
    if (input.length === 0) return { type: 'empty' }

    if (mode === 'base64') {
      const result = operation === 'encode'
        ? variant === 'standard' ? base64Encode(input) : base64UrlEncode(input)
        : variant === 'standard' ? base64Decode(input) : base64UrlDecode(input)
      return { type: 'text', result }
    }

    if (mode === 'url') {
      const result = operation === 'encode' ? urlEncode(input) : urlDecode(input)
      return { type: 'text', result }
    }

    if (mode === 'jwt') {
      return { type: 'jwt', result: decodeJwt(input) }
    }

    return { type: 'data-url', result: parseDataUrl(input) }
  }, [input, mode, operation, variant])

  const errorText = useMemo(() => getErrorText(computed), [computed])
  const outputText = useMemo(() => getOutputText(computed), [computed])
  const isSuccess = computed.type !== 'empty' && !errorText
  const canSwap = outputText.length > 0 && (mode === 'base64' || mode === 'url')
  const statusLabel = computed.type === 'empty' ? '等待输入' : isSuccess ? '转换成功' : '转换失败'

  const copyText = async (text: string, nextMessage = '已复制'): Promise<void> => {
    if (!text) return
    try {
      await window.electronAPI.clipboard.writeText(text)
      setMessage(nextMessage)
    } catch {
      setMessage('复制失败')
    }
  }

  const pasteInput = async (): Promise<void> => {
    try {
      const text = await window.electronAPI.clipboard.readText()
      setInput(text)
      setMessage(text ? '已从剪贴板粘贴' : '剪贴板没有文本')
    } catch {
      setMessage('读取剪贴板失败')
    }
  }

  const clearInput = (): void => {
    setInput('')
    setMessage('已清空')
  }

  const swapInputOutput = (): void => {
    if (!canSwap) return
    setInput(outputText)
    setOperation((current) => current === 'encode' ? 'decode' : 'encode')
    setMessage('已交换输入输出')
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

  return (
    <div className="tool-page encoding-tool-page">
      <div className="toolbar-surface tab-toolbar encoding-toolbar">
        <div className="tab-toolbar-main">
          <div className="segmented-control segmented-scroll">
            {modeItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.mode}
                  className={`segmented-item ${mode === item.mode ? 'segmented-item-active' : ''}`}
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
            <div className="segmented-control segmented-scroll">
              <button className={`segmented-item ${operation === 'encode' ? 'segmented-item-active' : ''}`} onClick={() => setOperation('encode')}>
                编码
              </button>
              <button className={`segmented-item ${operation === 'decode' ? 'segmented-item-active' : ''}`} onClick={() => setOperation('decode')}>
                解码
              </button>
            </div>
          )}

          {mode === 'base64' && (
            <div className="segmented-control segmented-scroll">
              <button className={`segmented-item ${variant === 'standard' ? 'segmented-item-active' : ''}`} onClick={() => setVariant('standard')}>
                标准
              </button>
              <button className={`segmented-item ${variant === 'url-safe' ? 'segmented-item-active' : ''}`} onClick={() => setVariant('url-safe')}>
                URL-safe
              </button>
            </div>
          )}
        </div>

        <div className="panel-actions">
          <button className="toolbar-button" onClick={pasteInput} title="从剪贴板粘贴">
            <Clipboard className="h-4 w-4" />
            粘贴
          </button>
          <button className="toolbar-button" onClick={fillExample} title="填充示例">
            <ScanText className="h-4 w-4" />
            示例
          </button>
          <button className="toolbar-button" onClick={swapInputOutput} disabled={!canSwap} title="交换输入输出并切换方向">
            <ArrowLeftRight className="h-4 w-4" />
            交换
          </button>
          <button className="toolbar-button" onClick={clearInput} title="清空">
            <RotateCcw className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="tool-workspace tool-grid-editor">
        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>输入</span>
            <span className="text-xs text-[color:var(--text-muted)]">{formatTextStats(input)}</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={getPlaceholder(mode)}
            className="editor-textarea"
          />
        </section>

        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>输出</span>
            <div className="toolbar-group">
              <span className="text-xs text-[color:var(--text-muted)]">{formatTextStats(outputText)}</span>
              <button className="toolbar-button min-h-7 px-2 py-1 text-xs disabled:opacity-30" disabled={!outputText} onClick={() => void copyText(outputText, '输出已复制')} title="复制输出">
                <Copy className="h-3.5 w-3.5" />
                复制
              </button>
            </div>
          </div>
          {errorText && (
            <div className="encoding-error-row">
              <AlertTriangle className="h-4 w-4" />
              <span>{errorText}</span>
            </div>
          )}
          {mode === 'url' && (
            <div className="encoding-note-row">
              <Info className="h-4 w-4" />
              <span>{getModeHint(mode, operation, variant)}</span>
            </div>
          )}
          <textarea
            value={outputText}
            readOnly
            placeholder={errorText ? '修正输入后重新转换' : '转换结果将显示在这里'}
            className="editor-textarea"
          />
        </section>
      </div>

      {computed.type === 'jwt' && computed.result.success && (
        <div className="encoding-detail-grid">
          <button className="encoding-detail-card" onClick={() => void copyText(computed.result.headerJson ?? '', 'Header 已复制')}>
            <div className="encoding-detail-title">
              <span>Header</span>
              <Copy className="h-3.5 w-3.5" />
            </div>
            <pre>{computed.result.headerJson}</pre>
          </button>
          <button className="encoding-detail-card" onClick={() => void copyText(computed.result.payloadJson ?? '', 'Payload 已复制')}>
            <div className="encoding-detail-title">
              <span>Payload</span>
              <Copy className="h-3.5 w-3.5" />
            </div>
            <pre>{computed.result.payloadJson}</pre>
          </button>
          <button className="encoding-detail-card" onClick={() => void copyText(computed.result.signature ?? '', 'Signature 已复制')}>
            <div className="encoding-detail-title">
              <span>Signature</span>
              <Copy className="h-3.5 w-3.5" />
            </div>
            <code>{computed.result.signature || '无'}</code>
          </button>
        </div>
      )}

      {computed.type === 'data-url' && computed.result.success && (
        <div className="encoding-detail-grid">
          <div className="encoding-detail-card">
            <div className="encoding-detail-title">
              <span>媒体类型</span>
            </div>
            <code>{computed.result.mediaType}</code>
          </div>
          <div className="encoding-detail-card">
            <div className="encoding-detail-title">
              <span>编码方式</span>
            </div>
            <code>{computed.result.isBase64 ? 'Base64' : 'URL 编码'}</code>
          </div>
          <div className="encoding-detail-card">
            <div className="encoding-detail-title">
              <span>数据大小</span>
            </div>
            <code>{formatBytes(computed.result.decodedByteLength)} 解码 · {computed.result.dataLength} 字符片段</code>
          </div>
          <button className="encoding-detail-card" onClick={() => void copyText(computed.result.data ?? '', 'Data URL 数据片段已复制')}>
            <div className="encoding-detail-title">
              <span>数据片段</span>
              <Copy className="h-3.5 w-3.5" />
            </div>
            <pre>{computed.result.data}</pre>
          </button>
        </div>
      )}

      <div className="status-strip encoding-status-strip text-xs">
        <span className={isSuccess ? 'tone-success' : computed.type === 'empty' ? 'text-[color:var(--text-muted)]' : 'tone-danger'}>
          {statusLabel}
        </span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">{message}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">{getModeHint(mode, operation, variant)}</span>
      </div>
    </div>
  )
}
