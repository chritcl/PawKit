import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { AppSettings, ShortcutStatusItem } from '../../../../shared/types'

// 应用概览组件
export function Dashboard(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutStatusItem[]>([])

  // 加载设置和快捷键状态
  useEffect(() => {
    if (window.electronAPI?.setting?.getAll) {
      window.electronAPI.setting.getAll().then(setSettings).catch(() => {})
    }
    if (window.electronAPI?.shortcut?.getStatus) {
      window.electronAPI.shortcut.getStatus().then(setShortcuts).catch(() => {})
    }
  }, [])

  // 统计注册成功的快捷键数量
  const registeredCount = shortcuts.filter((s) => s.status === 'registered').length

  // 统计信息
  const stats = [
    {
      label: '应用版本',
      value: '0.0.1'
    },
    {
      label: '当前主题',
      value: theme === 'dark' ? '暗色' : '浅色'
    },
    {
      label: '启用工具数量',
      value: `${enabledTools.length} 个`
    },
    {
      label: '快捷键状态',
      value: `${registeredCount} / ${shortcuts.length} 已注册`
    },
    {
      label: '剪贴板历史',
      value: `${settings?.clipboard?.history?.length ?? 0} 条`
    },
    {
      label: '颜色收藏',
      value: `${settings?.color?.favorites?.length ?? 0} 个`
    }
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">应用概览</h3>
        <p className="mt-1 text-sm text-gray-400">PawKit 应用状态和统计信息</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10"
            >
              <div className="text-sm text-gray-400">{stat.label}</div>
              <div className="mt-1 text-lg font-medium">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
