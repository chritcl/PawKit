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
    <div className="flex h-full min-h-[600px] flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock3 className="h-4 w-4 text-[#1677ff]" />
            当前本地时间
          </div>
          <div className="mt-2 font-mono text-xl text-white">{getCurrentTimeString()}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm text-gray-400">秒级时间戳</div>
          <button className="mt-2 font-mono text-xl text-white hover:text-[#69a8ff]" onClick={() => void copyText(String(getCurrentTimestampSeconds()), '秒级时间戳已复制')}>
            {getCurrentTimestampSeconds()}
          </button>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm text-gray-400">毫秒级时间戳</div>
          <button className="mt-2 font-mono text-xl text-white hover:text-[#69a8ff]" onClick={() => void copyText(String(nowMillis), '毫秒级时间戳已复制')}>
            {nowMillis}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1677ff] px-3 text-sm font-medium text-white hover:bg-[#2f86ff]" onClick={fillNow} title="填入当前时间">
          <TimerReset className="h-4 w-4" />
          now
        </button>
        {quickInputs.slice(1).map((item) => (
          <button key={item} className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/5 px-3 font-mono text-sm text-gray-200 hover:bg-white/10" onClick={() => setInput(item)}>
            {item}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400">固定偏移</span>
          <input
            value={offsetText}
            onChange={(event) => setOffsetText(event.target.value)}
            className="h-10 w-32 rounded-md border border-white/10 bg-white/5 px-3 font-mono text-sm text-gray-200 outline-none focus:border-[#1677ff]/60"
            placeholder="UTC+08:00"
          />
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={clearInput} title="清空">
            <RotateCcw className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(300px,0.45fr)_minmax(420px,1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>智能输入</span>
            <span className="text-xs text-gray-500">支持多行</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入时间戳、日期、ISO 字符串或 now..."
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-sm text-gray-100 outline-none placeholder:text-gray-600"
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>转换结果</span>
            <span className="text-xs text-gray-500">有效 {validCount} / {results.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {results.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                输入内容后实时转换
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={`${result.source}-${index}`} className={`rounded-md border p-3 ${result.valid ? 'border-white/10 bg-black/20' : 'border-red-500/20 bg-red-500/10'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {result.valid ? <Check className="h-4 w-4 text-emerald-300" /> : <Clock3 className="h-4 w-4 text-red-300" />}
                        <span className="font-mono text-sm text-white">{result.source}</span>
                        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-400">{kindLabel(result.kind)}</span>
                      </div>
                      <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30" disabled={!result.valid} onClick={() => void copyResult(result)} title="复制本条结果">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {result.valid ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <button className="flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(String(result.seconds), '秒级时间戳已复制')}>
                          <span className="text-gray-500">秒</span>
                          <span className="font-mono text-gray-200">{result.seconds}</span>
                        </button>
                        <button className="flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(String(result.millis), '毫秒级时间戳已复制')}>
                          <span className="text-gray-500">毫秒</span>
                          <span className="font-mono text-gray-200">{result.millis}</span>
                        </button>
                        <button className="flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(result.local ?? '', '本地时间已复制')}>
                          <span className="text-gray-500">本地</span>
                          <span className="font-mono text-gray-200">{result.local}</span>
                        </button>
                        <button className="flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(result.utc ?? '', 'UTC 时间已复制')}>
                          <span className="text-gray-500">UTC</span>
                          <span className="font-mono text-gray-200">{result.utc}</span>
                        </button>
                        <button className="col-span-2 flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(result.offset ?? '', `${formatOffsetLabel(offset.minutes)} 时间已复制`)}>
                          <span className="text-gray-500">{offset.label}</span>
                          <span className="font-mono text-gray-200">{result.offset}</span>
                        </button>
                        <button className="col-span-2 flex justify-between rounded bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]" onClick={() => void copyText(result.iso ?? '', 'ISO 时间已复制')}>
                          <span className="text-gray-500">ISO</span>
                          <span className="font-mono text-gray-200">{result.iso}</span>
                        </button>
                        <div className="col-span-2 rounded bg-white/[0.04] px-3 py-2 text-gray-300">
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

      <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-xs">
        <span className="text-emerald-300">{message}</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">固定偏移：{offset.label}</span>
        <span className="text-gray-600">|</span>
        <button className="inline-flex items-center gap-1 text-gray-400 hover:text-white" onClick={() => void copyText(results.filter((item) => item.valid).map((item) => item.iso).join('\n'), '全部 ISO 已复制')}>
          <Clipboard className="h-3.5 w-3.5" />
          复制全部 ISO
        </button>
      </div>
    </div>
  )
}
