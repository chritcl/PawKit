import { describe, expect, it } from 'vitest'
import {
  buildQrCodePayload,
  clearUnfavoriteQrCodeHistory,
  createQrCodeHistoryItem,
  defaultQrCodeStyle,
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
