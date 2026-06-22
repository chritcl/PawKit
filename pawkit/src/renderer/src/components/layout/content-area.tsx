import { useAppStore } from '../../stores/app-store'
import { getToolMeta } from '../../utils/tool-registry'
import { HomePage } from '../../pages/home'
import { ManagementPage } from '../../pages/management'
import { SettingsPage } from '../../pages/settings'
import { ClipboardPage } from '../../pages/tools/clipboard'
import { ColorPickerPage } from '../../pages/tools/color-picker'
import { ScreenshotPage } from '../../pages/tools/screenshot'
import { JsonToolPage } from '../../pages/tools/json-tool'
import { TimestampToolPage } from '../../pages/tools/timestamp-tool'
import { Base64ToolPage } from '../../pages/tools/base64-tool'
import { QRCodeToolPage } from '../../pages/tools/qrcode-tool'
import { GeospatialPage } from '../../pages/tools/geospatial'

// 内容区组件
export function ContentArea(): JSX.Element {
  const activeTool = useAppStore((state) => state.activeTool)
  const toolMeta = getToolMeta(activeTool)

  // 根据当前激活的工具渲染对应的页面
  const renderPage = (): JSX.Element => {
    switch (activeTool) {
      case 'home':
        return <HomePage />
      case 'clipboard':
        return <ClipboardPage />
      case 'color-picker':
        return <ColorPickerPage />
      case 'screenshot':
        return <ScreenshotPage />
      case 'json-tool':
        return <JsonToolPage />
      case 'timestamp-tool':
        return <TimestampToolPage />
      case 'base64-tool':
        return <Base64ToolPage />
      case 'qrcode':
        return <QRCodeToolPage />
      case 'geospatial':
        return <GeospatialPage />
      case 'management':
        return <ManagementPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <HomePage />
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg-deep)]">
      {/* 工具标题 */}
      <div className="border-b border-[var(--glass-border)] bg-[var(--window-surface)] px-5 py-3">
        <h1 className="text-base font-semibold tracking-normal text-[color:var(--text-primary)]">
          {toolMeta?.name ?? '未知工具'}
        </h1>
        <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
          {toolMeta?.description ?? ''}
        </p>
      </div>

      {/* 页面内容 */}
      <div key={activeTool} className="content-scroll">{renderPage()}</div>
    </main>
  )
}
