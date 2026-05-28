import { useAppStore } from '../../stores/app-store'
import { AppTheme } from '../../../../shared/types'

// 设置页组件
export function SettingsPage(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold">设置</h2>
        <p className="mt-2 text-gray-400">当前阶段：Phase 2 - 本地配置与管理中心基础</p>
      </div>

      {/* 主题设置 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">主题设置</h3>
        <p className="mt-1 text-sm text-gray-400">选择应用的外观主题</p>
        <div className="mt-4 flex gap-4">
          <button
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
            onClick={() => setTheme('dark' as AppTheme)}
          >
            暗色主题
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              theme === 'light'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
            onClick={() => setTheme('light' as AppTheme)}
          >
            浅色主题
          </button>
        </div>
      </div>

      {/* 快捷键设置（占位） */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">快捷键设置</h3>
        <p className="mt-1 text-sm text-gray-400">自定义全局快捷键（远期功能）</p>
        <div className="mt-4 space-y-2 text-sm text-gray-500">
          <p>切换窗口：Alt + Space</p>
          <p>剪贴板：Alt + V</p>
          <p>截图：Alt + A</p>
          <p>调色板：Alt + C</p>
        </div>
      </div>

      {/* 窗口行为设置（占位） */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">窗口行为</h3>
        <p className="mt-1 text-sm text-gray-400">配置窗口行为（远期功能）</p>
        <div className="mt-4 text-sm text-gray-500">
          <p>关闭窗口时隐藏到托盘</p>
        </div>
      </div>
    </div>
  )
}
