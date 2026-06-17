import { describe, expect, it } from 'vitest'
import {
  buildQrCodePayload,
  clearUnfavoriteQrCodeHistory,
  completeUrlProtocol,
  createQrCodeHistoryItem,
  defaultQrCodeStyle,
  detectQrCodeInput,
  isLikelyBareUrl,
  normalizeQrCodeStyle,
  removeQrCodeHistoryItem,
  toggleQrCodeFavorite,
  trimQrCodeHistory,
  upsertQrCodeHistory
} from './qrcode'

describe('二维码工具函数', () => {
  it('生成文本和 URL payload', () => {
    expect(buildQrCodePayload('text', { text: 'PawKit 二维码' })).toBe('PawKit 二维码')
    expect(buildQrCodePayload('url', { url: '  https://example.com  ' })).toBe('https://example.com')
  })

  it('生成 WiFi payload 并转义特殊字符', () => {
    const payload = buildQrCodePayload('wifi', {
      ssid: 'Paw;Kit',
      password: 'pa:ss,word',
      encryption: 'WPA',
      hidden: 'true'
    })

    expect(payload).toBe('WIFI:T:WPA;S:Paw\\;Kit;P:pa\\:ss\\,word;H:true;;')
  })

  it('生成 vCard payload 并保留中文', () => {
    const payload = buildQrCodePayload('vcard', {
      name: '噗噗',
      phone: '10086',
      email: 'hi@example.com',
      org: 'PawKit'
    })

    expect(payload).toContain('FN:噗噗')
    expect(payload).toContain('TEL:10086')
    expect(payload).not.toContain('\\u')
  })

  it('识别剪贴板 URL 和普通文本', () => {
    expect(detectQrCodeInput('https://example.com/a').template).toBe('url')
    expect(detectQrCodeInput('example.com/a').template).toBe('url')
    expect(detectQrCodeInput('PawKit 二维码').template).toBe('text')
    expect(isLikelyBareUrl('example.com')).toBe(true)
    expect(completeUrlProtocol('example.com')).toBe('https://example.com')
  })

  it('识别 WiFi 和 vCard 剪贴板内容', () => {
    const wifi = detectQrCodeInput('WIFI:T:WPA;S:Paw\\;Kit;P:pa\\:ss\\,word;H:true;;')
    expect(wifi.template).toBe('wifi')
    expect(wifi.fields.ssid).toBe('Paw;Kit')
    expect(wifi.fields.password).toBe('pa:ss,word')
    expect(wifi.fields.hidden).toBe('true')

    const vcard = detectQrCodeInput('BEGIN:VCARD\nVERSION:3.0\nFN:噗噗\nTEL:10086\nEMAIL:hi@example.com\nEND:VCARD')
    expect(vcard.template).toBe('vcard')
    expect(vcard.fields.name).toBe('噗噗')
    expect(vcard.fields.email).toBe('hi@example.com')
  })

  it('规整样式参数', () => {
    const style = normalizeQrCodeStyle({
      size: 64,
      margin: 99,
      darkColor: 'bad',
      lightColor: '#f8fafc',
      errorCorrectionLevel: 'H'
    })

    expect(style.size).toBe(128)
    expect(style.margin).toBe(8)
    expect(style.darkColor).toBe(defaultQrCodeStyle.darkColor)
    expect(style.lightColor).toBe('#f8fafc')
    expect(style.errorCorrectionLevel).toBe('H')
  })

  it('历史去重时保留收藏和创建时间', () => {
    const first = createQrCodeHistoryItem('text', { text: '同一个内容' }, defaultQrCodeStyle, '2024-01-01T00:00:00.000Z', 'a')
    const favorite = { ...first, favorite: true }
    const second = createQrCodeHistoryItem('text', { text: '同一个内容' }, defaultQrCodeStyle, '2024-01-02T00:00:00.000Z', 'b')
    const history = upsertQrCodeHistory([favorite], second, 50)

    expect(history).toHaveLength(1)
    expect(history[0].id).toBe('a')
    expect(history[0].favorite).toBe(true)
    expect(history[0].createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(history[0].updatedAt).toBe('2024-01-02T00:00:00.000Z')
  })

  it('历史上限裁剪并保留收藏', () => {
    const history = [
      { ...createQrCodeHistoryItem('text', { text: '1' }, defaultQrCodeStyle, '2024-01-01T00:00:00.000Z', '1'), favorite: true },
      createQrCodeHistoryItem('text', { text: '2' }, defaultQrCodeStyle, '2024-01-02T00:00:00.000Z', '2'),
      createQrCodeHistoryItem('text', { text: '3' }, defaultQrCodeStyle, '2024-01-03T00:00:00.000Z', '3')
    ]

    const trimmed = trimQrCodeHistory(history, 1)
    expect(trimmed.map((item) => item.id)).toEqual(['3', '1'])
  })

  it('支持收藏切换、删除和清空非收藏', () => {
    const history = [
      createQrCodeHistoryItem('text', { text: '保留' }, defaultQrCodeStyle, '2024-01-01T00:00:00.000Z', 'keep'),
      createQrCodeHistoryItem('text', { text: '删除' }, defaultQrCodeStyle, '2024-01-02T00:00:00.000Z', 'drop')
    ]

    const favored = toggleQrCodeFavorite(history, 'keep')
    expect(favored.find((item) => item.id === 'keep')?.favorite).toBe(true)
    expect(removeQrCodeHistoryItem(favored, 'drop')).toHaveLength(1)
    expect(clearUnfavoriteQrCodeHistory(favored).map((item) => item.id)).toEqual(['keep'])
  })
})
