import { ArrowDown, ArrowUp, GripVertical, Star } from 'lucide-react'
import { ToolId } from '../../../../shared/constants'
import { useAppStore } from '../../stores/app-store'
import { ExtendedToolMeta, getDisableableTools } from '../../utils/tool-registry'
import {
  moveToolInOrder,
  normalizeToolOrder,
  setToolEnabled,
  toggleFavoriteTool
} from '../../utils/tool-preferences'

function getOrderedTools(toolOrder: string[]): ExtendedToolMeta[] {
  const tools = getDisableableTools()
  const orderedIds = normalizeToolOrder(toolOrder)
  return orderedIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is ExtendedToolMeta => Boolean(tool))
}

// 工具管理组件
export function ToolManage(): JSX.Element {
  const enabledTools = useAppStore((state) => state.enabledTools)
  const toolOrder = useAppStore((state) => state.toolOrder)
  const favoriteTools = useAppStore((state) => state.favoriteTools)
  const setEnabledTools = useAppStore((state) => state.setEnabledTools)
  const setToolOrder = useAppStore((state) => state.setToolOrder)
  const setFavoriteTools = useAppStore((state) => state.setFavoriteTools)

  const orderedTools = getOrderedTools(toolOrder)

  const toggleTool = (toolId: string): void => {
    if (enabledTools.includes(toolId)) {
      setEnabledTools(setToolEnabled(enabledTools, toolId as ToolId, false))
      setFavoriteTools(toggleFavoriteTool(favoriteTools, toolId as ToolId, []))
      return
    }

    setEnabledTools(setToolEnabled(enabledTools, toolId as ToolId, true))
    if (!toolOrder.includes(toolId)) {
      setToolOrder([...toolOrder, toolId])
    }
  }

  const moveTool = (toolId: string, direction: -1 | 1): void => {
    setToolOrder(moveToolInOrder(toolOrder, toolId as ToolId, direction))
  }

  const toggleFavorite = (toolId: string): void => {
    setFavoriteTools(toggleFavoriteTool(favoriteTools, toolId as ToolId, enabledTools))
  }

  return (
    <section className="glass-panel">
      <div className="panel-heading">
        <div className="panel-heading-text">
          <h3 className="font-medium">工具管理</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">启用状态、侧边栏顺序和首页常用工具</p>
        </div>
        <div className="panel-actions text-sm text-[color:var(--text-muted)]">
          {enabledTools.length} 个启用 · {favoriteTools.length} 个常用
        </div>
      </div>

      <div className="list-stack mt-5">
        {orderedTools.map((tool, index) => {
          const isEnabled = enabledTools.includes(tool.id)
          const isFavorite = favoriteTools.includes(tool.id)
          const IconComponent = tool.icon
          return (
            <div
              key={tool.id}
              className={`glass-card work-row ${isEnabled ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                <span className="icon-tile">
                  <IconComponent className="h-5 w-5" />
                </span>
              </div>

              <div className="work-row-main">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tool.name}</span>
                  <span className="chip">
                    Phase {tool.phase}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm text-[color:var(--text-muted)]">{tool.description}</div>
              </div>

              <div className="work-row-actions">
                <button
                  className="icon-button"
                  onClick={() => moveTool(tool.id, -1)}
                  disabled={index === 0}
                  title="上移"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  className="icon-button"
                  onClick={() => moveTool(tool.id, 1)}
                  disabled={index === orderedTools.length - 1}
                  title="下移"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  className={`icon-button icon-button-warning ${
                    isFavorite ? 'tone-warning' : 'text-[color:var(--text-muted)]'
                  }`}
                  onClick={() => toggleFavorite(tool.id)}
                  disabled={!isEnabled}
                  title={isFavorite ? '取消首页常用' : '设为首页常用'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  className={`toolbar-button min-h-8 px-3 py-1.5 ${
                    isEnabled
                      ? 'tone-surface-success'
                      : ''
                  }`}
                  onClick={() => toggleTool(tool.id)}
                >
                  {isEnabled ? '已启用' : '已禁用'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
