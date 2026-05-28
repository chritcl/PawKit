import { useState } from 'react'
import { Dashboard } from './dashboard'
import { ToolManage } from './tool-manage'
import { DataManage } from './data-manage'
import { ShortcutManage } from './shortcut-manage'

// 管理中心页面
export function ManagementPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tools' | 'shortcuts' | 'data'>('dashboard')

  // 标签页配置
  const tabs = [
    { id: 'dashboard' as const, label: '应用概览' },
    { id: 'tools' as const, label: '工具管理' },
    { id: 'shortcuts' as const, label: '快捷键' },
    { id: 'data' as const, label: '数据管理' }
  ]

  // 渲染当前标签页内容
  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'tools':
        return <ToolManage />
      case 'shortcuts':
        return <ShortcutManage />
      case 'data':
        return <DataManage />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="space-y-4">
      {/* 标签页导航 */}
      <div className="flex gap-2 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 rounded-md px-4 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {renderContent()}
    </div>
  )
}
