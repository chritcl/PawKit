import { useEffect, useMemo, useState } from 'react'
import { Activity, Clock3, Keyboard, Star, TableProperties } from 'lucide-react'
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

  const dataStats = [
    { label: '启用工具', value: `${enabledTools.length} 个` },
    { label: '快捷键', value: getShortcutSummary(shortcuts) },
    { label: '剪贴板历史', value: `${clipboardHistory.length} 条` },
    { label: '二维码历史', value: `${qrcodeHistory.length} 条` }
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        {dataStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="text-sm text-gray-400">{stat.label}</div>
            <div className="mt-2 text-lg font-semibold">{stat.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          <h3 className="font-medium">常用工具</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickTools.map((tool) => {
            const IconComponent = tool.icon
            return (
              <button
                key={tool.id}
                className="flex min-h-28 flex-col items-start justify-between rounded-lg border border-white/10 bg-black/20 p-4 text-left transition-colors hover:bg-white/10"
                onClick={() => setActiveTool(tool.id as ToolId)}
              >
                <IconComponent className="h-5 w-5 text-sky-300" />
                <div>
                  <div className="font-medium">{tool.name}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-gray-500">{tool.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-gray-400" />
            <h3 className="font-medium">最近使用</h3>
          </div>
          <div className="mt-4 space-y-2">
            {recentTools.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
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
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 text-left transition-colors hover:bg-white/10"
                    onClick={() => setActiveTool(item.toolId)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <IconComponent className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{tool.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {item.count} 次 · {formatTime(item.lastUsedAt)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-gray-400" />
            <h3 className="font-medium">最近本地内容</h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                label: item.title,
                meta: `${item.template} · ${formatTime(item.updatedAt)}`
              }))}
              emptyText="暂无二维码记录"
              onOpen={() => setActiveTool(TOOL_IDS.QRCODE)}
            />
          </div>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <button
          className="rounded-lg border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition-colors hover:bg-white/10"
          onClick={() => setActiveTool(TOOL_IDS.MANAGEMENT)}
        >
          <Activity className="h-5 w-5 text-emerald-300" />
          <div className="mt-3 font-medium">管理中心</div>
          <div className="mt-1 text-sm text-gray-500">工具启用、排序、常用入口和本地数据</div>
        </button>
        <button
          className="rounded-lg border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition-colors hover:bg-white/10"
          onClick={() => setActiveTool(TOOL_IDS.SETTINGS)}
        >
          <Keyboard className="h-5 w-5 text-sky-300" />
          <div className="mt-3 font-medium">偏好设置</div>
          <div className="mt-1 text-sm text-gray-500">主题、启动页、隐私和窗口行为</div>
        </button>
        <div className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="text-sm text-gray-400">PawKit</div>
          <div className="mt-3 text-2xl font-semibold">v{APP_VERSION}</div>
          <div className="mt-1 text-sm text-gray-500">本地优先，配置可导出</div>
        </div>
      </section>
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
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{title}</h4>
        <button className="text-xs text-gray-500 hover:text-white" onClick={onOpen}>打开</button>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="py-5 text-center text-sm text-gray-500">{emptyText}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="min-w-0 rounded border border-white/10 bg-white/5 p-3">
              <div className="truncate text-sm text-gray-300">{item.label}</div>
              <div className="mt-1 text-xs text-gray-500">{item.meta}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
