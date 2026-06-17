import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'

// 扩展 dayjs 以支持严格格式解析和 UTC 偏移
dayjs.extend(customParseFormat)
dayjs.extend(utc)

// 默认日期格式
export const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const COMMON_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',
  'YYYY/MM/DD'
]
const MIN_REASONABLE_MILLIS = 946684800000
const MAX_REASONABLE_MILLIS = 4102444800000

// 输出格式模板
export type TimeFormatTemplate =
  | 'default'
  | 'slash'
  | 'iso'
  | 'rfc3339'
  | 'unix-seconds'
  | 'unix-millis'
  | 'custom'

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
  matchedInput?: string
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
  const parsed = parseNumericTimestamp(timestamp.trim())
  return parsed.valid
}

// 校验日期字符串是否有效（严格模式）
export function isValidDate(dateStr: string): boolean {
  return parseDateInput(dateStr).isValid()
}

// 解析固定 UTC 偏移
export function parseTimezoneOffset(value: string): TimezoneOffset | null {
  const trimmed = value.trim()
  if (trimmed === 'local' || trimmed === '本地') {
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

// 按模板格式化时间
export function formatTimeByTemplate(
  millis: number,
  template: TimeFormatTemplate,
  customFormat: string = DEFAULT_FORMAT
): string {
  if (template === 'unix-seconds') return String(Math.floor(millis / 1000))
  if (template === 'unix-millis') return String(millis)
  if (template === 'iso') return new Date(millis).toISOString()
  if (template === 'rfc3339') return dayjs(millis).format('YYYY-MM-DDTHH:mm:ssZ')
  if (template === 'slash') return dayjs(millis).format('YYYY/MM/DD HH:mm:ss')
  return dayjs(millis).format(template === 'custom' ? customFormat || DEFAULT_FORMAT : DEFAULT_FORMAT)
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

function isReasonableTimestampMillis(millis: number): boolean {
  return millis >= MIN_REASONABLE_MILLIS && millis <= MAX_REASONABLE_MILLIS
}

function createValidResult(
  source: string,
  kind: TimeInputKind,
  millis: number,
  offset: TimezoneOffset,
  nowMillis: number,
  matchedInput?: string
): SmartTimeResult {
  return {
    source,
    matchedInput,
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

function createInvalidResult(source: string, error: string): SmartTimeResult {
  return { source, kind: 'invalid', valid: false, error }
}

function parseNumericTimestamp(source: string): { valid: true; millis: number; kind: TimeInputKind } | { valid: false; error: string } {
  if (!/^\d+$/.test(source)) return { valid: false, error: '不是纯数字时间戳' }

  const number = Number(source)
  if (!Number.isFinite(number) || number <= 0) {
    return { valid: false, error: '时间戳必须是大于 0 的数字' }
  }

  const kind: TimeInputKind = source.length <= 10 ? 'timestamp-seconds' : 'timestamp-millis'
  const millis = kind === 'timestamp-seconds' ? number * 1000 : number

  if (!isReasonableTimestampMillis(millis)) {
    return {
      valid: false,
      error: '时间戳超出合理范围，请使用 2000-01-01 到 2100-01-01 之间的时间'
    }
  }

  if (![9, 10, 12, 13].includes(source.length)) {
    return {
      valid: false,
      error: '数字位数不常见，建议使用 10 位秒级或 13 位毫秒级时间戳'
    }
  }

  return { valid: true, millis, kind }
}

function parseDirectTimeSource(source: string, offset: TimezoneOffset, nowMillis: number): SmartTimeResult {
  if (!source) {
    return createInvalidResult(source, '输入为空')
  }

  if (source.toLowerCase() === 'now') {
    return createValidResult(source, 'now', nowMillis, offset, nowMillis)
  }

  if (/^\d+$/.test(source)) {
    const parsed = parseNumericTimestamp(source)
    return parsed.valid
      ? createValidResult(source, parsed.kind, parsed.millis, offset, nowMillis)
      : createInvalidResult(source, parsed.error)
  }

  const parsed = parseDateInput(source)
  if (parsed.isValid()) {
    return createValidResult(source, 'date', parsed.valueOf(), offset, nowMillis)
  }

  return createInvalidResult(source, '无法识别为时间戳、日期、ISO 字符串或 now')
}

function findTimeCandidate(source: string): string | null {
  const patterns = [
    /\b\d{13}\b/g,
    /\b\d{10}\b/g,
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
    /\b\d{4}[-/]\d{2}[-/]\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b/g
  ]

  for (const pattern of patterns) {
    const matches = source.match(pattern)
    if (matches?.[0]) return matches[0]
  }

  return null
}

// 智能解析单条输入
export function parseSmartTimeLine(input: string, offset: TimezoneOffset, nowMillis = Date.now()): SmartTimeResult {
  const source = input.trim()
  const direct = parseDirectTimeSource(source, offset, nowMillis)
  if (direct.valid || /^\d+$/.test(source) || !source) return direct

  const candidate = findTimeCandidate(source)
  if (!candidate) return direct

  const parsed = parseDirectTimeSource(candidate, offset, nowMillis)
  return parsed.valid
    ? { ...parsed, source, matchedInput: candidate }
    : direct
}

// 智能解析多行输入
export function parseSmartTimeInput(input: string, offset: TimezoneOffset, nowMillis = Date.now()): SmartTimeResult[] {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return lines.map((line) => parseSmartTimeLine(line, offset, nowMillis))
}
