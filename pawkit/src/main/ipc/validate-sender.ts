import { IpcMainInvokeEvent, app } from 'electron'

// 开发服务器允许的本地主机名
const DEV_HOSTNAMES = ['localhost', '127.0.0.1', '::1']

// 获取开发服务器端口（优先读环境变量，回退 5173）
function getDevServerPort(): number {
  const url = process.env.ELECTRON_RENDERER_URL
  if (url) {
    try {
      return parseInt(new URL(url).port, 10)
    } catch {
      // 解析失败，使用默认端口
    }
  }
  return 5573
}

// 校验 IPC sender 是否来自应用自身
export function validateSender(event: IpcMainInvokeEvent): boolean {
  // 检查 sender 是否存在
  if (!event.sender) {
    console.warn('IPC 请求被拒绝：sender 不存在')
    return false
  }

  // 检查 sender 是否已被销毁
  if (event.sender.isDestroyed()) {
    console.warn('IPC 请求被拒绝：sender 已销毁')
    return false
  }

  // 检查 sender 的 URL 是否来自应用
  const url = event.sender.getURL()
  if (!url) {
    console.warn('IPC 请求被拒绝：sender URL 为空')
    return false
  }

  // 允许来自本地文件的请求（打包后的应用）
  if (url.startsWith('file://')) {
    const appPath = app.getAppPath()
    // 规范化路径，处理 Windows 反斜杠
    const normalizedAppPath = appPath.replace(/\\/g, '/')
    const urlPath = new URL(url).pathname.replace(/\\/g, '/')
    // Windows 下 URL pathname 可能带 /C:/ 前缀，去掉开头的 /
    const cleanUrlPath = urlPath.replace(/^\/([A-Za-z]:)/, '$1')
    if (cleanUrlPath.startsWith(normalizedAppPath) || urlPath.includes('/out/renderer/')) {
      return true
    }
    console.warn(`IPC 请求被拒绝：非应用本地文件 ${url}`)
    return false
  }

  // 允许来自本地开发服务器的请求
  if (url.startsWith('http://')) {
    try {
      const urlObj = new URL(url)
      const port = getDevServerPort()
      if (DEV_HOSTNAMES.includes(urlObj.hostname) && urlObj.port === String(port)) {
        return true
      }
      console.warn(`IPC 请求被拒绝：非开发服务器 ${urlObj.hostname}:${urlObj.port}（期望端口 ${port}）`)
      return false
    } catch {
      console.warn(`IPC 请求被拒绝：无效的 URL ${url}`)
      return false
    }
  }

  console.warn(`IPC 请求被拒绝：未知来源 ${url}`)
  return false
}
