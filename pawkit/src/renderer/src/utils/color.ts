import { RGB, HSL } from '../../../shared/types'

export interface ColorScaleItem {
  label: string
  hex: string
  rgb: RGB
  hsl: HSL
}

export interface ColorHarmonyItem {
  label: string
  hex: string
  rgb: RGB
  hsl: HSL
}

export type ContrastLevel = 'AAA' | 'AA' | '不足'

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

// HEX 转 RGB
export function hexToRgb(hex: string): RGB | null {
  const cleanHex = hex.replace(/^#/, '')

  let fullHex = cleanHex
  if (cleanHex.length === 3) {
    fullHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2]
  }

  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    return null
  }

  return {
    r: parseInt(fullHex.substring(0, 2), 16),
    g: parseInt(fullHex.substring(2, 4), 16),
    b: parseInt(fullHex.substring(4, 6), 16)
  }
}

// RGB 转 HEX
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// RGB 转 HSL
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6
  } else {
    h = ((rn - gn) / d + 4) / 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

// HSL 转 RGB
export function hslToRgb(h: number, s: number, l: number): RGB {
  const hn = normalizeHue(h) / 360
  const sn = s / 100
  const ln = l / 100

  if (sn === 0) {
    const v = Math.round(ln * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
  }
}

// 校验 HEX 格式
export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)
}

// 校验 RGB 值
export function isValidRgb(r: number, g: number, b: number): boolean {
  return (
    Number.isInteger(r) &&
    Number.isInteger(g) &&
    Number.isInteger(b) &&
    r >= 0 &&
    r <= 255 &&
    g >= 0 &&
    g <= 255 &&
    b >= 0 &&
    b <= 255
  )
}

// 校验 HSL 值
export function isValidHsl(h: number, s: number, l: number): boolean {
  return Number.isInteger(h) && Number.isInteger(s) && Number.isInteger(l) && h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100
}

// 计算相对亮度
export function getRelativeLuminance(rgb: RGB): number {
  const normalize = (value: number): number => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  }

  return 0.2126 * normalize(rgb.r) + 0.7152 * normalize(rgb.g) + 0.0722 * normalize(rgb.b)
}

// 计算对比度
export function getContrastRatio(foreground: RGB, background: RGB): number {
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  const light = Math.max(foregroundLuminance, backgroundLuminance)
  const dark = Math.min(foregroundLuminance, backgroundLuminance)

  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2))
}

// 获取可读性等级
export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  return '不足'
}

// 推荐黑白文字色
export function getReadableTextColor(background: RGB): '#000000' | '#ffffff' {
  const blackRatio = getContrastRatio({ r: 0, g: 0, b: 0 }, background)
  const whiteRatio = getContrastRatio({ r: 255, g: 255, b: 255 }, background)
  return blackRatio >= whiteRatio ? '#000000' : '#ffffff'
}

// 生成 CSS 变量
export function generateCssVar(hex: string, rgb: RGB, hsl?: HSL): string {
  const hslValue = hsl ? `${hsl.h} ${hsl.s}% ${hsl.l}%` : ''
  return [
    `--color-primary: ${hex};`,
    `--color-primary-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};`,
    hslValue ? `--color-primary-hsl: ${hslValue};` : ''
  ].filter(Boolean).join('\n')
}

// 生成色阶
export function generateColorScale(hex: string): ColorScaleItem[] {
  const normalized = normalizeHex(hex)
  const rgb = normalized ? hexToRgb(normalized) : null
  if (!rgb) return []

  const baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const levels = [
    ['50', 96],
    ['100', 91],
    ['200', 84],
    ['300', 74],
    ['400', 63],
    ['500', baseHsl.l],
    ['600', 43],
    ['700', 34],
    ['800', 26],
    ['900', 18]
  ] as const

  return levels.map(([label, lightness]) => {
    const hsl = { h: baseHsl.h, s: baseHsl.s, l: lightness }
    const nextRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
    return {
      label,
      hex: rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b),
      rgb: nextRgb,
      hsl
    }
  })
}

// 生成配色建议
export function generateColorHarmony(hex: string): ColorHarmonyItem[] {
  const normalized = normalizeHex(hex)
  const rgb = normalized ? hexToRgb(normalized) : null
  if (!rgb) return []

  const baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const items = [
    { label: '当前色', offset: 0 },
    { label: '互补色', offset: 180 },
    { label: '类似色 A', offset: -30 },
    { label: '类似色 B', offset: 30 },
    { label: '三角色 A', offset: 120 },
    { label: '三角色 B', offset: -120 }
  ]

  return items.map((item) => {
    const hsl = { ...baseHsl, h: normalizeHue(baseHsl.h + item.offset) }
    const nextRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
    return {
      label: item.label,
      hex: rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b),
      rgb: nextRgb,
      hsl
    }
  })
}

// 生成 Tailwind 色板片段
export function generateTailwindSnippet(hex: string): string {
  const scale = generateColorScale(hex)
  const lines = scale.map((item) => `      ${item.label}: '${item.hex}'`)
  return `theme: {
  extend: {
    colors: {
      primary: {
${lines.join(',\n')}
      }
    }
  }
}`
}

// 生成 JSON token
export function generateJsonToken(hex: string, rgb: RGB, hsl: HSL): string {
  return JSON.stringify({
    color: {
      primary: {
        value: hex,
        rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
        hsl: `${hsl.h} ${hsl.s}% ${hsl.l}%`
      }
    }
  }, null, 2)
}
