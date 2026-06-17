import { describe, expect, it } from 'vitest'
import {
  formatTimeByTemplate,
  formatOffsetLabel,
  isValidTimestamp,
  parseSmartTimeInput,
  parseSmartTimeLine,
  parseTimezoneOffset
} from './date'

describe('时间戳智能转换', () => {
  const offset = parseTimezoneOffset('UTC+08:00')!
  const now = 1700000000000

  it('识别 now', () => {
    const result = parseSmartTimeLine('now', offset, now)

    expect(result.valid).toBe(true)
    expect(result.kind).toBe('now')
    expect(result.millis).toBe(now)
  })

  it('识别秒级和毫秒级时间戳', () => {
    expect(parseSmartTimeLine('1700000000', offset, now).millis).toBe(1700000000000)
    expect(parseSmartTimeLine('1700000000000', offset, now).seconds).toBe(1700000000)
  })

  it('识别常见日期和 ISO 字符串', () => {
    expect(parseSmartTimeLine('2024-01-02 03:04:05', offset, now).valid).toBe(true)
    expect(parseSmartTimeLine('2024-01-02T03:04:05.000Z', offset, now).valid).toBe(true)
  })

  it('支持多行输入', () => {
    const results = parseSmartTimeInput('now\n1700000000\nbad', offset, now)

    expect(results).toHaveLength(3)
    expect(results[2].valid).toBe(false)
  })

  it('从日志片段中识别时间内容', () => {
    const result = parseSmartTimeLine('[INFO] completedAt=2024-01-02T03:04:05.000Z request_id=pk_123', offset, now)

    expect(result.valid).toBe(true)
    expect(result.matchedInput).toBe('2024-01-02T03:04:05.000Z')
  })

  it('拒绝不合理的纯数字输入', () => {
    const result = parseSmartTimeLine('123456', offset, now)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('合理范围')
    expect(isValidTimestamp('123456')).toBe(false)
  })

  it('解析和格式化固定偏移', () => {
    expect(parseTimezoneOffset('UTC+8')?.minutes).toBe(480)
    expect(parseTimezoneOffset('-05:30')?.minutes).toBe(-330)
    expect(parseTimezoneOffset('本地')?.label).toBe('本地')
    expect(formatOffsetLabel(480)).toBe('UTC+08:00')
  })

  it('按格式模板输出时间', () => {
    expect(formatTimeByTemplate(now, 'unix-seconds')).toBe('1700000000')
    expect(formatTimeByTemplate(now, 'unix-millis')).toBe('1700000000000')
    expect(formatTimeByTemplate(now, 'iso')).toBe(new Date(now).toISOString())
  })
})
