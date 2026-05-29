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
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">工具管理</h3>
            <p className="mt-1 text-sm text-gray-400">启用状态、侧边栏顺序和首页常用工具</p>
          </div>
          <div className="text-sm text-gray-500">
            {enabledTools.length} 个启用 · {favoriteTools.length} 个常用
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {orderedTools.map((tool, index) => {
            const isEnabled = enabledTools.includes(tool.id)
            const isFavorite = favoriteTools.includes(tool.id)
            const IconComponent = tool.icon
            return (
              <div
                key={tool.id}
                className={`flex items-center gap-3 rounded-lg border p-4 backdrop-blur-xl transition-colors ${
                  isEnabled ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/20 opacity-70'
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-gray-600" />
                <IconComponent className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tool.name}</span>
                    <span className="rounded border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-gray-400">
                      Phase {tool.phase}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm text-gray-500">{tool.description}</div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="rounded p-2 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30"
                    onClick={() => moveTool(tool.id, -1)}
                    disabled={index === 0}
                    title="上移"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded p-2 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30"
                    onClick={() => moveTool(tool.id, 1)}
                    disabled={index === orderedTools.length - 1}
                    title="下移"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    className={`rounded p-2 hover:bg-yellow-500/10 hover:text-yellow-400 disabled:opacity-30 ${
                      isFavorite ? 'text-yellow-400' : 'text-gray-500'
                    }`}
                    onClick={() => toggleFavorite(tool.id)}
                    disabled={!isEnabled}
                    title={isFavorite ? '取消首页常用' : '设为首页常用'}
                  >
                    <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isEnabled
                        ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
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
    </div>
  )
}
