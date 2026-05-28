import { useAppStore } from '../../stores/app-store'
import { getDisableableTools } from '../../utils/tool-registry'

// 工具管理组件
export function ToolManage(): JSX.Element {
  const enabledTools = useAppStore((state) => state.enabledTools)
  const setEnabledTools = useAppStore((state) => state.setEnabledTools)

  const disableableTools = getDisableableTools()

  // 切换工具启用状态
  const toggleTool = (toolId: string): void => {
    if (enabledTools.includes(toolId)) {
      setEnabledTools(enabledTools.filter((id) => id !== toolId))
    } else {
      setEnabledTools([...enabledTools, toolId])
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">工具管理</h3>
        <p className="mt-1 text-sm text-gray-400">启用或禁用工具，禁用的工具不会在左侧菜单显示</p>

        <div className="mt-4 space-y-3">
          {disableableTools.map((tool) => {
            const isEnabled = enabledTools.includes(tool.id)
            return (
              <div
                key={tool.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10"
              >
                <div>
                  <div className="font-medium">{tool.name}</div>
                  <div className="mt-1 text-sm text-gray-400">{tool.description}</div>
                  <div className="mt-1 text-xs text-gray-500">Phase {tool.phase}</div>
                </div>
                <button
                  className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                    isEnabled
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                  onClick={() => toggleTool(tool.id)}
                >
                  {isEnabled ? '已启用' : '已禁用'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
