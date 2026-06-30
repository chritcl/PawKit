import { describe, expect, it } from 'vitest'
import { TOOL_IDS } from '../../../shared/constants'
import {
  moveToolInOrder,
  normalizeToolOrder,
  resolveStartTool,
  setToolEnabled,
  toggleFavoriteTool,
  updateToolUsage
} from './tool-preferences'

describe('工具偏好函数', () => {
  it('规整工具排序，去重并补齐缺失项', () => {
    const order = normalizeToolOrder([
      TOOL_IDS.QRCODE,
      TOOL_IDS.JSON_TOOL,
      TOOL_IDS.QRCODE,
      'unknown'
    ])

    expect(order[0]).toBe(TOOL_IDS.QRCODE)
    expect(order[1]).toBe(TOOL_IDS.JSON_TOOL)
    expect(new Set(order).size).toBe(order.length)
    expect(order).toContain(TOOL_IDS.CLIPBOARD)
    expect(order).toContain(TOOL_IDS.MEDIA_PLAYER)
    expect(order).toContain(TOOL_IDS.TEXT_TOOLBOX)
  })

  it('支持工具上移下移', () => {
    const order = [TOOL_IDS.CLIPBOARD, TOOL_IDS.JSON_TOOL, TOOL_IDS.QRCODE]

    expect(moveToolInOrder(order, TOOL_IDS.QRCODE, -1).slice(0, 3)).toEqual([
      TOOL_IDS.CLIPBOARD,
      TOOL_IDS.QRCODE,
      TOOL_IDS.JSON_TOOL
    ])
    expect(moveToolInOrder(order, TOOL_IDS.CLIPBOARD, -1).slice(0, 3)).toEqual(order)
  })

  it('支持启用和禁用工具', () => {
    const disabled = setToolEnabled([TOOL_IDS.CLIPBOARD, TOOL_IDS.QRCODE], TOOL_IDS.QRCODE, false)
    expect(disabled).toEqual([TOOL_IDS.CLIPBOARD])

    const enabled = setToolEnabled(disabled, TOOL_IDS.QRCODE, true)
    expect(enabled).toEqual([TOOL_IDS.CLIPBOARD, TOOL_IDS.QRCODE])
  })

  it('禁用工具不能加入首页常用', () => {
    expect(toggleFavoriteTool([], TOOL_IDS.QRCODE, [])).toEqual([])
    expect(toggleFavoriteTool([], TOOL_IDS.QRCODE, [TOOL_IDS.QRCODE])).toEqual([TOOL_IDS.QRCODE])
    expect(toggleFavoriteTool([TOOL_IDS.QRCODE], TOOL_IDS.QRCODE, [TOOL_IDS.QRCODE])).toEqual([])
  })

  it('更新工具使用记录并提升到顶部', () => {
    const usage = updateToolUsage([
      { toolId: TOOL_IDS.JSON_TOOL, count: 2, lastUsedAt: '2024-01-01T00:00:00.000Z' },
      { toolId: TOOL_IDS.QRCODE, count: 1, lastUsedAt: '2024-01-01T00:00:00.000Z' }
    ], TOOL_IDS.QRCODE, '2024-01-02T00:00:00.000Z')

    expect(usage[0]).toEqual({
      toolId: TOOL_IDS.QRCODE,
      count: 2,
      lastUsedAt: '2024-01-02T00:00:00.000Z'
    })
    expect(usage[1].toolId).toBe(TOOL_IDS.JSON_TOOL)
  })

  it('解析默认页面策略', () => {
    expect(resolveStartTool('last', TOOL_IDS.JSON_TOOL, [TOOL_IDS.JSON_TOOL])).toBe(TOOL_IDS.JSON_TOOL)
    expect(resolveStartTool(TOOL_IDS.QRCODE, TOOL_IDS.JSON_TOOL, [])).toBe(TOOL_IDS.HOME)
    expect(resolveStartTool(TOOL_IDS.MEDIA_PLAYER, TOOL_IDS.JSON_TOOL, [TOOL_IDS.MEDIA_PLAYER])).toBe(TOOL_IDS.MEDIA_PLAYER)
    expect(resolveStartTool(TOOL_IDS.SETTINGS, TOOL_IDS.JSON_TOOL, [])).toBe(TOOL_IDS.SETTINGS)
  })
})
