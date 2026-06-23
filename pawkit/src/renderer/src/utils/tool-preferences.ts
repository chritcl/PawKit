import {
  ALWAYS_VISIBLE_TOOL_IDS,
  DEFAULT_FAVORITE_TOOL_IDS,
  MANAGEABLE_TOOL_IDS,
  TOOL_IDS,
  isToolId,
  type ToolId
} from '../../../shared/constants'
import type { AppStartPage, ToolUsageRecord } from '../../../shared/types'

export const manageableToolIds: ToolId[] = [...MANAGEABLE_TOOL_IDS]

export const defaultFavoriteTools: ToolId[] = [...DEFAULT_FAVORITE_TOOL_IDS]

const alwaysVisibleToolIds = new Set<ToolId>(ALWAYS_VISIBLE_TOOL_IDS)

export function normalizeManageableTools(toolIds: string[]): ToolId[] {
  return toolIds.filter((id): id is ToolId => isToolId(id) && manageableToolIds.includes(id))
}

export function normalizeToolOrder(toolOrder: string[], allTools = manageableToolIds): ToolId[] {
  const seen = new Set<string>()
  const ordered = toolOrder.filter((id): id is ToolId => {
    if (!isToolId(id) || !allTools.includes(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const missing = allTools.filter((id) => !seen.has(id))
  return [...ordered, ...missing]
}

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

export function setToolEnabled(enabledTools: string[], toolId: ToolId, enabled: boolean): ToolId[] {
  const normalized = normalizeManageableTools(enabledTools)
  if (enabled) {
    return normalized.includes(toolId) ? normalized : [...normalized, toolId]
  }
  return normalized.filter((id) => id !== toolId)
}

export function toggleFavoriteTool(favoriteTools: string[], toolId: ToolId, enabledTools: string[]): ToolId[] {
  if (!enabledTools.includes(toolId)) {
    return normalizeManageableTools(favoriteTools).filter((id) => id !== toolId)
  }
  const normalized = normalizeManageableTools(favoriteTools)
  return normalized.includes(toolId)
    ? normalized.filter((id) => id !== toolId)
    : [...normalized, toolId]
}

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

export function resolveStartTool(startPage: AppStartPage, lastActiveTool: ToolId, enabledTools: string[]): ToolId {
  const candidate = startPage === 'last' ? lastActiveTool : startPage
  if (isToolId(candidate) && alwaysVisibleToolIds.has(candidate)) {
    return candidate
  }
  return isToolId(candidate) && enabledTools.includes(candidate) ? candidate : TOOL_IDS.HOME
}
