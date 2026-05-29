import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Clipboard, Copy, RotateCcw, TimerReset } from 'lucide-react'
import {
  SmartTimeResult,
  formatOffsetLabel,
  getCurrentTimestampMillis,
  getCurrentTimestampSeconds,
  getCurrentTimeString,
  parseSmartTimeInput,
  parseTimezoneOffset
} from '../../../utils/date'

const quickInputs = ['now', String(getCurrentTimestampSeconds()), String(getCurrentTimestampMillis())]

function kindLabel(kind: SmartTimeResult['kind']): string {
  switch (kind) {
    case 'now':
      return '当前时间'
    case 'timestamp-seconds':
      return '秒级时间戳'
    case 'timestamp-millis':
      return '毫秒级时间戳'
    case 'date':
      return '日期文本'
    default:
      return '无效输入'
  }
}

// 时间戳工具组件
export function TimestampToolPage(): JSX.Element {
  const [input, setInput] = useState('now')
  const [offsetText, setOffsetText] = useState('UTC+08:00')
  const [nowMillis, setNowMillis] = useState(getCurrentTimestampMillis())
  const [message, setMessage] = useState('等待输入')

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMillis(getCurrentTimestampMillis())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const offset = useMemo(() => parseTimezoneOffset(offsetText) ?? parseTimezoneOffset('UTC+08:00')!, [offsetText])
  const results = useMemo(() => parseSmartTimeInput(input, offset, nowMillis), [input, offset, nowMillis])
  const validCount = results.filter((result) => result.valid).length

  const copyText = async (text: string, nextMessage = '已复制'): Promise<void> => {
    await window.electronAPI.clipboard.writeText(text)
    setMessage(nextMessage)
  }

  const copyResult = async (result: SmartTimeResult): Promise<void> => {
    if (!result.valid) return
    await copyText([
      `原始输入：${result.source}`,
      `秒级时间戳：${result.seconds}`,
      `毫秒级时间戳：${result.millis}`,
      `本地时间：${result.local}`,
      `UTC：${result.utc}`,
      `${offset.label}：${result.offset}`,
      `ISO：${result.iso}`,
      `相对时间：${result.relative}`
    ].join('\n'), '转换结果已复制')
  }

  const fillNow = (): void => {
    setInput('now')
    setMessage('已填入 now')
  }

  const clearInput = (): void => {
    setInput('')
    setMessage('已清空')
  }

  return (
    <div className="tool-page">
      <div className="data-grid">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
            <Clock3 className="h-4 w-4 text-[rgb(var(--color-primary-rgb))]" />
            当前本地时间
          </div>
          <div className="mt-2 font-mono text-xl text-[color:var(--text-primary)]">{getCurrentTimeString()}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-[color:var(--text-muted)]">秒级时间戳</div>
          <button className="mt-2 font-mono text-xl text-[color:var(--text-primary)] hover:text-[rgb(var(--color-primary-rgb))]" onClick={() => void copyText(String(getCurrentTimestampSeconds()), '秒级时间戳已复制')}>
            {getCurrentTimestampSeconds()}
          </button>
        </div>
        <div className="stat-card">
          <div className="text-sm text-[color:var(--text-muted)]">毫秒级时间戳</div>
          <button className="mt-2 font-mono text-xl text-[color:var(--text-primary)] hover:text-[rgb(var(--color-primary-rgb))]" onClick={() => void copyText(String(nowMillis), '毫秒级时间戳已复制')}>
            {nowMillis}
          </button>
        </div>
      </div>

      <div className="toolbar-surface tool-toolbar">
        <button className="toolbar-button-primary" onClick={fillNow} title="填入当前时间">
          <TimerReset className="h-4 w-4" />
          now
        </button>
        {quickInputs.slice(1).map((item) => (
          <button key={item} className="toolbar-button font-mono" onClick={() => setInput(item)}>
            {item}
          </button>
        ))}
        <div className="toolbar-group toolbar-push">
          <span className="text-sm text-[color:var(--text-muted)]">固定偏移</span>
          <input
            value={offsetText}
            onChange={(event) => setOffsetText(event.target.value)}
            className="field-input w-32 font-mono text-sm"
            placeholder="UTC+08:00"
          />
          <button className="toolbar-button" onClick={clearInput} title="清空">
            <RotateCcw className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="tool-workspace tool-grid-editor">
        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>智能输入</span>
            <span className="text-xs text-[color:var(--text-muted)]">支持多行</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入时间戳、日期、ISO 字符串或 now..."
            className="editor-textarea"
          />
        </section>

        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>转换结果</span>
            <span className="text-xs text-[color:var(--text-muted)]">有效 {validCount} / {results.length}</span>
          </div>
          <div className="panel-body overflow-auto p-3">
            {results.length === 0 ? (
              <div className="empty-state text-sm">
                输入内容后实时转换
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={`${result.source}-${index}`} className={`rounded-[10px] border p-3 ${result.valid ? 'border-[var(--glass-border)] bg-[var(--glass-muted)]' : 'border-red-500/20 bg-red-500/10'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {result.valid ? <Check className="h-4 w-4 text-emerald-300" /> : <Clock3 className="h-4 w-4 text-red-300" />}
                        <span className="font-mono text-sm text-[color:var(--text-primary)]">{result.source}</span>
                        <span className="chip">{kindLabel(result.kind)}</span>
                      </div>
                      <button className="icon-button h-7 min-h-7 w-7 min-w-7 disabled:opacity-30" disabled={!result.valid} onClick={() => void copyResult(result)} title="复制本条结果">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {result.valid ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs xl:grid-cols-2">
                        <button className="copy-row" onClick={() => void copyText(String(result.seconds), '秒级时间戳已复制')}>
                          <span className="text-[color:var(--text-muted)]">秒</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.seconds}</span>
                        </button>
                        <button className="copy-row" onClick={() => void copyText(String(result.millis), '毫秒级时间戳已复制')}>
                          <span className="text-[color:var(--text-muted)]">毫秒</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.millis}</span>
                        </button>
                        <button className="copy-row" onClick={() => void copyText(result.local ?? '', '本地时间已复制')}>
                          <span className="text-[color:var(--text-muted)]">本地</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.local}</span>
                        </button>
                        <button className="copy-row" onClick={() => void copyText(result.utc ?? '', 'UTC 时间已复制')}>
                          <span className="text-[color:var(--text-muted)]">UTC</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.utc}</span>
                        </button>
                        <button className="copy-row xl:col-span-2" onClick={() => void copyText(result.offset ?? '', `${formatOffsetLabel(offset.minutes)} 时间已复制`)}>
                          <span className="text-[color:var(--text-muted)]">{offset.label}</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.offset}</span>
                        </button>
                        <button className="copy-row xl:col-span-2" onClick={() => void copyText(result.iso ?? '', 'ISO 时间已复制')}>
                          <span className="text-[color:var(--text-muted)]">ISO</span>
                          <span className="font-mono text-[color:var(--text-secondary)]">{result.iso}</span>
                        </button>
                        <div className="compact-row xl:col-span-2 text-[color:var(--text-secondary)]">
                          {result.relative}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-red-300">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="status-strip flex items-center gap-3 text-xs">
        <span className="text-emerald-300">{message}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">固定偏移：{offset.label}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <button className="inline-flex items-center gap-1 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]" onClick={() => void copyText(results.filter((item) => item.valid).map((item) => item.iso).join('\n'), '全部 ISO 已复制')}>
          <Clipboard className="h-3.5 w-3.5" />
          复制全部 ISO
        </button>
      </div>
    </div>
  )
}
