import { useEffect, useState } from 'react'
import { APP_VERSION } from '../../../../shared/constants'
import { AppSettings, ShortcutStatusItem } from '../../../../shared/types'
import { useAppStore } from '../../stores/app-store'
import { getToolMeta } from '../../utils/tool-registry'

function getStartPageLabel(settings: AppSettings | null): string {
  const value = settings?.app?.startPage ?? 'home'
  if (value === 'last') return '上次页面'
  if (value === 'home') return '首页'
  return getToolMeta(value)?.name ?? value
}

// 应用概览组件
export function Dashboard(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const favoriteTools = useAppStore((state) => state.favoriteTools)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutStatusItem[]>([])

  useEffect(() => {
    window.electronAPI?.setting?.getAll().then(setSettings).catch(() => {})
    window.electronAPI?.shortcut?.getStatus().then(setShortcuts).catch(() => {})
  }, [])

  const registeredCount = shortcuts.filter((item) => item.status === 'registered').length
  const usageCount = settings?.app?.toolUsage?.reduce((sum, item) => sum + item.count, 0) ?? 0

  const stats = [
    { label: '应用版本', value: APP_VERSION },
    { label: '当前主题', value: theme === 'dark' ? '暗色' : '浅色' },
    { label: '启动页', value: getStartPageLabel(settings) },
    { label: '启用工具', value: `${enabledTools.length} 个` },
    { label: '首页常用', value: `${favoriteTools.length} 个` },
    { label: '快捷键状态', value: `${registeredCount} / ${shortcuts.length} 已注册` },
    { label: '剪贴板历史', value: `${settings?.clipboard?.history?.length ?? 0} 条` },
    { label: '二维码历史', value: `${settings?.qrcode?.history?.length ?? 0} 条` },
    { label: '颜色记录', value: `${(settings?.color?.favorites?.length ?? 0) + (settings?.color?.recent?.length ?? 0)} 个` },
    { label: '工具使用', value: `${usageCount} 次` }
  ]

  return (
    <div className="page-stack">
      <section className="glass-panel">
        <h3 className="font-medium">应用概览</h3>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">本地配置、工具状态和数据统计</p>

        <div className="data-grid mt-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="text-sm text-[color:var(--text-muted)]">{stat.label}</div>
              <div className="mt-2 truncate text-lg font-medium">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
