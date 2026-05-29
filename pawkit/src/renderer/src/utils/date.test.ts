import { describe, expect, it } from 'vitest'
import {
  formatOffsetLabel,
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

  it('解析和格式化固定偏移', () => {
    expect(parseTimezoneOffset('UTC+8')?.minutes).toBe(480)
    expect(parseTimezoneOffset('-05:30')?.minutes).toBe(-330)
    expect(formatOffsetLabel(480)).toBe('UTC+08:00')
  })
})
