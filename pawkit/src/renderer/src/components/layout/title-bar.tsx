import { useAppStore } from '../../stores/app-store'
import { APP_NAME } from '../../../../shared/constants'

// 标题栏组件
export function TitleBar(): JSX.Element {
  const theme = useAppStore((state) => state.theme)

  return (
    <div
      className={`flex h-10 items-center justify-between border-b px-4 backdrop-blur-xl ${
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
      <div className="flex items-center gap-2">
        <button
          className={`h-6 w-6 rounded-full transition-colors ${
            theme === 'dark'
              ? 'bg-white/10 hover:bg-white/20'
              : 'bg-black/10 hover:bg-black/20'
          }`}
          onClick={() => window.electronAPI.app.hideWindow()}
          title="最小化"
        />
        <button
          className="h-6 w-6 rounded-full bg-red-500/80 transition-colors hover:bg-red-500"
          onClick={() => window.electronAPI.app.hideWindow()}
          title="关闭（隐藏到托盘）"
        />
      </div>
    </div>
  )
}
