import { Sidebar } from './sidebar'
import { TitleBar } from './title-bar'
import { StatusBar } from './status-bar'
import { ContentArea } from './content-area'

// 应用外壳组件
export function AppShell(): JSX.Element {
  return (
    <div className="app-window flex h-full flex-col text-[color:var(--text-primary)]">
      {/* 标题栏 */}
      <TitleBar />

      {/* 主体区域 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
