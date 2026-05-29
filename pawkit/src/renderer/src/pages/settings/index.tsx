import { AppWindow, Brush, History, Shield } from 'lucide-react'
import { TOOL_IDS } from '../../../../shared/constants'
import { AppStartPage, AppTheme } from '../../../../shared/types'
import { useAppStore } from '../../stores/app-store'
import { toolRegistry } from '../../utils/tool-registry'

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

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Brush className="h-4 w-4 text-gray-400" />
          <h3 className="font-medium">外观</h3>
        </div>
        <div className="mt-4 flex max-w-md rounded-lg border border-white/10 bg-black/20 p-1">
          {(['dark', 'light'] as AppTheme[]).map((item) => (
            <button
              key={item}
              className={`flex-1 rounded-md px-4 py-2 text-sm transition-colors ${
                theme === item ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setTheme(item)}
            >
              {item === 'dark' ? '暗色' : '浅色'}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-400" />
          <h3 className="font-medium">启动</h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm text-gray-400">
            默认打开
            <select
              value={startPage}
              onChange={(event) => setStartPage(event.target.value as AppStartPage)}
              className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
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
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-gray-400">当前策略</div>
            <div className="mt-2 text-lg font-medium">
              {startPage === 'last'
                ? '启动后回到上次页面'
                : startPageTools.find((tool) => tool.id === startPage)?.name ?? '首页'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-400" />
          <h3 className="font-medium">隐私与历史</h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <label className="text-sm text-gray-400">
            二维码历史保留数量
            <input
              type="number"
              min={0}
              max={200}
              value={qrcodeHistoryLimit}
              onChange={(event) => setQrcodeHistoryLimit(Number(event.target.value))}
              className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
            />
          </label>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
            二维码历史只保存模板、内容和样式参数，不保存生成图片。管理中心的重置配置会清空本地历史和偏好。
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[20, 50, 100].map((value) => (
            <button
              key={value}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                qrcodeHistoryLimit === value ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
              onClick={() => setQrcodeHistoryLimit(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <AppWindow className="h-4 w-4 text-gray-400" />
          <h3 className="font-medium">窗口行为</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StatusRow label="关闭窗口" value="隐藏到系统托盘" />
          <StatusRow label="最小化" value="进入任务栏" />
          <StatusRow label="托盘常驻" value="已启用" />
          <StatusRow label="快捷键唤起" value="由管理中心控制" />
        </div>
      </section>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-4">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
