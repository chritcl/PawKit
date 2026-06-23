import { HSL, RGB } from '../../../shared/types'

export interface HSV {
  h: number
  s: number
  v: number
}

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

export interface ColorHarmonyGroup {
  id: 'analogous' | 'complementary' | 'split-complementary' | 'triadic'
  label: string
  colors: ColorHarmonyItem[]
}

export type ContrastLevel = 'AAA' | 'AA' | '不足'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

function toHexByte(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
}

function normalizeHex(hex: string): string | null {
  const parsed = parseHexColor(hex)
  return parsed ? rgbToHex(parsed.rgb.r, parsed.rgb.g, parsed.rgb.b) : null
}

// 解析 HEX、HEX8 以及对应短格式
export function parseHexColor(hex: string): { rgb: RGB; alpha: number } | null {
  const cleanHex = hex.trim().replace(/^#/, '')
  const validLengths = [3, 4, 6, 8]
  if (!validLengths.includes(cleanHex.length) || !/^[0-9A-Fa-f]+$/.test(cleanHex)) {
    return null
  }

  const fullHex = cleanHex.length <= 4
    ? cleanHex.split('').map((item) => item + item).join('')
    : cleanHex

  return {
    rgb: {
      r: Number.parseInt(fullHex.substring(0, 2), 16),
      g: Number.parseInt(fullHex.substring(2, 4), 16),
      b: Number.parseInt(fullHex.substring(4, 6), 16)
    },
    alpha: fullHex.length === 8
      ? Number((Number.parseInt(fullHex.substring(6, 8), 16) / 255).toFixed(3))
      : 1
  }
}

// HEX 转 RGB
export function hexToRgb(hex: string): RGB | null {
  return parseHexColor(hex)?.rgb ?? null
}

// RGB 转 HEX
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

// RGB 和透明度转 HEX8
export function rgbaToHex8(r: number, g: number, b: number, alpha: number): string {
  return `${rgbToHex(r, g, b)}${toHexByte(clamp(alpha, 0, 1) * 255)}`
}

// RGB 转 HSL
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = clamp(r, 0, 255) / 255
  const gn = clamp(g, 0, 255) / 255
  const bn = clamp(b, 0, 255) / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) }
  }

  const difference = max - min
  const s = l > 0.5 ? difference / (2 - max - min) : difference / (max + min)
  let h = 0

  if (max === rn) h = ((gn - bn) / difference + (gn < bn ? 6 : 0)) / 6
  if (max === gn) h = ((bn - rn) / difference + 2) / 6
  if (max === bn) h = ((rn - gn) / difference + 4) / 6

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

// HSL 转 RGB
export function hslToRgb(h: number, s: number, l: number): RGB {
  const hn = normalizeHue(h) / 360
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100

  if (sn === 0) {
    const value = Math.round(ln * 255)
    return { r: value, g: value, b: value }
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    let next = t
    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
    return p
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q

  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255)
  }
}

// RGB 转 HSV
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = clamp(r, 0, 255) / 255
  const gn = clamp(g, 0, 255) / 255
  const bn = clamp(b, 0, 255) / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const difference = max - min
  let h = 0

  if (difference !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / difference) % 6)
    if (max === gn) h = 60 * ((bn - rn) / difference + 2)
    if (max === bn) h = 60 * ((rn - gn) / difference + 4)
  }

  return {
    h: Math.round(normalizeHue(h)),
    s: Math.round((max === 0 ? 0 : difference / max) * 100),
    v: Math.round(max * 100)
  }
}

// HSV 转 RGB
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const hue = normalizeHue(h)
  const saturation = clamp(s, 0, 100) / 100
  const value = clamp(v, 0, 100) / 100
  const chroma = value * saturation
  const section = hue / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  const offset = value - chroma
  let base: [number, number, number]

  if (section < 1) base = [chroma, x, 0]
  else if (section < 2) base = [x, chroma, 0]
  else if (section < 3) base = [0, chroma, x]
  else if (section < 4) base = [0, x, chroma]
  else if (section < 5) base = [x, 0, chroma]
  else base = [chroma, 0, x]

  return {
    r: Math.round((base[0] + offset) * 255),
    g: Math.round((base[1] + offset) * 255),
    b: Math.round((base[2] + offset) * 255)
  }
}

