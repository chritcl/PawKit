// 首页组件
export function HomePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:bg-white/10">
        <h2 className="text-lg font-semibold">欢迎使用 PawKit</h2>
        <p className="mt-2 text-gray-400">Windows 桌面效率工具箱</p>
        <p className="mt-1 text-sm text-gray-500">常驻系统托盘，快捷键唤起，离线可用。</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:bg-white/10">
        <h3 className="font-medium">已实现的工具</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-400">
          <li>• 剪贴板历史管理</li>
          <li>• JSON 格式化 / 压缩 / 校验</li>
          <li>• 时间戳转换</li>
          <li>• 调色板颜色转换</li>
          <li>• 截图工具</li>
          <li>• Base64 / URL 编解码</li>
          <li>• 二维码生成</li>
        </ul>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:bg-white/10">
        <h3 className="font-medium">快捷键</h3>
        <div className="mt-3 space-y-2 text-sm text-gray-400">
          <p>Alt + Space：显示 / 隐藏主窗口</p>
        </div>
      </div>
    </div>
  )
}
