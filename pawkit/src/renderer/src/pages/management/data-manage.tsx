import { useEffect, useState } from 'react'
import { ClipboardCopy, Download, RefreshCcw, RotateCcw } from 'lucide-react'
import { APP_VERSION } from '../../../../shared/constants'
import { AppSettings, ShortcutStatusItem } from '../../../../shared/types'
import { useAppStore } from '../../stores/app-store'

function countToolUsage(settings: AppSettings | null): number {
  return settings?.app?.toolUsage?.reduce((sum, item) => sum + item.count, 0) ?? 0
}

// 数据管理组件
export function DataManage(): JSX.Element {
  const refreshSettings = useAppStore((state) => state.refreshSettings)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [shortcuts, setShortcuts] = useState<ShortcutStatusItem[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async (): Promise<void> => {
    const [nextSettings, nextShortcuts] = await Promise.all([
      window.electronAPI?.setting?.getAll?.(),
      window.electronAPI?.shortcut?.getStatus?.()
    ])
    if (nextSettings) setSettings(nextSettings)
    if (nextShortcuts) setShortcuts(nextShortcuts)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.electronAPI?.setting?.getAll?.(),
      window.electronAPI?.shortcut?.getStatus?.()
    ]).then(([nextSettings, nextShortcuts]) => {
      if (cancelled) return
      if (nextSettings) setSettings(nextSettings)
      if (nextShortcuts) setShortcuts(nextShortcuts)
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const handleExport = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.electronAPI.setting.exportConfig()
      setMessage(result.message)
    } catch {
      setMessage('导出配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyDiagnostics = async (): Promise<void> => {
    const payload = {
      appVersion: APP_VERSION,
      createdAt: new Date().toISOString(),
      counts: {
        enabledTools: settings?.app?.enabledTools?.length ?? 0,
        toolUsage: countToolUsage(settings),
        clipboardHistory: settings?.clipboard?.history?.length ?? 0,
        colorFavorites: settings?.color?.favorites?.length ?? 0,
        colorRecent: settings?.color?.recent?.length ?? 0,
        qrcodeHistory: settings?.qrcode?.history?.length ?? 0
      },
      app: {
        theme: settings?.app?.theme,
        startPage: settings?.app?.startPage,
        lastActiveTool: settings?.app?.lastActiveTool,
        enabledTools: settings?.app?.enabledTools
      },
      management: {
        toolOrder: settings?.management?.toolOrder,
        favoriteTools: settings?.management?.favoriteTools
      },
      shortcuts: shortcuts.map((item) => ({
        key: item.key,
        accelerator: item.accelerator,
        enabled: item.enabled,
        status: item.status
      }))
    }

    await window.electronAPI.clipboard.writeText(JSON.stringify(payload, null, 2))
    setMessage('诊断信息已复制')
  }

  const handleReset = async (): Promise<void> => {
    setLoading(true)
    try {
      await window.electronAPI.setting.reset()
      await refreshSettings()
      await loadData()
      setMessage('配置已恢复默认')
      setShowConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const dataStats = [
    { label: '剪贴板历史', value: settings?.clipboard?.history?.length ?? 0, unit: '条' },
    { label: '颜色收藏', value: settings?.color?.favorites?.length ?? 0, unit: '个' },
    { label: '最近颜色', value: settings?.color?.recent?.length ?? 0, unit: '个' },
    { label: '二维码历史', value: settings?.qrcode?.history?.length ?? 0, unit: '条' },
    { label: '工具使用次数', value: countToolUsage(settings), unit: '次' },
    { label: '首页常用工具', value: settings?.management?.favoriteTools?.length ?? 0, unit: '个' }
  ]

  return (
    <div className="page-stack">
      <section className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">本地数据统计</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">仅统计数量和配置状态，不展示完整内容</p>
          </div>
          <button
            className="toolbar-button"
            onClick={() => loadData().then(() => setMessage('统计已刷新')).catch(() => setMessage('刷新失败'))}
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="data-grid mt-4">
          {dataStats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="text-sm text-[color:var(--text-muted)]">{stat.label}</div>
              <div className="mt-2 text-lg font-medium">
                {stat.value} {stat.unit}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">配置与维护</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">导出配置、复制诊断信息或恢复默认配置</p>
          </div>
          {message && <span className="text-sm text-[color:var(--text-muted)]">{message}</span>}
        </div>

        <div className="data-grid mt-4">
          <button
            className="glass-card p-4 text-left disabled:opacity-60"
            onClick={handleExport}
            disabled={loading}
          >
            <Download className="h-5 w-5 text-sky-300" />
            <div className="mt-3 font-medium">导出配置</div>
            <div className="mt-1 text-sm text-[color:var(--text-muted)]">保存 UTF-8 JSON 配置文件</div>
          </button>

          <button
            className="glass-card p-4 text-left"
            onClick={handleCopyDiagnostics}
          >
            <ClipboardCopy className="h-5 w-5 text-emerald-300" />
            <div className="mt-3 font-medium">复制诊断信息</div>
            <div className="mt-1 text-sm text-[color:var(--text-muted)]">复制版本、数量和快捷键状态</div>
          </button>

          <button
            className="rounded-[9px] border border-red-500/20 bg-red-500/10 p-4 text-left transition-colors hover:bg-red-500/15"
            onClick={() => setShowConfirm(true)}
          >
            <RotateCcw className="h-5 w-5 text-red-300" />
            <div className="mt-3 font-medium text-red-300">重置配置</div>
            <div className="mt-1 text-sm text-[color:var(--text-muted)]">恢复默认设置并清空本地配置</div>
          </button>
        </div>
      </section>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="modal-surface w-96 rounded-[14px] p-6">
            <h3 className="text-lg font-semibold">确认重置</h3>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              此操作会恢复默认配置，并清空剪贴板、颜色、二维码历史和工具偏好。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="toolbar-button"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="toolbar-button-danger disabled:opacity-60"
                onClick={handleReset}
                disabled={loading}
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
