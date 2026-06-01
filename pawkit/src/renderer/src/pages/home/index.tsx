import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Keyboard,
  Layers3,
  Star,
  TableProperties
} from 'lucide-react'
import { APP_VERSION, TOOL_IDS, ToolId } from '../../../../shared/constants'
import { AppSettings, ClipboardItem, QrCodeHistoryItem, ShortcutStatusItem } from '../../../../shared/types'
import { useAppStore } from '../../stores/app-store'
import { getToolMeta, toolRegistry } from '../../utils/tool-registry'

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getClipboardLabel(item: ClipboardItem): string {
  if (item.type === 'image') return '图片'
  if (item.type === 'file') return `${item.files.length} 个文件`
  if (item.type === 'richText') return '富文本'
  const compact = item.content.replace(/\s+/g, ' ').trim()
  return compact.length > 48 ? `${compact.slice(0, 48)}...` : compact || '空文本'
}

function getShortcutSummary(shortcuts: ShortcutStatusItem[]): string {
  if (shortcuts.length === 0) return '未读取'
  const registered = shortcuts.filter((item) => item.status === 'registered').length
  return `${registered} / ${shortcuts.length} 已注册`
}

// 首页组件
export function HomePage(): JSX.Element {
  const enabledTools = useAppStore((state) => state.enabledTools)
  const favoriteTools = useAppStore((state) => state.favoriteTools)
  const toolUsage = useAppStore((state) => state.toolUsage)
  const setActiveTool = useAppStore((state) => state.setActiveTool)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutStatusItem[]>([])

  useEffect(() => {
    window.electronAPI?.setting?.getAll().then(setSettings).catch(() => {})
    window.electronAPI?.shortcut?.getStatus().then(setShortcuts).catch(() => {})
  }, [])

  const quickTools = useMemo(() => {
    const fallbackTools = toolRegistry.filter((tool) => tool.canDisable && enabledTools.includes(tool.id)).slice(0, 4)
    const favoriteList = favoriteTools
      .map((id) => getToolMeta(id))
      .filter((tool): tool is NonNullable<ReturnType<typeof getToolMeta>> => {
        if (!tool) return false
        return enabledTools.includes(tool.id)
      })
    return favoriteList.length > 0 ? favoriteList : fallbackTools
  }, [enabledTools, favoriteTools])

  const recentTools = useMemo(() => (
    [...toolUsage]
      .filter((item) => enabledTools.includes(item.toolId))
      .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
      .slice(0, 5)
  ), [enabledTools, toolUsage])

  const clipboardHistory = settings?.clipboard?.history ?? []
  const qrcodeHistory = settings?.qrcode?.history ?? []
  const recentClipboard = clipboardHistory.slice(0, 3)
  const recentQrCodes = qrcodeHistory.slice(0, 3)

  const registeredCount = shortcuts.filter((item) => item.status === 'registered').length
  const dataStats = [
    { label: '启用工具', value: enabledTools.length, unit: '个', detail: '侧边栏可用' },
    { label: '快捷键', value: shortcuts.length === 0 ? '未读' : registeredCount, unit: shortcuts.length === 0 ? '' : '个', detail: getShortcutSummary(shortcuts) },
    { label: '剪贴板', value: clipboardHistory.length, unit: '条', detail: '本地历史' },
    { label: '二维码', value: qrcodeHistory.length, unit: '条', detail: '历史记录' }
  ]

  return (
    <div className="home-workbench">
      <div className="home-main-stack">
        <section className="glass-panel home-command-panel">
          <div className="home-command-copy">
            <div className="home-command-kicker">
              <CheckCircle2 className="h-4 w-4 tone-success" />
              本地工具就绪
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal">快捷启动工作台</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
              常用工具、最近使用和本地内容集中在这里，打开 PawKit 后可以直接开始处理剪贴板、JSON、截图或二维码。
            </p>
          </div>

          <div className="home-command-status">
            <span className="chip">v{APP_VERSION}</span>
            <span className="chip">{enabledTools.length} 个工具可用</span>
            <span className="chip">{getShortcutSummary(shortcuts)}</span>
          </div>
        </section>

        <section className="glass-panel home-launch-panel">
          <div className="panel-heading">
            <div className="panel-heading-text">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 tone-warning" />
                <h3 className="font-medium">常用工具</h3>
              </div>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">来自管理中心的首页常用配置，禁用工具会自动隐藏。</p>
            </div>
          </div>

          {quickTools.length === 0 ? (
            <div className="empty-state mt-4 rounded-[8px] border border-dashed border-[var(--glass-border)] bg-[var(--glass-muted)] text-sm">
              暂无可启动工具
            </div>
          ) : (
            <div className="home-tool-grid mt-4">
              {quickTools.map((tool) => {
                const IconComponent = tool.icon
                return (
                  <button
                    key={tool.id}
                    className="home-tool-card glass-card text-left"
                    onClick={() => setActiveTool(tool.id as ToolId)}
                  >
                    <span className="home-tool-icon">
                      <IconComponent className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{tool.name}</span>
                      <span className="mt-1 line-clamp-2 block text-sm leading-5 text-[color:var(--text-muted)]">
                        {tool.description}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="glass-panel">
          <div className="panel-heading">
            <div className="panel-heading-text">
              <div className="flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-[color:var(--text-muted)]" />
                <h3 className="font-medium">最近本地内容</h3>
              </div>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">只展示本机记录，点击打开对应工具继续处理。</p>
            </div>
          </div>
          <div className="home-recent-grid mt-4">
            <RecentList
              title="剪贴板"
              items={recentClipboard.map((item) => ({
                id: item.id,
                label: getClipboardLabel(item),
                meta: `${item.type} · ${formatTime(item.updatedAt)}`
              }))}
              emptyText="暂无剪贴板记录"
              onOpen={() => setActiveTool(TOOL_IDS.CLIPBOARD)}
            />
            <RecentList
              title="二维码"
              items={recentQrCodes.map((item: QrCodeHistoryItem) => ({
                id: item.id,
                label: item.title || '未命名二维码',
                meta: `${item.template} · ${formatTime(item.updatedAt)}`
              }))}
              emptyText="暂无二维码记录"
              onOpen={() => setActiveTool(TOOL_IDS.QRCODE)}
            />
          </div>
        </section>
      </div>

      <aside className="home-side-stack">
        <section className="glass-panel home-side-panel">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[color:var(--text-muted)]" />
            <h3 className="font-medium">最近使用</h3>
          </div>
          <div className="mt-4 space-y-2">
            {recentTools.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[var(--glass-border)] bg-[var(--glass-muted)] p-5 text-center text-sm text-[color:var(--text-muted)]">
                暂无工具使用记录
              </div>
            ) : (
              recentTools.map((item) => {
                const tool = getToolMeta(item.toolId)
                if (!tool) return null
                const IconComponent = tool.icon
                return (
                  <button
                    key={item.toolId}
                    className="home-recent-tool glass-card"
                    onClick={() => setActiveTool(item.toolId)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="icon-tile icon-tile-sm">
                        <IconComponent className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{tool.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-[color:var(--text-muted)]">
                          {formatTime(item.lastUsedAt)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[color:var(--text-muted)]">{item.count} 次</span>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="glass-panel home-side-panel">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 tone-info" />
            <h3 className="font-medium">工作入口</h3>
          </div>
          <div className="mt-4 space-y-2">
            <button className="home-entry-card glass-card" onClick={() => setActiveTool(TOOL_IDS.MANAGEMENT)}>
              <Activity className="h-4 w-4 tone-success" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">管理中心</span>
                <span className="block truncate text-xs text-[color:var(--text-muted)]">工具启用、排序和本地数据</span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[color:var(--text-muted)]" />
            </button>
            <button className="home-entry-card glass-card" onClick={() => setActiveTool(TOOL_IDS.SETTINGS)}>
              <Keyboard className="h-4 w-4 tone-info" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">偏好设置</span>
                <span className="block truncate text-xs text-[color:var(--text-muted)]">主题、启动页和隐私历史</span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[color:var(--text-muted)]" />
            </button>
          </div>
        </section>

        <section className="home-stat-grid">
          {dataStats.map((stat) => (
            <div key={stat.label} className="home-stat-card">
              <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                <Database className="h-3.5 w-3.5" />
                {stat.label}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-semibold">{stat.value}</span>
                {stat.unit && <span className="text-xs text-[color:var(--text-muted)]">{stat.unit}</span>}
              </div>
              <div className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{stat.detail}</div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  )
}

function RecentList({
  title,
  items,
  emptyText,
  onOpen
}: {
  title: string
  items: Array<{ id: string; label: string; meta: string }>
  emptyText: string
  onOpen: () => void
}): JSX.Element {
  return (
    <div className="soft-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <button className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]" onClick={onOpen}>打开</button>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="py-5 text-center text-sm text-[color:var(--text-muted)]">{emptyText}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="content-block min-w-0">
              <div className="truncate text-sm text-[color:var(--text-secondary)]">{item.label}</div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">{item.meta}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
