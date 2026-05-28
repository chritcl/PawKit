import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import { ToolId } from '../../shared/constants'
import { AppShell } from './components/layout/app-shell'

// 页面名称到工具 ID 的映射
const pageToToolId: Record<string, ToolId> = {
  clipboard: 'clipboard',
  screenshot: 'screenshot',
  'color-picker': 'color-picker'
}

function App(): JSX.Element {
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
    <div className={`h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <AppShell />
    </div>
  )
}

export default App
