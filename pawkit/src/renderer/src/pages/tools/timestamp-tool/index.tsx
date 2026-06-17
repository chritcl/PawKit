import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowLeftRight,
  Braces,
  Check,
  Clock3,
  Clipboard,
  Copy,
  FileJson,
  RotateCcw,
  ScanText,
  Table2,
  TimerReset
} from 'lucide-react'
import {
  SmartTimeResult,
  TimeFormatTemplate,
  formatOffsetLabel,
  formatTimeByTemplate,
  formatWithOffset,
  getCurrentTimestampMillis,
  getCurrentTimestampSeconds,
  parseSmartTimeInput,
  parseTimezoneOffset
} from '../../../utils/date'

type WorkMode = 'single' | 'batch' | 'timezone' | 'template'

interface ModeItem {
  mode: WorkMode
  label: string
}

interface FormatItem {
  template: TimeFormatTemplate
  label: string
  description: string
}

const modeItems: ModeItem[] = [
  { mode: 'single', label: '单次转换' },
  { mode: 'batch', label: '批量转换' },
  { mode: 'timezone', label: '时区对照' },
  { mode: 'template', label: '格式模板' }
]

const offsetPresets = [
  { label: '本地', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: 'UTC+08:00', value: 'UTC+08:00' },
  { label: 'UTC-05:00', value: 'UTC-05:00' }
]

const formatItems: FormatItem[] = [
  { template: 'default', label: '标准', description: 'YYYY-MM-DD HH:mm:ss' },
  { template: 'slash', label: '斜杠', description: 'YYYY/MM/DD HH:mm:ss' },
  { template: 'iso', label: 'ISO', description: 'toISOString' },
  { template: 'rfc3339', label: 'RFC 3339', description: 'YYYY-MM-DDTHH:mm:ssZ' },
  { template: 'unix-seconds', label: 'Unix 秒', description: '10 位秒级时间戳' },
  { template: 'unix-millis', label: 'Unix 毫秒', description: '13 位毫秒级时间戳' },
  { template: 'custom', label: '自定义', description: 'dayjs 格式模板' }
]

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

function firstInputLine(input: string): string {
  return input.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
}

function createResultText(result: SmartTimeResult, offsetLabel: string): string {
  if (!result.valid) return ''
  return [
    `原始输入：${result.source}`,
    result.matchedInput ? `命中内容：${result.matchedInput}` : '',
    `类型：${kindLabel(result.kind)}`,
    `秒级时间戳：${result.seconds}`,
    `毫秒级时间戳：${result.millis}`,
    `本地时间：${result.local}`,
    `UTC：${result.utc}`,
    `${offsetLabel}：${result.offset}`,
    `ISO：${result.iso}`,
    `相对时间：${result.relative}`
  ].filter(Boolean).join('\n')
}

function createTableText(results: SmartTimeResult[], offsetLabel: string): string {
  const rows = results.filter((result) => result.valid).map((result) => [
    result.source,
    result.matchedInput ?? result.source,
    kindLabel(result.kind),
    result.seconds,
    result.millis,
    result.local,
    result.utc,
    result.offset,
    result.iso,
    result.relative
  ].join('\t'))

  return [
    ['原始输入', '命中内容', '类型', '秒级时间戳', '毫秒级时间戳', '本地时间', 'UTC', offsetLabel, 'ISO', '相对时间'].join('\t'),
    ...rows
  ].join('\n')
}

function createJsonText(results: SmartTimeResult[], offsetLabel: string): string {
  return JSON.stringify(results.filter((result) => result.valid).map((result) => ({
    原始输入: result.source,
    命中内容: result.matchedInput ?? result.source,
    类型: kindLabel(result.kind),
    秒级时间戳: result.seconds,
    毫秒级时间戳: result.millis,
    本地时间: result.local,
    UTC: result.utc,
    [offsetLabel]: result.offset,
    ISO: result.iso,
    相对时间: result.relative
  })), null, 2)
}

