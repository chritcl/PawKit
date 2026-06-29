import { useAppStore } from '../../stores/app-store'
import { TOOL_IDS, type ToolId } from '../../../../shared/constants'
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
import { MediaPlayerPage } from '../../pages/tools/media-player'
import { HttpApiToolPage } from '../../pages/tools/http-api-tool'
import { GeospatialPage } from '../../pages/tools/geospatial'

const toolPages: Record<ToolId, () => JSX.Element> = {
  [TOOL_IDS.HOME]: HomePage,
  [TOOL_IDS.CLIPBOARD]: ClipboardPage,
  [TOOL_IDS.COLOR_PICKER]: ColorPickerPage,
  [TOOL_IDS.SCREENSHOT]: ScreenshotPage,
  [TOOL_IDS.JSON_TOOL]: JsonToolPage,
  [TOOL_IDS.TIMESTAMP_TOOL]: TimestampToolPage,
  [TOOL_IDS.BASE64_TOOL]: Base64ToolPage,
  [TOOL_IDS.QRCODE]: QRCodeToolPage,
  [TOOL_IDS.MEDIA_PLAYER]: MediaPlayerPage,
  [TOOL_IDS.HTTP_API_TOOL]: HttpApiToolPage,
  [TOOL_IDS.GEOSPATIAL]: GeospatialPage,
  [TOOL_IDS.MANAGEMENT]: ManagementPage,
  [TOOL_IDS.SETTINGS]: SettingsPage
}

export function ContentArea(): JSX.Element {
  const activeTool = useAppStore((state) => state.activeTool)
  const toolMeta = getToolMeta(activeTool)
  const Page = toolPages[activeTool] ?? HomePage

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg-deep)]">
      <div className="border-b border-[var(--glass-border)] bg-[var(--window-surface)] px-5 py-3">
        <h1 className="text-base font-semibold tracking-normal text-[color:var(--text-primary)]">
          {toolMeta?.name ?? '未知工具'}
        </h1>
        <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
          {toolMeta?.description ?? ''}
        </p>
      </div>

      <div key={activeTool} className="content-scroll"><Page /></div>
    </main>
  )
}
