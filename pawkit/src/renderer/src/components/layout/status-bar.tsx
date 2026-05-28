import { useAppStore } from '../../stores/app-store'
import { APP_NAME, APP_VERSION } from '../../../../shared/constants'

// 状态栏组件
export function StatusBar(): JSX.Element {
  const theme = useAppStore((state) => state.theme)

  return (
    <div
      className={`flex h-6 items-center justify-between border-t px-4 backdrop-blur-xl ${
        theme === 'dark'
          ? 'border-white/10 bg-black/20'
          : 'border-black/10 bg-white/60'
      }`}
    >
      <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        {APP_NAME} v{APP_VERSION}
      </span>
      <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        Alt + Space 切换窗口
      </span>
    </div>
  )
}
