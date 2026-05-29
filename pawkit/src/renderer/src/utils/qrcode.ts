import {
  QrCodeErrorCorrectionLevel,
  QrCodeHistoryItem,
  QrCodeStyleSettings,
  QrCodeTemplateType
} from '../../../shared/types'

// 默认二维码样式
export const defaultQrCodeStyle: QrCodeStyleSettings = {
  size: 256,
  margin: 2,
  darkColor: '#000000',
  lightColor: '#ffffff',
  errorCorrectionLevel: 'M'
}

// 转义 WiFi 二维码特殊字符
function escapeWifiValue(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

// 生成二维码内容
export function buildQrCodePayload(template: QrCodeTemplateType, fields: Record<string, string>): string {
  if (template === 'url') {
    return fields.url?.trim() ?? ''
  }

  if (template === 'wifi') {
    const ssid = escapeWifiValue(fields.ssid?.trim() ?? '')
    const password = escapeWifiValue(fields.password ?? '')
    const encryption = fields.encryption || 'WPA'
    const hidden = fields.hidden === 'true' ? 'true' : 'false'
    return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden};;`
  }

  if (template === 'vcard') {
    const name = fields.name?.trim() ?? ''
    const phone = fields.phone?.trim() ?? ''
    const email = fields.email?.trim() ?? ''
    const org = fields.org?.trim() ?? ''
    const url = fields.url?.trim() ?? ''
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      org ? `ORG:${org}` : '',
      phone ? `TEL:${phone}` : '',
      email ? `EMAIL:${email}` : '',
      url ? `URL:${url}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n')
  }

  return fields.text ?? ''
}

// 生成二维码标题
export function createQrCodeTitle(template: QrCodeTemplateType, fields: Record<string, string>, payload: string): string {
  if (template === 'url') return fields.url?.trim() || 'URL 二维码'
  if (template === 'wifi') return fields.ssid?.trim() ? `WiFi：${fields.ssid.trim()}` : 'WiFi 二维码'
  if (template === 'vcard') return fields.name?.trim() ? `名片：${fields.name.trim()}` : '名片二维码'
  return payload.trim().slice(0, 32) || '文本二维码'
}

// 规整二维码样式
export function normalizeQrCodeStyle(style: Partial<QrCodeStyleSettings>): QrCodeStyleSettings {
  const level = style.errorCorrectionLevel
  const safeLevel: QrCodeErrorCorrectionLevel = level && ['L', 'M', 'Q', 'H'].includes(level)
    ? level
    : defaultQrCodeStyle.errorCorrectionLevel

  return {
    size: Math.max(128, Math.min(1024, Math.round(style.size ?? defaultQrCodeStyle.size))),
    margin: Math.max(0, Math.min(8, Math.round(style.margin ?? defaultQrCodeStyle.margin))),
    darkColor: /^#[0-9a-fA-F]{6}$/.test(style.darkColor ?? '') ? style.darkColor! : defaultQrCodeStyle.darkColor,
    lightColor: /^#[0-9a-fA-F]{6}$/.test(style.lightColor ?? '') ? style.lightColor! : defaultQrCodeStyle.lightColor,
    errorCorrectionLevel: safeLevel
  }
}

// 创建二维码历史项
export function createQrCodeHistoryItem(
  template: QrCodeTemplateType,
  fields: Record<string, string>,
  style: QrCodeStyleSettings,
  now = new Date().toISOString(),
  id: string = crypto.randomUUID()
): QrCodeHistoryItem {
  const payload = buildQrCodePayload(template, fields)
  return {
    id,
    template,
    title: createQrCodeTitle(template, fields, payload),
    payload,
    fields: { ...fields },
    style: normalizeQrCodeStyle(style),
    favorite: false,
    createdAt: now,
    updatedAt: now
  }
}

// 写入或更新二维码历史
export function upsertQrCodeHistory(
  history: QrCodeHistoryItem[],
  item: QrCodeHistoryItem,
  limit: number
): QrCodeHistoryItem[] {
  const existing = history.find((entry) => entry.template === item.template && entry.payload === item.payload)
  const merged: QrCodeHistoryItem = existing
    ? {
      ...item,
      id: existing.id,
      favorite: existing.favorite,
      createdAt: existing.createdAt,
      updatedAt: item.updatedAt
    }
    : item
  const next = [merged, ...history.filter((entry) => entry.id !== merged.id)]
  return trimQrCodeHistory(next, limit)
}

// 根据上限裁剪二维码历史，收藏项始终保留
export function trimQrCodeHistory(history: QrCodeHistoryItem[], limit: number): QrCodeHistoryItem[] {
  const sorted = [...history].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const favorites = sorted.filter((item) => item.favorite)
  const normal = sorted.filter((item) => !item.favorite).slice(0, Math.max(0, limit))
  return [...favorites, ...normal].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

// 切换二维码收藏
export function toggleQrCodeFavorite(history: QrCodeHistoryItem[], id: string): QrCodeHistoryItem[] {
  return history.map((item) => item.id === id ? { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() } : item)
}

// 删除二维码历史项
export function removeQrCodeHistoryItem(history: QrCodeHistoryItem[], id: string): QrCodeHistoryItem[] {
  return history.filter((item) => item.id !== id)
}

// 清空非收藏二维码历史
export function clearUnfavoriteQrCodeHistory(history: QrCodeHistoryItem[]): QrCodeHistoryItem[] {
  return history.filter((item) => item.favorite)
}
