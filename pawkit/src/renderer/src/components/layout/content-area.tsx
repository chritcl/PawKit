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

// 内容区组件
export function ContentArea(): JSX.Element {
  const activeTool = useAppStore((state) => state.activeTool)
  const theme = useAppStore((state) => state.theme)
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
      case 'management':
        return <ManagementPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <HomePage />
    }
  }

  return (
    <div
      className={`flex-1 overflow-auto backdrop-blur-xl ${
        theme === 'dark' ? 'bg-white/5' : 'bg-white/30'
      }`}
    >
      {/* 工具标题 */}
      <div className={`border-b px-6 py-4 ${theme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
        <h1 className="text-lg font-semibold">{toolMeta?.name ?? '未知工具'}</h1>
        <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {toolMeta?.description ?? ''}
        </p>
      </div>

      {/* 页面内容 */}
      <div className="p-6">{renderPage()}</div>
    </div>
  )
}
