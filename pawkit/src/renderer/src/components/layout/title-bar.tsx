import { Maximize2, Minus, X } from 'lucide-react'
import { APP_NAME } from '../../../../shared/constants'

// 标题栏组件
export function TitleBar(): JSX.Element {
  return (
    <div className="app-drag glass-header flex h-10 select-none items-center justify-between border-x-0 border-t-0 px-4">
      {/* 应用名称 */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[rgb(var(--color-primary-rgb))]" />
        <span className="text-sm font-semibold tracking-normal">{APP_NAME}</span>
      </div>

      {/* 窗口控制按钮 */}
      <div className="app-no-drag flex items-center gap-1">
        <button
          className="icon-button app-no-drag h-7 min-h-7 w-7 min-w-7"
          onClick={() => window.electronAPI?.app?.minimizeWindow?.()}
          title="最小化"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="icon-button app-no-drag h-7 min-h-7 w-7 min-w-7"
          onClick={() => window.electronAPI?.app?.toggleMaximizeWindow?.()}
          title="最大化 / 还原"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          className="icon-button app-no-drag h-7 min-h-7 w-7 min-w-7 text-[color:var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
          onClick={() => window.electronAPI?.app?.hideWindow?.()}
          title="关闭（隐藏到托盘）"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
