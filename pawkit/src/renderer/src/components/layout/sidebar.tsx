import { useAppStore } from '../../stores/app-store'
import { toolRegistry } from '../../utils/tool-registry'
import { TOOL_IDS, ToolId } from '../../../../shared/constants'

// 侧边栏组件
export function Sidebar(): JSX.Element {
  const activeTool = useAppStore((state) => state.activeTool)
  const setActiveTool = useAppStore((state) => state.setActiveTool)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const toolOrder = useAppStore((state) => state.toolOrder)

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

  const mainTools = [homeTool, ...orderedTools].filter(
    (tool): tool is (typeof toolRegistry)[number] => Boolean(tool)
  )
  const footerTools = [managementTool, settingsTool].filter(
    (tool): tool is (typeof toolRegistry)[number] => Boolean(tool)
  )

  const renderToolButton = (tool: (typeof toolRegistry)[number]): JSX.Element => {
    const IconComponent = tool.icon
    const active = activeTool === tool.id

    return (
      <button
        key={tool.id}
        className={`app-no-drag flex w-full items-center gap-2.5 rounded-[8px] border px-2.5 py-2 text-left text-sm transition-all ${
          active
            ? 'selected-surface text-[color:var(--text-primary)]'
            : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)]'
        }`}
        onClick={() => setActiveTool(tool.id as ToolId)}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${
            active
              ? 'bg-[var(--color-primary-soft)] text-[rgb(var(--color-primary-rgb))]'
              : 'bg-[var(--glass-muted)] text-[color:var(--text-muted)]'
          }`}
        >
          <IconComponent size={17} />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{tool.name}</span>
      </button>
    )
  }

  return (
    <aside className="glass-rail flex w-60 shrink-0 flex-col border-y-0 border-l-0 p-3">
      <div className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        工具箱
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto pr-1">
        {mainTools.map(renderToolButton)}
      </div>
      <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
        <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          管理
        </div>
        <div className="space-y-1">{footerTools.map(renderToolButton)}</div>
      </div>
    </aside>
  )
}
