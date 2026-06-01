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
    <div className="tab-page">
      {/* 标签页导航 */}
      <div className="toolbar-surface tab-toolbar">
        <div className="tab-toolbar-main">
          <div className="segmented-control segmented-scroll w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`segmented-item flex-1 ${activeTab === tab.id ? 'segmented-item-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="tab-content">
        {renderContent()}
      </div>
    </div>
  )
}