// 校验 HEX 与 HEX8 格式
export function isValidHex(hex: string): boolean {
  return parseHexColor(hex) !== null
}

// 校验 RGB 值
export function isValidRgb(r: number, g: number, b: number): boolean {
  return [r, g, b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
}

// 校验 HSL 值
export function isValidHsl(h: number, s: number, l: number): boolean {
  return Number.isInteger(h) && Number.isInteger(s) && Number.isInteger(l) &&
    h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100
}

// 将透明前景色合成到不透明背景色
export function compositeColor(foreground: RGB, alpha: number, background: RGB): RGB {
  const normalizedAlpha = clamp(alpha, 0, 1)
  return {
    r: Math.round(foreground.r * normalizedAlpha + background.r * (1 - normalizedAlpha)),
    g: Math.round(foreground.g * normalizedAlpha + background.g * (1 - normalizedAlpha)),
    b: Math.round(foreground.b * normalizedAlpha + background.b * (1 - normalizedAlpha))
  }
}

// 计算相对亮度
export function getRelativeLuminance(rgb: RGB): number {
  const normalize = (value: number): number => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
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
export function generateCssVar(hex: string, rgb: RGB, hsl?: HSL, alpha = 1): string {
  const hslValue = hsl ? `${hsl.h} ${hsl.s}% ${hsl.l}%` : ''
  return [
    `--color-primary: ${alpha < 1 ? rgbaToHex8(rgb.r, rgb.g, rgb.b, alpha) : hex};`,
    `--color-primary-rgb: ${rgb.r} ${rgb.g} ${rgb.b};`,
    hslValue ? `--color-primary-hsl: ${hslValue};` : '',
    `--color-primary-alpha: ${Number(alpha.toFixed(2))};`
  ].filter(Boolean).join('\n')
}

// 生成 50 到 950 的开发色阶
export function generateColorScale(hex: string): ColorScaleItem[] {
  const normalized = normalizeHex(hex)
  const rgb = normalized ? hexToRgb(normalized) : null
  if (!rgb) return []

  const baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const levels = [
    ['50', 97], ['100', 93], ['200', 86], ['300', 76], ['400', 65],
    ['500', baseHsl.l], ['600', 44], ['700', 36], ['800', 28], ['900', 21], ['950', 13]
  ] as const

  return levels.map(([label, lightness]) => {
    const hsl = { h: baseHsl.h, s: baseHsl.s, l: lightness }
    const nextRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
    return { label, hex: rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b), rgb: nextRgb, hsl }
  })
}

function createHarmonyItem(baseHsl: HSL, label: string, offset: number): ColorHarmonyItem {
  const hsl = { ...baseHsl, h: normalizeHue(baseHsl.h + offset) }
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l)
  return { label, hex: rgbToHex(rgb.r, rgb.g, rgb.b), rgb, hsl }
}

// 生成分组配色方案
export function generateColorHarmonyGroups(hex: string): ColorHarmonyGroup[] {
  const rgb = hexToRgb(hex)
  if (!rgb) return []
  const baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const group = (id: ColorHarmonyGroup['id'], label: string, offsets: number[]): ColorHarmonyGroup => ({
    id,
    label,
    colors: offsets.map((offset, index) => createHarmonyItem(baseHsl, index === 0 ? '基准色' : `${label} ${index}`, offset))
  })

  return [
    group('analogous', '类似色', [0, -30, 30]),
    group('complementary', '互补色', [0, 180]),
    group('split-complementary', '分裂互补色', [0, 150, 210]),
    group('triadic', '三角色', [0, 120, 240])
  ]
}

// 生成 Tailwind 色板片段
export function generateTailwindSnippet(hex: string): string {
  const lines = generateColorScale(hex).map((item) => `      ${item.label}: '${item.hex}'`)
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
export function generateJsonToken(hex: string, rgb: RGB, hsl: HSL, alpha = 1): string {
  return JSON.stringify({
    color: {
      primary: {
        value: alpha < 1 ? rgbaToHex8(rgb.r, rgb.g, rgb.b, alpha) : hex,
        rgb: `${rgb.r} ${rgb.g} ${rgb.b}`,
        hsl: `${hsl.h} ${hsl.s}% ${hsl.l}%`,
        alpha: Number(alpha.toFixed(2))
      }
    }
  }, null, 2)
}
