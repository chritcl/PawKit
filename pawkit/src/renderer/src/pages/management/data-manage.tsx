import { useEffect, useState } from 'react'
import { AppSettings } from '../../../../shared/types'

// 数据管理组件
export function DataManage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // 加载设置
  useEffect(() => {
    if (window.electronAPI?.setting?.getAll) {
      window.electronAPI.setting.getAll().then(setSettings).catch(() => {})
    }
  }, [])

  // 重置配置
  const handleReset = async (): Promise<void> => {
    await window.electronAPI.setting.reset()
    const newSettings = await window.electronAPI.setting.getAll()
    setSettings(newSettings)
    setShowConfirm(false)
    // 刷新页面以应用默认设置
    window.location.reload()
  }

  // 数据统计
  const dataStats = [
    {
      label: '剪贴板历史',
      value: settings?.clipboard?.history?.length ?? 0,
      unit: '条'
    },
    {
      label: '颜色收藏',
      value: settings?.color?.favorites?.length ?? 0,
      unit: '个'
    },
    {
      label: '最近颜色',
      value: settings?.color?.recent?.length ?? 0,
      unit: '个'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">数据统计</h3>
        <p className="mt-1 text-sm text-gray-400">本地数据存储情况</p>

        <div className="mt-4 space-y-3">
          {dataStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10"
            >
              <span className="text-gray-400">{stat.label}</span>
              <span className="font-medium">
                {stat.value} {stat.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">数据管理</h3>
        <p className="mt-1 text-sm text-gray-400">管理本地数据</p>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">导出配置</div>
                <div className="mt-1 text-sm text-gray-400">导出应用配置到文件（远期功能）</div>
              </div>
              <button
                className="rounded-lg bg-white/10 px-3 py-1 text-sm text-gray-400"
                disabled
              >
                导出
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">导入配置</div>
                <div className="mt-1 text-sm text-gray-400">从文件导入应用配置（远期功能）</div>
              </div>
              <button
                className="rounded-lg bg-white/10 px-3 py-1 text-sm text-gray-400"
                disabled
              >
                导入
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 backdrop-blur-xl transition-colors hover:bg-red-500/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-red-400">重置配置</div>
                <div className="mt-1 text-sm text-gray-400">将所有设置恢复为默认值</div>
              </div>
              <button
                className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-400 hover:bg-red-500/30"
                onClick={() => setShowConfirm(true)}
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-lg border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold">确认重置</h3>
            <p className="mt-2 text-sm text-gray-400">
              此操作将清除所有本地配置，恢复为默认设置。是否继续？
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
                onClick={handleReset}
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
