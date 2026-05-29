import { Maximize2, Minus, X } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { APP_NAME } from '../../../../shared/constants'

// 标题栏组件
export function TitleBar(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const buttonClass = `app-no-drag inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
    theme === 'dark'
      ? 'text-gray-300 hover:bg-white/10 hover:text-white'
      : 'text-gray-600 hover:bg-black/10 hover:text-gray-900'
  }`

  return (
    <div
      className={`app-drag flex h-10 select-none items-center justify-between border-b px-4 backdrop-blur-xl ${
        theme === 'dark'
          ? 'border-white/10 bg-black/20'
          : 'border-black/10 bg-white/60'
      }`}
    >
      {/* 应用名称 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{APP_NAME}</span>
      </div>

      {/* 窗口控制按钮 */}
      <div className="app-no-drag flex items-center gap-1">
        <button
          className={buttonClass}
          onClick={() => window.electronAPI.app.minimizeWindow()}
          title="最小化"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className={buttonClass}
          onClick={() => window.electronAPI.app.toggleMaximizeWindow()}
          title="最大化 / 还原"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          className="app-no-drag inline-flex h-7 w-7 items-center justify-center rounded-md text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
          onClick={() => window.electronAPI.app.hideWindow()}
          title="关闭（隐藏到托盘）"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
