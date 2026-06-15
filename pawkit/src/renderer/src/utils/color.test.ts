import { describe, expect, it } from 'vitest'
import {
  compositeColor,
  generateColorHarmonyGroups,
  generateColorScale,
  hsvToRgb,
  parseHexColor,
  rgbToHsv,
  rgbaToHex8
} from './color'

describe('调色板颜色工具', () => {
  it('解析 HEX8 并保留透明度', () => {
    expect(parseHexColor('#1677ff80')).toEqual({
      rgb: { r: 22, g: 119, b: 255 },
      alpha: 0.502
    })
    expect(rgbaToHex8(22, 119, 255, 0.5)).toBe('#1677ff80')
  })

  it('RGB 与 HSV 可以稳定互转', () => {
    const hsv = rgbToHsv(22, 119, 255)
    expect(hsv).toEqual({ h: 215, s: 91, v: 100 })
    expect(hsvToRgb(hsv.h, hsv.s, hsv.v)).toEqual({ r: 23, g: 120, b: 255 })
  })

  it('透明颜色可以合成到指定背景', () => {
    expect(compositeColor({ r: 0, g: 0, b: 0 }, 0.5, { r: 255, g: 255, b: 255 }))
      .toEqual({ r: 128, g: 128, b: 128 })
  })

  it('生成 50 到 950 的开发色阶', () => {
    const scale = generateColorScale('#1677ff')
    expect(scale.map((item) => item.label)).toEqual([
      '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'
    ])
  })

  it('生成四种分组配色关系', () => {
    const groups = generateColorHarmonyGroups('#1677ff')
    expect(groups.map((item) => item.id)).toEqual([
      'analogous', 'complementary', 'split-complementary', 'triadic'
    ])
    expect(groups[0].colors).toHaveLength(3)
  })
})
