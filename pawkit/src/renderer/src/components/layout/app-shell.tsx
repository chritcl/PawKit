import { useAppStore } from '../../stores/app-store'
import { Sidebar } from './sidebar'
import { TitleBar } from './title-bar'
import { StatusBar } from './status-bar'
import { ContentArea } from './content-area'

// 应用外壳组件
export function AppShell(): JSX.Element {
  const theme = useAppStore((state) => state.theme)

  return (
    <div
      className={`flex h-full flex-col ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
          : 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-900'
      }`}
    >
      {/* 标题栏 */}
      <TitleBar />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 内容区 */}
        <ContentArea />
      </div>

      {/* 状态栏 */}
      <StatusBar />
    </div>
  )
}
