import {
  AppWindow,
  Brush,
  CheckCircle2,
  History,
  Moon,
  Shield,
  SlidersHorizontal,
  Sun
} from 'lucide-react'
import { TOOL_IDS } from '../../../../shared/constants'
import { AppStartPage, AppTheme } from '../../../../shared/types'
import { useAppStore } from '../../stores/app-store'
import { ExtendedToolMeta, toolRegistry } from '../../utils/tool-registry'

function getThemeLabel(theme: AppTheme): string {
  return theme === 'dark' ? '暗色' : '浅色'
}

function getStartPageLabel(startPage: AppStartPage, tools: ExtendedToolMeta[]): string {
  if (startPage === 'last') return '上次页面'
  return tools.find((tool) => tool.id === startPage)?.name ?? '首页'
}

// 设置页组件
export function SettingsPage(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const startPage = useAppStore((state) => state.startPage)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const qrcodeHistoryLimit = useAppStore((state) => state.qrcodeHistoryLimit)
  const setTheme = useAppStore((state) => state.setTheme)
  const setStartPage = useAppStore((state) => state.setStartPage)
  const setQrcodeHistoryLimit = useAppStore((state) => state.setQrcodeHistoryLimit)

  const startPageTools = toolRegistry.filter(
    (tool) => !tool.canDisable || enabledTools.includes(tool.id)
  )
  const startPageLabel = getStartPageLabel(startPage, startPageTools)
  const summaryItems = [
    { label: '当前主题', value: getThemeLabel(theme), detail: '立即生效' },
    { label: '默认打开', value: startPageLabel, detail: '下次启动生效' },
    { label: '二维码历史', value: `${qrcodeHistoryLimit} 条`, detail: '本地保留上限' },
    { label: '可用工具', value: `${enabledTools.length} 个`, detail: '参与启动页选择' }
  ]

  return (
    <div className="settings-center">
      <section className="glass-panel settings-overview">
        <div className="settings-overview-copy">
          <div className="home-command-kicker">
            <SlidersHorizontal className="h-4 w-4 tone-info" />
            偏好中心
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">应用偏好一目了然</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
            管理主题、启动入口、历史保留和窗口行为。所有配置只保存在本机，不引入账号或同步能力。
          </p>
        </div>

        <div className="settings-summary-grid">
          {summaryItems.map((item) => (
            <div key={item.label} className="settings-summary-card">
              <div className="text-xs text-[color:var(--text-muted)]">{item.label}</div>
              <div className="mt-2 truncate text-lg font-semibold">{item.value}</div>
              <div className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="settings-layout">
        <div className="settings-primary-stack">
          <section className="glass-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <div className="flex items-center gap-2">
                  <Brush className="h-4 w-4 text-[color:var(--text-muted)]" />
                  <h3 className="font-medium">外观</h3>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">切换后立即应用到整个窗口。</p>
              </div>
            </div>

            <div className="settings-theme-grid mt-4">
              <ThemeOption
                theme="dark"
                active={theme === 'dark'}
                title="暗色"
                description="低亮度工作台，适合长期停留。"
                onClick={() => setTheme('dark')}
              />
              <ThemeOption
                theme="light"
                active={theme === 'light'}
                title="浅色"
                description="更高对比度，适合明亮环境。"
                onClick={() => setTheme('light')}
              />
            </div>
          </section>

          <section className="glass-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[color:var(--text-muted)]" />
                  <h3 className="font-medium">启动</h3>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">决定下次打开 PawKit 时进入哪个页面。</p>
              </div>
            </div>

            <div className="settings-control-grid mt-4">
              <label className="settings-field-label">
                默认打开
                <select
                  value={startPage}
                  onChange={(event) => setStartPage(event.target.value as AppStartPage)}
                  className="field-select mt-2 text-sm"
                >
                  <option value={TOOL_IDS.HOME}>首页</option>
                  <option value="last">上次页面</option>
                  {startPageTools
                    .filter((tool) => tool.id !== TOOL_IDS.HOME)
                    .map((tool) => (
                      <option key={tool.id} value={tool.id}>{tool.name}</option>
                    ))}
                </select>
              </label>
              <div className="settings-policy-card">
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                  <CheckCircle2 className="h-4 w-4 tone-success" />
                  当前策略
                </div>
                <div className="mt-3 text-lg font-medium">
                  {startPage === 'last' ? '启动后回到上次页面' : `启动后打开${startPageLabel}`}
                </div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                  禁用的工具不会继续作为启动页候选，首页和管理入口始终可用。
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[color:var(--text-muted)]" />
                  <h3 className="font-medium">隐私与历史</h3>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">控制二维码历史的本地保留数量。</p>
              </div>
            </div>

            <div className="settings-control-grid mt-4">
              <div>
                <label className="settings-field-label">
                  二维码历史保留数量
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={qrcodeHistoryLimit}
                    onChange={(event) => setQrcodeHistoryLimit(Number(event.target.value))}
                    className="field-input mt-2 text-sm"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[20, 50, 100].map((value) => (
                    <button
                      key={value}
                      className={`segmented-item border border-[var(--glass-border)] ${
                        qrcodeHistoryLimit === value ? 'segmented-item-active' : ''
                      }`}
                      onClick={() => setQrcodeHistoryLimit(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-policy-card">
                <div className="text-sm font-medium">本地保留规则</div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                  二维码历史只保存模板、内容和样式参数，不保存生成图片。设置为 0 会停止保留新的二维码历史。
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="settings-side-stack">
          <section className="glass-panel">
            <div className="flex items-center gap-2">
              <AppWindow className="h-4 w-4 text-[color:var(--text-muted)]" />
              <h3 className="font-medium">窗口行为</h3>
            </div>
            <div className="mt-4 space-y-2">
              <StatusRow label="关闭窗口" value="隐藏到系统托盘" />
              <StatusRow label="最小化" value="进入任务栏" />
              <StatusRow label="托盘常驻" value="已启用" />
              <StatusRow label="快捷键唤起" value="由管理中心控制" />
            </div>
          </section>

          <section className="glass-panel">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 tone-success" />
              <h3 className="font-medium">本地优先</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
              当前设置通过本地配置保存。导出配置和重置入口在管理中心，危险操作会保留二次确认。
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function ThemeOption({
  theme,
  active,
  title,
  description,
  onClick
}: {
  theme: AppTheme
  active: boolean
  title: string
  description: string
  onClick: () => void
}): JSX.Element {
  const IconComponent = theme === 'dark' ? Moon : Sun

  return (
    <button
      className={`settings-theme-option ${active ? 'settings-theme-option-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={`settings-theme-preview settings-theme-preview-${theme}`}>
        <span />
        <span />
        <span />
      </span>
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="icon-tile icon-tile-sm">
          <IconComponent className="h-4 w-4" />
        </span>
        <span className="min-w-0 text-left">
          <span className="block font-medium">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-[color:var(--text-muted)]">{description}</span>
        </span>
      </span>
      {active && <CheckCircle2 className="h-4 w-4 shrink-0 tone-success" />}
    </button>
  )
}

function StatusRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="soft-panel flex items-center justify-between gap-3 p-4">
      <span className="text-sm text-[color:var(--text-muted)]">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}