// 时间戳调试工作台
export function TimestampToolPage(): JSX.Element {
  const [mode, setMode] = useState<WorkMode>('single')
  const [input, setInput] = useState('now')
  const [offsetText, setOffsetText] = useState('UTC+08:00')
  const [nowMillis, setNowMillis] = useState(getCurrentTimestampMillis())
  const [message, setMessage] = useState('等待输入')
  const [copiedKey, setCopiedKey] = useState('')
  const [formatTemplate, setFormatTemplate] = useState<TimeFormatTemplate>('default')
  const [customFormat, setCustomFormat] = useState('YYYY-MM-DD HH:mm:ss')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMillis(getCurrentTimestampMillis())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!copiedKey) return
    const timer = window.setTimeout(() => setCopiedKey(''), 1200)
    return () => window.clearTimeout(timer)
  }, [copiedKey])

  const defaultOffset = useMemo(() => parseTimezoneOffset('UTC+08:00')!, [])
  const parsedOffset = useMemo(() => parseTimezoneOffset(offsetText), [offsetText])
  const offset = parsedOffset ?? defaultOffset
  const offsetInvalid = !parsedOffset
  const parseInput = mode === 'single' ? firstInputLine(input) : input
  const results = useMemo(() => parseSmartTimeInput(parseInput, offset, nowMillis), [parseInput, offset, nowMillis])
  const validResults = useMemo(() => results.filter((result) => result.valid), [results])
  const firstValid = validResults[0]
  const validCount = validResults.length
  const totalCount = results.length

  const currentItems = useMemo(() => [
    { key: 'local-now', label: '本地时间', value: formatTimeByTemplate(nowMillis, 'default') },
    { key: 'seconds-now', label: 'Unix 秒', value: String(Math.floor(nowMillis / 1000)) },
    { key: 'millis-now', label: 'Unix 毫秒', value: String(nowMillis) },
    { key: 'iso-now', label: 'ISO', value: new Date(nowMillis).toISOString() },
    { key: 'utc-now', label: 'UTC', value: formatWithOffset(nowMillis, 0) }
  ], [nowMillis])

  const timezoneRows = useMemo(() => {
    const baseRows = offsetPresets.map((item) => parseTimezoneOffset(item.value)!)
    const hasCurrent = baseRows.some((item) => item.label === offset.label && item.minutes === offset.minutes)
    return hasCurrent ? baseRows : [...baseRows, offset]
  }, [offset])

  const selectedFormatItem = formatItems.find((item) => item.template === formatTemplate) ?? formatItems[0]

  const markCopied = (key: string): void => {
    setCopiedKey(key)
  }

  const copyText = async (text: string, nextMessage = '已复制', key = ''): Promise<void> => {
    if (!text) {
      setMessage('没有可复制内容')
      return
    }
    await window.electronAPI.clipboard.writeText(text)
    setMessage(nextMessage)
    if (key) markCopied(key)
  }

  const copyResult = async (result: SmartTimeResult): Promise<void> => {
    if (!result.valid) return
    await copyText(createResultText(result, offset.label), '转换结果已复制', `result-${result.source}`)
  }

  const pasteInput = async (): Promise<void> => {
    const text = await window.electronAPI.clipboard.readText()
    setInput(text)
    if (text.split(/\r?\n/).filter((line) => line.trim()).length > 1) setMode('batch')
    setMessage('已从剪贴板粘贴')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const fillNow = (): void => {
    setInput('now')
    setMode('single')
    setMessage('已填入 now')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const fillExample = (): void => {
    setInput([
      'now',
      String(getCurrentTimestampSeconds()),
      String(getCurrentTimestampMillis()),
      '2024-01-02 03:04:05',
      '[INFO] completedAt=2024-01-02T03:04:05.000Z request_id=pk_123'
    ].join('\n'))
    setMode('batch')
    setMessage('已填充示例')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const clearInput = (): void => {
    setInput('')
    setMessage('已清空')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const replaceWithFirstIso = (): void => {
    if (!firstValid?.iso) {
      setMessage('没有可交换的有效结果')
      return
    }
    setInput(firstValid.iso)
    setMode('single')
    setMessage('已用首条 ISO 替换输入')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const copyAllIso = async (): Promise<void> => {
    await copyText(validResults.map((item) => item.iso).filter(Boolean).join('\n'), '全部 ISO 已复制', 'copy-all-iso')
  }

  const copyAllTable = async (): Promise<void> => {
    await copyText(createTableText(validResults, offset.label), '表格结果已复制', 'copy-all-table')
  }

  const copyAllJson = async (): Promise<void> => {
    await copyText(createJsonText(validResults, offset.label), 'JSON 片段已复制', 'copy-all-json')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault()
      if (firstValid) void copyResult(firstValid)
      else setMessage('没有可复制的有效结果')
      return
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      clearInput()
      return
    }
    if (event.key === 'Escape') {
      setMessage('就绪')
    }
  }

  const renderResultPanel = (): JSX.Element => (
    <section className="editor-surface tool-panel timestamp-result-panel">
      <div className="panel-header timestamp-panel-header">
        <div className="timestamp-panel-title">
          <span>转换结果</span>
          <span className="text-xs text-[color:var(--text-muted)]">有效 {validCount} / {totalCount}</span>
        </div>
        <div className="action-cluster-tight">
          <button className="toolbar-button timestamp-mini-button" disabled={validCount === 0} onClick={() => void copyAllIso()} title="复制全部 ISO">
            <Copy className="h-3.5 w-3.5" />
            ISO
          </button>
          <button className="toolbar-button timestamp-mini-button" disabled={validCount === 0} onClick={() => void copyAllTable()} title="复制为表格文本">
            <Table2 className="h-3.5 w-3.5" />
            表格
          </button>
          <button className="toolbar-button timestamp-mini-button" disabled={validCount === 0} onClick={() => void copyAllJson()} title="复制为 JSON 片段">
            <Braces className="h-3.5 w-3.5" />
            JSON
          </button>
        </div>
      </div>

      <div className="panel-body timestamp-result-scroll">
        {results.length === 0 ? (
          <div className="empty-state timestamp-empty-state">
            <Clock3 className="h-9 w-9" />
            <strong>粘贴时间戳或日期开始转换</strong>
            <button className="toolbar-button-primary" onClick={fillExample}><ScanText className="h-4 w-4" />示例</button>
          </div>
        ) : (
          <div className="timestamp-result-list">
            {results.map((result, index) => (
              <div key={`${result.source}-${index}`} className={`timestamp-result-card ${result.valid ? '' : 'tone-surface-danger'}`}>
                <div className="timestamp-result-head">
                  <div className="timestamp-result-source">
                    {result.valid ? <Check className="h-4 w-4 tone-success" /> : <Clock3 className="h-4 w-4 tone-danger" />}
                    <span className="font-mono">{result.source}</span>
                    <span className="chip">{kindLabel(result.kind)}</span>
                    {result.matchedInput && <span className="chip font-mono">命中 {result.matchedInput}</span>}
                  </div>
                  <button
                    className={`icon-button h-7 min-h-7 w-7 min-w-7 disabled:opacity-30 ${copiedKey === `result-${result.source}` ? 'tone-success' : ''}`}
                    disabled={!result.valid}
                    onClick={() => void copyResult(result)}
                    title="复制本条完整结果"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                {result.valid ? (
                  <>
                    <div className="timestamp-primary-grid">
                      <button className="timestamp-value-button" onClick={() => void copyText(String(result.seconds), '秒级时间戳已复制', `seconds-${index}`)}>
                        <span>秒</span>
                        <strong>{result.seconds}</strong>
                      </button>
                      <button className="timestamp-value-button" onClick={() => void copyText(String(result.millis), '毫秒级时间戳已复制', `millis-${index}`)}>
                        <span>毫秒</span>
                        <strong>{result.millis}</strong>
                      </button>
                      <button className="timestamp-value-button timestamp-value-wide" onClick={() => void copyText(result.local ?? '', '本地时间已复制', `local-${index}`)}>
                        <span>本地</span>
                        <strong>{result.local}</strong>
                      </button>
                    </div>
                    <details className="timestamp-detail">
                      <summary>更多格式与相对时间</summary>
                      <div className="timestamp-detail-grid">
                        <button className="copy-row" onClick={() => void copyText(result.utc ?? '', 'UTC 时间已复制')}>
                          <span>UTC</span>
                          <span className="font-mono">{result.utc}</span>
                        </button>
                        <button className="copy-row" onClick={() => void copyText(result.offset ?? '', `${formatOffsetLabel(offset.minutes)} 时间已复制`)}>
                          <span>{offset.label}</span>
                          <span className="font-mono">{result.offset}</span>
                        </button>
                        <button className="copy-row" onClick={() => void copyText(result.iso ?? '', 'ISO 时间已复制')}>
                          <span>ISO</span>
                          <span className="font-mono">{result.iso}</span>
                        </button>
                        <div className="compact-row text-[color:var(--text-secondary)]">{result.relative}</div>
                      </div>
                    </details>
                  </>
                ) : (
                  <div className="timestamp-error-text">{result.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )

  const renderTimezonePanel = (): JSX.Element => (
    <section className="editor-surface tool-panel timestamp-result-panel">
      <div className="panel-header">
        <div className="timestamp-panel-title">
          <span>时区对照</span>
          <span className="text-xs text-[color:var(--text-muted)]">{firstValid ? '基于首条有效结果' : '等待有效输入'}</span>
        </div>
      </div>
      <div className="panel-body timestamp-result-scroll">
        {!firstValid ? (
          <div className="empty-state timestamp-empty-state">
            <Clock3 className="h-9 w-9" />
            <strong>输入一个有效时间后查看时区对照</strong>
          </div>
        ) : (
          <div className="timestamp-timezone-list">
            {timezoneRows.map((item) => {
              const value = formatWithOffset(firstValid.millis!, item.minutes)
              return (
                <button key={`${item.label}-${item.minutes}`} className="timestamp-timezone-row" onClick={() => void copyText(value, `${item.label} 时间已复制`)}>
                  <span>{item.label}</span>
                  <strong className="font-mono">{value}</strong>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )

  const renderTemplatePanel = (): JSX.Element => (
    <section className="editor-surface tool-panel timestamp-result-panel">
      <div className="panel-header">
        <div className="timestamp-panel-title">
          <span>格式模板</span>
          <span className="text-xs text-[color:var(--text-muted)]">{selectedFormatItem.description}</span>
        </div>
      </div>
      <div className="panel-body timestamp-result-scroll">
        <div className="timestamp-template-picker">
          {formatItems.map((item) => (
            <button
              key={item.template}
              className={`segmented-item ${formatTemplate === item.template ? 'segmented-item-active' : ''}`}
              onClick={() => setFormatTemplate(item.template)}
              title={item.description}
            >
              {item.label}
            </button>
          ))}
        </div>
        {formatTemplate === 'custom' && (
          <input
            className="field-input timestamp-custom-format font-mono text-sm"
            value={customFormat}
            onChange={(event) => setCustomFormat(event.target.value)}
            placeholder="YYYY-MM-DD HH:mm:ss"
          />
        )}

        {validResults.length === 0 ? (
          <div className="empty-state timestamp-empty-state timestamp-template-empty">
            <FileJson className="h-9 w-9" />
            <strong>输入有效时间后生成模板结果</strong>
          </div>
        ) : (
          <div className="timestamp-template-list">
            {validResults.map((result, index) => {
              const formatted = formatTimeByTemplate(result.millis!, formatTemplate, customFormat)
              return (
                <button key={`${result.source}-${index}`} className="timestamp-template-row" onClick={() => void copyText(formatted, '模板结果已复制')}>
                  <span className="font-mono">{result.matchedInput ?? result.source}</span>
                  <strong className="font-mono">{formatted}</strong>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )

  return (
    <div className="tool-page timestamp-tool-page" onKeyDown={handleKeyDown}>
      <div className="timestamp-current-grid">
        {currentItems.map((item) => (
          <button
            key={item.key}
            className={`timestamp-current-card ${copiedKey === item.key ? 'timestamp-copied-card' : ''}`}
            onClick={() => void copyText(item.value, `${item.label} 已复制`, item.key)}
            title={`复制${item.label}`}
          >
            <span>{item.label}</span>
            <strong className="font-mono">{item.value}</strong>
          </button>
        ))}
      </div>

      <div className="toolbar-surface timestamp-toolbar">
        <div className="timestamp-toolbar-main">
          <div className="segmented-control segmented-scroll">
            {modeItems.map((item) => (
              <button
                key={item.mode}
                className={`segmented-item ${mode === item.mode ? 'segmented-item-active' : ''}`}
                onClick={() => setMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="action-cluster-tight">
            <button className="toolbar-button-primary" onClick={pasteInput} title="粘贴剪贴板内容">
              <Clipboard className="h-4 w-4" />
              粘贴
            </button>
            <button className="toolbar-button" onClick={fillNow} title="填入当前时间">
              <TimerReset className="h-4 w-4" />
              now
            </button>
            <button className="toolbar-button" onClick={fillExample} title="填充示例">
              <ScanText className="h-4 w-4" />
              示例
            </button>
            <button className="toolbar-button" disabled={!firstValid} onClick={replaceWithFirstIso} title="用首条 ISO 替换输入">
              <ArrowLeftRight className="h-4 w-4" />
              交换
            </button>
            <button className="toolbar-button" onClick={clearInput} title="清空">
              <RotateCcw className="h-4 w-4" />
              清空
            </button>
          </div>
        </div>

        <div className="timestamp-offset-area">
          <div className="timestamp-offset-presets">
            {offsetPresets.map((item) => (
              <button
                key={item.value}
                className={`segmented-item ${offsetText === item.value ? 'segmented-item-active' : ''}`}
                onClick={() => setOffsetText(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            value={offsetText}
            onChange={(event) => setOffsetText(event.target.value)}
            className={`field-input timestamp-offset-input font-mono text-sm ${offsetInvalid ? 'timestamp-field-invalid' : ''}`}
            placeholder="UTC+08:00"
            title="自定义固定偏移，例如 UTC+08:00"
          />
        </div>
      </div>

      <div className="tool-workspace tool-grid-editor timestamp-workspace">
        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <div className="timestamp-panel-title">
              <span>智能输入</span>
              <span className="text-xs text-[color:var(--text-muted)]">
                {mode === 'single' ? '单次模式只转换第一条有效输入' : '支持多行和日志片段'}
              </span>
            </div>
            <span className="text-xs text-[color:var(--text-muted)]">{new Blob([input]).size} bytes</span>
          </div>
          <textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入时间戳、日期、ISO 字符串、now，或粘贴包含时间的日志行..."
            className="editor-textarea timestamp-input"
          />
        </section>

        {mode === 'timezone' ? renderTimezonePanel() : mode === 'template' ? renderTemplatePanel() : renderResultPanel()}
      </div>

      <div className="status-strip timestamp-status-strip">
        <span className={message.includes('复制') || message.includes('填') || message.includes('清') || message.includes('粘贴') ? 'tone-success' : 'text-[color:var(--text-muted)]'}>
          {message}
        </span>
        <span>有效 {validCount} / {totalCount}</span>
        <span className={offsetInvalid ? 'tone-danger' : 'text-[color:var(--text-secondary)]'}>
          {offsetInvalid ? '固定偏移无效，已临时使用 UTC+08:00' : `固定偏移：${offset.label}`}
        </span>
        <button disabled={validCount === 0} onClick={() => void copyAllIso()}>
          <Copy className="h-3.5 w-3.5" />
          复制全部 ISO
        </button>
      </div>
    </div>
  )
}
