import { useEffect, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Keyboard,
  MousePointer2,
  Palette,
  Settings2
} from 'lucide-react'
import type {
  ScreenshotPreferences,
  ShortcutStatusItem
} from '../../../../../shared/types'

const DEFAULT_PREFERENCES: ScreenshotPreferences = {
  annotationColor: '#ff4d4f',
  strokeWidth: 4
}

// 截图启动与默认设置页面
export function ScreenshotPage(): JSX.Element {
  const [preferences, setPreferences] = useState<ScreenshotPreferences>(DEFAULT_PREFERENCES)
  const [shortcut, setShortcut] = useState<ShortcutStatusItem | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      window.electronAPI.setting.get<ScreenshotPreferences>('screenshot.preferences'),
      window.electronAPI.shortcut.getStatus()
    ]).then(([saved, statuses]) => {
      if (saved) setPreferences(normalizePreferences(saved))
      setShortcut(statuses.find((item) => item.key === 'screenshot') ?? null)
    })
  }, [])

  const startCapture = async (): Promise<void> => {
    setIsStarting(true)
    setMessage(null)
    try {
      const response = await window.electronAPI.screenCapture.start()
      if (response.status !== 'started' && response.status !== 'busy') {
        setMessage(response.message)
      }
    } catch {
      setMessage('启动截图失败')
    } finally {
      setIsStarting(false)
    }
  }

  const updatePreferences = async (next: ScreenshotPreferences): Promise<void> => {
    const normalized = normalizePreferences(next)
    setPreferences(normalized)
    const success = await window.electronAPI.setting.set('screenshot.preferences', normalized)
    setMessage(success ? '截图默认设置已保存' : '保存截图默认设置失败')
  }

  return (
    <div className="tool-page">
      <div className="toolbar-surface tool-toolbar">
        <button
          className="toolbar-button-primary disabled:opacity-60"
          onClick={() => void startCapture()}
          disabled={isStarting}
          title="开始截图"
        >
          <Camera className="h-4 w-4" />
          {isStarting ? '正在冻结屏幕...' : '开始截图'}
        </button>
        <div className="toolbar-push flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
          <Keyboard className="h-4 w-4" />
          {shortcut?.accelerator ?? 'Alt+A'}
          {shortcut?.registered && <CheckCircle2 className="h-4 w-4 text-[color:var(--tone-success)]" />}
        </div>
      </div>

      {message && <div className="status-strip text-sm text-[color:var(--text-secondary)]">{message}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,360px)_1fr] gap-4">
        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-[rgb(var(--color-primary-rgb))]" />
              默认标注设置
            </div>
          </div>
          <div className="panel-body space-y-6 p-5">
            <label className="block">
              <div className="mb-2 flex items-center justify-between text-sm text-[color:var(--text-secondary)]">
                <span className="flex items-center gap-2"><Palette className="h-4 w-4" />标注颜色</span>
                <span className="font-mono text-xs">{preferences.annotationColor}</span>
              </div>
              <input
                type="color"
                value={preferences.annotationColor}
                onChange={(event) => void updatePreferences({ ...preferences, annotationColor: event.target.value })}
                className="h-10 w-full cursor-pointer rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] p-1"
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center justify-between text-sm text-[color:var(--text-secondary)]">
                <span>默认线宽</span>
                <span>{preferences.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min={2}
                max={14}
                value={preferences.strokeWidth}
                onChange={(event) => void updatePreferences({ ...preferences, strokeWidth: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          </div>
        </section>

        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MousePointer2 className="h-4 w-4 text-[rgb(var(--color-primary-rgb))]" />
              截图操作
            </div>
          </div>
          <div className="panel-body grid grid-cols-2 gap-3 p-5 text-sm text-[color:var(--text-secondary)]">
            <Operation label="拖拽" description="创建选区；轻点选择当前显示器全屏" />
            <Operation label="移动与缩放" description="拖动选区内部或八个控制点" />
            <Operation label="Enter / 双击" description="完成截图、复制到剪贴板并关闭" />
            <Operation label="Ctrl+C / Ctrl+S" description="复制截图或打开保存对话框" />
            <Operation label="右键" description="取消当前操作、清空选区或退出截图" />
            <Operation label="Esc" description="立即取消整个截图会话" />
          </div>
        </section>
      </div>
    </div>
  )
}

function Operation({ label, description }: { label: string; description: string }): JSX.Element {
  return (
    <div className="soft-panel p-4">
      <div className="font-medium text-[color:var(--text-primary)]">{label}</div>
      <div className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{description}</div>
    </div>
  )
}

function normalizePreferences(value: ScreenshotPreferences): ScreenshotPreferences {
  return {
    annotationColor: /^#[0-9a-fA-F]{6}$/.test(value.annotationColor)
      ? value.annotationColor
      : DEFAULT_PREFERENCES.annotationColor,
    strokeWidth: Number.isFinite(value.strokeWidth)
      ? Math.min(14, Math.max(2, Math.round(value.strokeWidth)))
      : DEFAULT_PREFERENCES.strokeWidth
  }
}
