import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

// 扩展 dayjs 以支持严格格式解析
dayjs.extend(customParseFormat)

// 默认日期格式
const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'

// 获取当前时间戳（秒）
export function getCurrentTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

// 获取当前时间戳（毫秒）
export function getCurrentTimestampMillis(): number {
  return Date.now()
}

// 获取当前时间字符串
export function getCurrentTimeString(format: string = DEFAULT_FORMAT): string {
  return dayjs().format(format)
}

// 时间戳转日期字符串
export function timestampToDate(timestamp: number, format: string = DEFAULT_FORMAT): string {
  // 自动判断秒级还是毫秒级
  const ts = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
  return dayjs(ts).format(format)
}

// 日期字符串转时间戳（严格模式）
export function dateToTimestamp(dateStr: string): { seconds: number; millis: number } | null {
  // 使用严格模式解析，确保日期值有效（如 2024-02-31 会被拒绝）
  const d = dayjs(dateStr, DEFAULT_FORMAT, true)
  if (!d.isValid()) {
    return null
  }
  // 额外校验：解析后的日期字符串应与输入一致（防止 dayjs 自动修正）
  const reformatted = d.format(DEFAULT_FORMAT)
  if (reformatted !== dateStr.trim()) {
    return null
  }
  return {
    seconds: Math.floor(d.valueOf() / 1000),
    millis: d.valueOf()
  }
}

// 校验时间戳是否有效
export function isValidTimestamp(timestamp: string): boolean {
  const num = Number(timestamp)
  if (isNaN(num)) {
    return false
  }
  // 检查是否是合理的毫秒级时间戳范围
  return num > 0 && num < 9999999999999
}

// 校验日期字符串是否有效（严格模式）
export function isValidDate(dateStr: string): boolean {
  // 使用严格模式解析
  const d = dayjs(dateStr, DEFAULT_FORMAT, true)
  if (!d.isValid()) {
    return false
  }
  // 额外校验：解析后的日期字符串应与输入一致
  const reformatted = d.format(DEFAULT_FORMAT)
  return reformatted === dateStr.trim()
}
