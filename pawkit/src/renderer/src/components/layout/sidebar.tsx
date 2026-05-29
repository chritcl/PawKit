import { useAppStore } from '../../stores/app-store'
import { toolRegistry } from '../../utils/tool-registry'
import { TOOL_IDS, ToolId } from '../../../../shared/constants'

// 侧边栏组件
export function Sidebar(): JSX.Element {
  const activeTool = useAppStore((state) => state.activeTool)
  const setActiveTool = useAppStore((state) => state.setActiveTool)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const toolOrder = useAppStore((state) => state.toolOrder)
  const theme = useAppStore((state) => state.theme)

  // 过滤显示的工具（首页、管理中心、设置始终显示，可禁用工具按用户排序显示）
  const homeTool = toolRegistry.find((tool) => tool.id === TOOL_IDS.HOME)
  const managementTool = toolRegistry.find((tool) => tool.id === TOOL_IDS.MANAGEMENT)
  const settingsTool = toolRegistry.find((tool) => tool.id === TOOL_IDS.SETTINGS)
  const disableableTools = toolRegistry.filter((tool) => tool.canDisable)
  const orderedToolIds = [
    ...toolOrder,
    ...disableableTools.map((tool) => tool.id).filter((id) => !toolOrder.includes(id))
  ]
  const orderedTools = orderedToolIds
    .map((id) => disableableTools.find((tool) => tool.id === id))
    .filter((tool) => tool && enabledTools.includes(tool.id))

  const visibleTools = [homeTool, ...orderedTools, managementTool, settingsTool].filter(
    (tool): tool is (typeof toolRegistry)[number] => Boolean(tool)
  )

  return (
    <div
      className={`w-56 border-r backdrop-blur-xl ${
        theme === 'dark'
          ? 'border-white/10 bg-black/20'
          : 'border-black/10 bg-white/40'
      }`}
    >
      <div className="flex flex-col gap-1 p-3">
        {visibleTools.map((tool) => {
          const IconComponent = tool.icon
          return (
            <button
              key={tool.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeTool === tool.id
                  ? theme === 'dark'
                    ? 'bg-white/10 text-white'
                    : 'bg-black/10 text-gray-900'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                    : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
              }`}
              onClick={() => setActiveTool(tool.id as ToolId)}
            >
              <IconComponent size={18} />
              <span>{tool.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
