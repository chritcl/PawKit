import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'

// 扩展 dayjs 以支持严格格式解析和 UTC 偏移
dayjs.extend(customParseFormat)
dayjs.extend(utc)

// 默认日期格式
const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const COMMON_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',
  'YYYY/MM/DD'
]

// 智能时间输入类型
export type TimeInputKind = 'now' | 'timestamp-seconds' | 'timestamp-millis' | 'date' | 'invalid'

// 固定时区偏移
export interface TimezoneOffset {
  label: string
  minutes: number
}

// 单条时间解析结果
export interface SmartTimeResult {
  source: string
  kind: TimeInputKind
  valid: boolean
  millis?: number
  seconds?: number
  local?: string
  utc?: string
  offset?: string
  iso?: string
  relative?: string
  error?: string
}

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
  const ts = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
  return dayjs(ts).format(format)
}

// 日期字符串转时间戳（严格模式）
export function dateToTimestamp(dateStr: string): { seconds: number; millis: number } | null {
  const d = parseDateInput(dateStr)
  if (!d.isValid()) return null
  return {
    seconds: Math.floor(d.valueOf() / 1000),
    millis: d.valueOf()
  }
}

// 校验时间戳是否有效
export function isValidTimestamp(timestamp: string): boolean {
  const num = Number(timestamp)
  return Number.isFinite(num) && num > 0 && num < 9999999999999
}

// 校验日期字符串是否有效（严格模式）
export function isValidDate(dateStr: string): boolean {
  return parseDateInput(dateStr).isValid()
}

// 解析固定 UTC 偏移
export function parseTimezoneOffset(value: string): TimezoneOffset | null {
  const trimmed = value.trim()
  if (trimmed === 'local') {
    return {
      label: '本地',
      minutes: -new Date().getTimezoneOffset()
    }
  }
  if (trimmed === 'utc' || trimmed === 'UTC' || trimmed === 'Z') {
    return { label: 'UTC', minutes: 0 }
  }

  const match = trimmed.match(/^UTC?([+-])(\d{1,2})(?::?(\d{2}))?$/i) ?? trimmed.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return null

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? '0')
  if (hours > 14 || minutes > 59) return null

  const total = sign * (hours * 60 + minutes)
  return {
    label: formatOffsetLabel(total),
    minutes: total
  }
}

// 格式化偏移标签
export function formatOffsetLabel(minutes: number): string {
  if (minutes === 0) return 'UTC'
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const rest = abs % 60
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

// 解析常见日期输入
function parseDateInput(input: string): dayjs.Dayjs {
  const trimmed = input.trim()
  for (const format of COMMON_FORMATS) {
    const parsed = dayjs(trimmed, format, true)
    if (parsed.isValid()) return parsed
  }
  const parsed = dayjs(trimmed)
  return parsed.isValid() ? parsed : dayjs(NaN)
}

// 格式化固定偏移时间
export function formatWithOffset(millis: number, offsetMinutes: number): string {
  return `${dayjs.utc(millis).utcOffset(offsetMinutes).format(DEFAULT_FORMAT)} ${formatOffsetLabel(offsetMinutes)}`
}

// 生成相对时间描述
export function formatRelativeTime(millis: number, nowMillis = Date.now()): string {
  const diff = millis - nowMillis
  const abs = Math.abs(diff)
  const units = [
    { label: '天', size: 24 * 60 * 60 * 1000 },
    { label: '小时', size: 60 * 60 * 1000 },
    { label: '分钟', size: 60 * 1000 },
    { label: '秒', size: 1000 }
  ]
  const unit = units.find((item) => abs >= item.size) ?? units[units.length - 1]
  const value = Math.round(abs / unit.size)
  if (value === 0) return '就是现在'
  return diff >= 0 ? `${value}${unit.label}后` : `${value}${unit.label}前`
}

// 智能解析单条输入
export function parseSmartTimeLine(input: string, offset: TimezoneOffset, nowMillis = Date.now()): SmartTimeResult {
  const source = input.trim()
  if (!source) {
    return { source: input, kind: 'invalid', valid: false, error: '输入为空' }
  }

  let millis: number | null = null
  let kind: TimeInputKind = 'invalid'

  if (source.toLowerCase() === 'now') {
    millis = nowMillis
    kind = 'now'
  } else if (/^\d{10}$/.test(source)) {
    millis = Number(source) * 1000
    kind = 'timestamp-seconds'
  } else if (/^\d{13}$/.test(source)) {
    millis = Number(source)
    kind = 'timestamp-millis'
  } else if (/^\d+$/.test(source)) {
    const number = Number(source)
    if (number > 0 && number < 9999999999999) {
      millis = source.length <= 10 ? number * 1000 : number
      kind = source.length <= 10 ? 'timestamp-seconds' : 'timestamp-millis'
    }
  } else {
    const parsed = parseDateInput(source)
    if (parsed.isValid()) {
      millis = parsed.valueOf()
      kind = 'date'
    }
  }

  if (millis === null || !Number.isFinite(millis)) {
    return {
      source,
      kind: 'invalid',
      valid: false,
      error: '无法识别为时间戳、日期、ISO 字符串或 now'
    }
  }

  return {
    source,
    kind,
    valid: true,
    millis,
    seconds: Math.floor(millis / 1000),
    local: dayjs(millis).format(DEFAULT_FORMAT),
    utc: `${dayjs.utc(millis).format(DEFAULT_FORMAT)} UTC`,
    offset: formatWithOffset(millis, offset.minutes),
    iso: new Date(millis).toISOString(),
    relative: formatRelativeTime(millis, nowMillis)
  }
}

// 智能解析多行输入
export function parseSmartTimeInput(input: string, offset: TimezoneOffset, nowMillis = Date.now()): SmartTimeResult[] {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return lines.map((line) => parseSmartTimeLine(line, offset, nowMillis))
}
