import { TOOL_IDS, ToolId } from '../../../shared/constants'
import { AppStartPage, ToolUsageRecord } from '../../../shared/types'

export const manageableToolIds: ToolId[] = [
  TOOL_IDS.CLIPBOARD,
  TOOL_IDS.COLOR_PICKER,
  TOOL_IDS.JSON_TOOL,
  TOOL_IDS.TIMESTAMP_TOOL,
  TOOL_IDS.SCREENSHOT,
  TOOL_IDS.BASE64_TOOL,
  TOOL_IDS.QRCODE
]

const alwaysVisibleToolIds: ToolId[] = [TOOL_IDS.HOME, TOOL_IDS.MANAGEMENT, TOOL_IDS.SETTINGS]

// 规整工具排序，去重、过滤未知工具，并补齐缺失工具
export function normalizeToolOrder(toolOrder: string[], allTools = manageableToolIds): ToolId[] {
  const seen = new Set<string>()
  const ordered = toolOrder.filter((id): id is ToolId => {
    if (!allTools.includes(id as ToolId) || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const missing = allTools.filter((id) => !seen.has(id))
  return [...ordered, ...missing]
}

// 移动工具顺序
export function moveToolInOrder(toolOrder: string[], toolId: ToolId, direction: -1 | 1): ToolId[] {
  const normalized = normalizeToolOrder(toolOrder)
  const index = normalized.indexOf(toolId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= normalized.length) {
    return normalized
  }

  const nextOrder = [...normalized]
  const [target] = nextOrder.splice(index, 1)
  nextOrder.splice(nextIndex, 0, target)
  return nextOrder
}

// 设置工具启用状态
export function setToolEnabled(enabledTools: string[], toolId: ToolId, enabled: boolean): ToolId[] {
  const normalized = enabledTools.filter((id): id is ToolId => manageableToolIds.includes(id as ToolId))
  if (enabled) {
    return normalized.includes(toolId) ? normalized : [...normalized, toolId]
  }
  return normalized.filter((id) => id !== toolId)
}

// 切换首页常用工具，禁用工具不能加入常用
export function toggleFavoriteTool(favoriteTools: string[], toolId: ToolId, enabledTools: string[]): ToolId[] {
  if (!enabledTools.includes(toolId)) {
    return favoriteTools.filter((id): id is ToolId => manageableToolIds.includes(id as ToolId) && id !== toolId)
  }
  const normalized = favoriteTools.filter((id): id is ToolId => manageableToolIds.includes(id as ToolId))
  return normalized.includes(toolId)
    ? normalized.filter((id) => id !== toolId)
    : [...normalized, toolId]
}

// 更新工具使用记录
export function updateToolUsage(
  records: ToolUsageRecord[],
  toolId: ToolId,
  now = new Date().toISOString(),
  limit = 20
): ToolUsageRecord[] {
  const existing = records.find((item) => item.toolId === toolId)
  return [
    { toolId, count: (existing?.count ?? 0) + 1, lastUsedAt: now },
    ...records.filter((item) => item.toolId !== toolId)
  ].slice(0, limit)
}

// 解析启动页
export function resolveStartTool(startPage: AppStartPage, lastActiveTool: ToolId, enabledTools: string[]): ToolId {
  const candidate = startPage === 'last' ? lastActiveTool : startPage
  if (alwaysVisibleToolIds.includes(candidate as ToolId)) {
    return candidate as ToolId
  }
  return enabledTools.includes(candidate) ? candidate as ToolId : TOOL_IDS.HOME
}
