import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import { TOOL_IDS, type ToolId } from '../../shared/constants'
import { useImageToolStore } from './stores/image-tool-store'
import { useOcrToolStore } from './stores/ocr-tool-store'
import { AppShell } from './components/layout/app-shell'
import { ColorPickerOverlay } from './pages/tools/color-picker/color-picker-overlay'
import { ScreenCaptureOverlay } from './pages/tools/screenshot/screen-capture-overlay'
import { PinnedOverlay } from './pages/tools/screenshot/pinned-overlay'

// 页面名称到工具 ID 的映射
const pageToToolId: Record<string, ToolId> = {
  clipboard: 'clipboard',
  screenshot: 'screenshot',
  'color-picker': 'color-picker',
  'image-tool': 'image-tool',
  'ocr-tool': 'ocr-tool'
}

function MainApp(): JSX.Element {
  const theme = useAppStore((state) => state.theme)
  const initSettings = useAppStore((state) => state.initSettings)
  const setActiveTool = useAppStore((state) => state.setActiveTool)
  const setEnabledTools = useAppStore((state) => state.setEnabledTools)
  const addImageSources = useImageToolStore((state) => state.addSources)
  const addOcrSources = useOcrToolStore((state) => state.addSources)

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

  // 监听其他工具发送到图片处理的事件
  useEffect(() => {
    if (!window.electronAPI?.imageTool?.onOpenSource) return

    const removeListener = window.electronAPI.imageTool.onOpenSource((source) => {
      const state = useAppStore.getState()
      if (!state.enabledTools.includes(TOOL_IDS.IMAGE_TOOL)) {
        setEnabledTools([...state.enabledTools, TOOL_IDS.IMAGE_TOOL])
      }
      addImageSources([source])
      setActiveTool(TOOL_IDS.IMAGE_TOOL)
    })

    return () => {
      removeListener()
    }
  }, [addImageSources, setActiveTool, setEnabledTools])

  // 监听其他工具发送到 OCR 识别的事件
  useEffect(() => {
    if (!window.electronAPI?.ocr?.onOpenSource) return

    const removeListener = window.electronAPI.ocr.onOpenSource((source) => {
      const state = useAppStore.getState()
      if (!state.enabledTools.includes(TOOL_IDS.OCR_TOOL)) {
        setEnabledTools([...state.enabledTools, TOOL_IDS.OCR_TOOL])
      }
      addOcrSources([source])
      setActiveTool(TOOL_IDS.OCR_TOOL)
    })

    return () => {
      removeListener()
    }
  }, [addOcrSources, setActiveTool, setEnabledTools])

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

  if (mode === 'screen-capture-overlay') {
    return <ScreenCaptureOverlay />
  }

  if (mode === 'pinned-overlay') {
    return <PinnedOverlay />
  }

  return <MainApp />
}

export default App
