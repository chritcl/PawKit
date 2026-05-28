import { useEffect, useState } from 'react'
import { useClipboardStore } from '../../../stores/clipboard-store'

// 剪贴板工具组件
export function ClipboardPage(): JSX.Element {
  const list = useClipboardStore((state) => state.list)
  const keyword = useClipboardStore((state) => state.keyword)
  const loading = useClipboardStore((state) => state.loading)
  const setKeyword = useClipboardStore((state) => state.setKeyword)
  const getFilteredList = useClipboardStore((state) => state.getFilteredList)
  const removeItem = useClipboardStore((state) => state.removeItem)
  const clearList = useClipboardStore((state) => state.clearList)
  const toggleFavorite = useClipboardStore((state) => state.toggleFavorite)
  const writeText = useClipboardStore((state) => state.writeText)
  const init = useClipboardStore((state) => state.init)

  const [showConfirm, setShowConfirm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 进入页面时获取历史并监听变化
  useEffect(() => {
    return init()
  }, [init])

  // 复制到剪贴板
  const handleCopy = (id: string, text: string): void => {
    writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // 清空确认
  const handleClearConfirm = (): void => {
    clearList(true)
    setShowConfirm(false)
  }

  // 格式化时间
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取过滤后的列表
  const filteredList = getFilteredList()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索剪贴板历史..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
        />
        {/* 数量展示 */}
        <span className="text-sm text-gray-500">
          {list.length} 条记录
        </span>
        {/* 清空按钮 */}
        <button
          className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
          onClick={() => setShowConfirm(true)}
        >
          清空
        </button>
      </div>

      {/* 历史列表 */}
      <div className="flex-1 overflow-auto py-4">
        {filteredList.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            {keyword ? '没有找到匹配的记录' : '暂无剪贴板历史'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="group rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors hover:bg-white/10"
              >
                <div className="flex items-start justify-between">
                  {/* 内容预览 */}
                  <div className="flex-1 overflow-hidden">
                    <div className="max-h-20 overflow-hidden text-sm text-gray-300 whitespace-pre-wrap break-all">
                      {item.content}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatTime(item.updatedAt)}</span>
                      <span>{item.content.length} 字符</span>
                      {item.favorite && (
                        <span className="text-yellow-400">★ 已收藏</span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="ml-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* 收藏按钮 */}
                    <button
                      className={`rounded p-1 transition-colors ${
                        item.favorite
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-gray-500 hover:text-yellow-400'
                      }`}
                      onClick={() => toggleFavorite(item.id)}
                      title={item.favorite ? '取消收藏' : '收藏'}
                    >
                      {item.favorite ? '★' : '☆'}
                    </button>
                    {/* 复制按钮 */}
                    <button
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        copiedId === item.id
                          ? 'text-green-400'
                          : 'text-gray-500 hover:text-green-400'
                      }`}
                      onClick={() => handleCopy(item.id, item.content)}
                      title="复制"
                    >
                      {copiedId === item.id ? '已复制' : '复制'}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      className="rounded p-1 text-gray-500 transition-colors hover:text-red-400"
                      onClick={() => removeItem(item.id)}
                      title="删除"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-lg border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold">确认清空</h3>
            <p className="mt-2 text-sm text-gray-400">
              此操作将清空所有剪贴板历史（收藏内容将保留）。是否继续？
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
                onClick={handleClearConfirm}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
