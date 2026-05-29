import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import { ToolId } from '../../shared/constants'
import { AppShell } from './components/layout/app-shell'
import { ColorPickerOverlay } from './pages/tools/color-picker/color-picker-overlay'
import { ScreenshotCaptureOverlay } from './pages/tools/screenshot/screenshot-capture-overlay'

// 页面名称到工具 ID 的映射
const pageToToolId: Record<string, ToolId> = {
  clipboard: 'clipboard',
  screenshot: 'screenshot',
  'color-picker': 'color-picker'
}

function MainApp(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const initSettings = useAppStore((state) => state.initSettings)
  const setActiveTool = useAppStore((state) => state.setActiveTool)

  // 初始化设置
  useEffect(() => {
    if (window.electronAPI?.setting) {
      initSettings()
    }
  }, [initSettings])

  // 监听快捷键导航事件
  useEffect(() => {
    if (!window.electronAPI?.shortcut?.onNavigate) {
      return
    }

    const removeListener = window.electronAPI.shortcut.onNavigate((data) => {
      const toolId = pageToToolId[data.page]
      if (toolId) {
        setActiveTool(toolId)
      }
    })

    return () => {
      if (typeof removeListener === 'function') {
        removeListener()
      }
    }
  }, [setActiveTool])

  return (
    <div className={`app-root h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <AppShell />
    </div>
  )
}

function App(): JSX.Element {
  const searchParams = new URLSearchParams(window.location.search)
  const mode = searchParams.get('mode')

  if (mode === 'color-picker-overlay') {
    return <ColorPickerOverlay />
  }

  if (mode === 'screenshot-capture-overlay') {
    return <ScreenshotCaptureOverlay />
  }

  return <MainApp />
}

export default App
