import { useState, useEffect, useRef } from 'react'
import { ShortcutStatusItem, ShortcutKey } from '../../../../shared/types'

// 状态映射
const statusMap: Record<string, { text: string; color: string }> = {
  registered: { text: '已注册', color: 'text-green-400' },
  failed: { text: '注册失败', color: 'text-red-400' },
  conflict: { text: '应用内冲突', color: 'text-yellow-400' },
  invalid: { text: '格式错误', color: 'text-red-400' },
  disabled: { text: '已禁用', color: 'text-[color:var(--text-muted)]' }
}

// 快捷键管理组件
export function ShortcutManage(): JSX.Element {
  const [shortcuts, setShortcuts] = useState<ShortcutStatusItem[]>([])
  const [editingKey, setEditingKey] = useState<ShortcutKey | null>(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  // 加载快捷键状态
  const loadShortcuts = async (): Promise<void> => {
    try {
      if (!window.electronAPI?.shortcut?.getStatus) {
        setLoading(false)
        return
      }
      const status = await window.electronAPI.shortcut.getStatus()
      setShortcuts(status)
    } catch (err) {
      console.error('加载快捷键状态失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadShortcuts()
    }
  }, [])

  // 开始编辑
  const handleStartEdit = (item: ShortcutStatusItem): void => {
    setEditingKey(item.key)
    setEditValue(item.accelerator)
    setError(null)
  }

  // 取消编辑
  const handleCancelEdit = (): void => {
    setEditingKey(null)
    setEditValue('')
    setError(null)
  }

  // 保存快捷键
  const handleSave = async (key: ShortcutKey): Promise<void> => {
    try {
      setError(null)
      const item = shortcuts.find((s) => s.key === key)
      if (!item) return

      await window.electronAPI.shortcut.update({
        key,
        accelerator: editValue,
        enabled: item.enabled
      })

      setEditingKey(null)
      setEditValue('')
      await loadShortcuts()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  // 切换启用状态
  const handleToggleEnabled = async (key: ShortcutKey, enabled: boolean): Promise<void> => {
    try {
      setError(null)
      await window.electronAPI.shortcut.setEnabled({ key, enabled })
      await loadShortcuts()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  // 重置为默认值
  const handleReset = async (): Promise<void> => {
    try {
      setError(null)
      await window.electronAPI.shortcut.reset()
      await loadShortcuts()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        加载中...
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">全局快捷键</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              全局快捷键会在应用启动时自动注册。如果某个快捷键注册失败，通常是因为已被系统或其他应用占用。
            </p>
          </div>
          <button
            className="toolbar-button"
            onClick={handleReset}
          >
            恢复默认
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-[10px] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {shortcuts.map((item) => {
            const status = statusMap[item.status] || statusMap.disabled
            const isEditing = editingKey === item.key

            return (
              <div
                key={item.key}
                className="glass-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{item.label}</span>
                      <span className={`text-xs ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">{item.description}</p>
                    {item.errorMessage && (
                      <p className="mt-1 text-xs text-red-400">{item.errorMessage}</p>
                    )}
                  </div>

                  <div className="toolbar-group">
                    {isEditing ? (
                      <div className="toolbar-group">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="field-input h-8 min-h-8 w-32 px-2 py-1 text-sm"
                          placeholder="如 Alt+V"
                        />
                        <button
                          className="toolbar-button min-h-8 border-green-500/20 bg-green-500/15 px-2 py-1 text-xs text-green-400 hover:bg-green-500/20"
                          onClick={() => handleSave(item.key)}
                        >
                          保存
                        </button>
                        <button
                          className="toolbar-button min-h-8 px-2 py-1 text-xs"
                          onClick={handleCancelEdit}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="chip font-mono text-sm">
                          {item.accelerator}
                        </span>
                        <button
                          className="toolbar-button min-h-8 px-2 py-1 text-xs"
                          onClick={() => handleStartEdit(item)}
                        >
                          修改
                        </button>
                        <button
                          className={`toolbar-button min-h-8 px-2 py-1 text-xs ${
                            item.enabled
                              ? 'border-green-500/20 bg-green-500/15 text-green-400'
                              : ''
                          }`}
                          onClick={() => handleToggleEnabled(item.key, !item.enabled)}
                        >
                          {item.enabled ? '已启用' : '已禁用'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
