import { useEffect, useState } from 'react'
import {
  getCurrentTimestampSeconds,
  getCurrentTimestampMillis,
  getCurrentTimeString,
  timestampToDate,
  dateToTimestamp,
  isValidTimestamp,
  isValidDate
} from '../../../utils/date'

// 时间戳工具组件
export function TimestampToolPage(): JSX.Element {
  // 当前时间
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString())
  const [currentTsSeconds, setCurrentTsSeconds] = useState(getCurrentTimestampSeconds())
  const [currentTsMillis, setCurrentTsMillis] = useState(getCurrentTimestampMillis())

  // 时间戳转日期
  const [tsInput, setTsInput] = useState('')
  const [tsResult, setTsResult] = useState<string | null>(null)
  const [tsError, setTsError] = useState<string | null>(null)

  // 日期转时间戳
  const [dateInput, setDateInput] = useState('')
  const [dateResult, setDateResult] = useState<{ seconds: number; millis: number } | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  // 自动刷新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeString())
      setCurrentTsSeconds(getCurrentTimestampSeconds())
      setCurrentTsMillis(getCurrentTimestampMillis())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 复制到剪贴板
  const handleCopy = async (text: string): Promise<void> => {
    await window.electronAPI.clipboard.writeText(text)
  }

  // 时间戳转日期
  const handleTsToDate = (): void => {
    if (!tsInput.trim()) {
      setTsError('请输入时间戳')
      setTsResult(null)
      return
    }
    if (!isValidTimestamp(tsInput)) {
      setTsError('无效的时间戳格式')
      setTsResult(null)
      return
    }
    const result = timestampToDate(Number(tsInput))
    setTsResult(result)
    setTsError(null)
  }

  // 日期转时间戳
  const handleDateToTs = (): void => {
    if (!dateInput.trim()) {
      setDateError('请输入日期')
      setDateResult(null)
      return
    }
    if (!isValidDate(dateInput)) {
      setDateError('无效的日期格式，请使用 YYYY-MM-DD HH:mm:ss')
      setDateResult(null)
      return
    }
    const result = dateToTimestamp(dateInput)
    if (result) {
      setDateResult(result)
      setDateError(null)
    } else {
      setDateError('转换失败')
      setDateResult(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 当前时间 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">当前时间</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <span className="text-gray-400">当前时间</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg">{currentTime}</span>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                onClick={() => handleCopy(currentTime)}
              >
                复制
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <span className="text-gray-400">秒级时间戳</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg">{currentTsSeconds}</span>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                onClick={() => handleCopy(String(currentTsSeconds))}
              >
                复制
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <span className="text-gray-400">毫秒级时间戳</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg">{currentTsMillis}</span>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                onClick={() => handleCopy(String(currentTsMillis))}
              >
                复制
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 时间戳转日期 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">时间戳转日期</h3>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={tsInput}
            onChange={(e) => setTsInput(e.target.value)}
            placeholder="输入时间戳（秒或毫秒）"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleTsToDate}
          >
            转换
          </button>
        </div>
        {tsError && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {tsError}
          </div>
        )}
        {tsResult && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <span className="text-gray-400">转换结果</span>
            <div className="flex items-center gap-3">
              <span className="font-mono">{tsResult}</span>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                onClick={() => handleCopy(tsResult)}
              >
                复制
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 日期转时间戳 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">日期转时间戳</h3>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            placeholder="输入日期（YYYY-MM-DD HH:mm:ss）"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
          <button
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={handleDateToTs}
          >
            转换
          </button>
        </div>
        {dateError && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {dateError}
          </div>
        )}
        {dateResult && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
              <span className="text-gray-400">秒级时间戳</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">{dateResult.seconds}</span>
                <button
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                  onClick={() => handleCopy(String(dateResult.seconds))}
                >
                  复制
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
              <span className="text-gray-400">毫秒级时间戳</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">{dateResult.millis}</span>
                <button
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
                  onClick={() => handleCopy(String(dateResult.millis))}
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
