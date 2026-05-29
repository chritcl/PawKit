import { KeyboardEvent, useEffect, useState } from 'react'
import {
  ClipboardCopy,
  Eraser,
  ExternalLink,
  FileJson,
  Files,
  FileText,
  Image as ImageIcon,
  ListFilter,
  Star,
  Terminal,
  Trash2
} from 'lucide-react'
import { ClipboardFileItem, ClipboardImageItem, ClipboardItem } from '../../../../../shared/types'
import { useClipboardStore } from '../../../stores/clipboard-store'

type ClipboardFilter = 'all' | 'text' | 'image' | 'file' | 'richText' | 'favorite'
type ClipboardKind = 'url' | 'json' | 'command' | 'code' | 'long' | 'text'

const commandPattern = /^(pnpm|npm|npx|yarn|git|docker|kubectl|curl|ssh|cd|ls|dir|cmd|powershell)\b/i

const kindMeta: Record<ClipboardKind, { label: string; className: string }> = {
  url: { label: '链接', className: 'border-sky-400/30 bg-sky-500/10 text-sky-300' },
  json: { label: 'JSON', className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
  command: { label: '命令', className: 'border-violet-400/30 bg-violet-500/10 text-violet-300' },
  code: { label: '代码', className: 'border-blue-400/30 bg-blue-500/10 text-blue-300' },
  long: { label: '长文本', className: 'border-amber-400/30 bg-amber-500/10 text-amber-300' },
  text: { label: '文本', className: 'border-white/10 bg-white/10 text-gray-300' }
}

const typeMeta = {
  image: { label: '图片', className: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200' },
  file: { label: '文件', className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200' },
  richText: { label: '富文本', className: 'border-lime-400/30 bg-lime-500/10 text-lime-200' }
}

const filterOptions: Array<{ key: ClipboardFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '图片' },
  { key: 'file', label: '文件' },
  { key: 'richText', label: '富文本' },
  { key: 'favorite', label: '收藏' }
]

// 判断文本内容类型，用于列表中的轻量提示
function getClipboardKind(content: string): ClipboardKind {
  const trimmed = content.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      new URL(trimmed)
      return 'url'
    } catch {
      return 'text'
    }
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      return 'code'
    }
  }

  if (commandPattern.test(trimmed)) {
    return 'command'
  }

  if (/(\b(import|export|const|let|function|class|interface|return)\b|=>|;\s*$)/m.test(content)) {
    return 'code'
  }

  if (content.length > 500 || content.split(/\r?\n/).length > 8) {
    return 'long'
  }

  return 'text'
}

// 格式化时间
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取可见预览文本
function getPreviewText(content: string): string {
  if (content.length === 0) return '空文本'
  if (content.trim().length === 0) return '空白文本'
  return content
}

// 获取历史项标签
function getItemMeta(item: ClipboardItem): { label: string; className: string } {
  if (item.type === 'image') return typeMeta.image
  if (item.type === 'file') return typeMeta.file
  if (item.type === 'richText') return typeMeta.richText
  return kindMeta[getClipboardKind(item.content)]
}

// 获取历史项补充信息
function getItemStats(item: ClipboardItem): string {
  if (item.type === 'image') {
    return `${item.width} × ${item.height} · ${(item.size / 1024).toFixed(1)} KB`
  }
  if (item.type === 'file') {
    return `${item.files.length} 个文件`
  }
  if (item.type === 'richText') {
    return `${item.content.length} 字符预览`
  }
  return `${item.content.length} 字符`
}

// 渲染类型图标
function TypeIcon({ item }: { item: ClipboardItem }): JSX.Element | null {
  if (item.type === 'image') return <ImageIcon className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
  if (item.type === 'file') return <Files className="h-4 w-4 text-cyan-300" aria-hidden="true" />
  if (item.type === 'richText') return <FileText className="h-4 w-4 text-lime-300" aria-hidden="true" />

  const kind = getClipboardKind(item.content)
  if (kind === 'json') return <FileJson className="h-4 w-4 text-emerald-400" aria-hidden="true" />
  if (kind === 'command') return <Terminal className="h-4 w-4 text-violet-400" aria-hidden="true" />
  return null
}

// 图片预览
function ImagePreview({ item }: { item: ClipboardImageItem }): JSX.Element {
  return (
    <div className="mt-3 overflow-hidden rounded border border-white/10 bg-black/20">
      <img
        src={item.thumbnailDataUrl}
        alt="剪贴板图片"
        className="max-h-44 w-full object-contain"
        draggable={false}
      />
    </div>
  )
}

// 文件预览
function FilePreview({ item }: { item: ClipboardFileItem }): JSX.Element {
  const visibleFiles = item.files.slice(0, 4)
  const hiddenCount = Math.max(item.files.length - visibleFiles.length, 0)

  return (
    <div className="mt-3 space-y-1 rounded border border-white/10 bg-black/20 p-3">
      {visibleFiles.map((file) => (
        <div key={file.path} className="flex min-w-0 items-center gap-2 text-xs text-gray-300">
          <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span className="truncate" title={file.path}>{file.name || file.path}</span>
          {!file.exists && <span className="shrink-0 text-amber-300">已失效</span>}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="text-xs text-gray-500">还有 {hiddenCount} 个文件</div>
      )}
    </div>
  )
}

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
  const copyItem = useClipboardStore((state) => state.copyItem)
  const init = useClipboardStore((state) => state.init)

  const [showConfirm, setShowConfirm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ClipboardFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  // 进入页面时获取历史并监听变化
  useEffect(() => {
    return init()
  }, [init])

  const baseList = getFilteredList()
  const filteredList = baseList.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'favorite') return item.favorite
    return item.type === filter
  })
  const activeSelectedId = filteredList.some((item) => item.id === selectedId)
    ? selectedId
    : filteredList[0]?.id ?? null

  // 复制到剪贴板
  const handleCopy = async (item: ClipboardItem): Promise<void> => {
    const result = await copyItem(item.id)
    setCopyMessage(result.message ?? (result.success ? '已复制到剪贴板' : '复制失败'))
    window.setTimeout(() => setCopyMessage(null), 2200)
    if (!result.success) return
    setSelectedId(item.id)
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  // 清空确认
  const handleClearConfirm = (): void => {
    clearList(true)
    setShowConfirm(false)
  }

  // 展开或收起长内容
  const toggleExpanded = (id: string): void => {
    setExpandedIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ))
  }

  // 键盘操作列表
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (filteredList.length === 0) return

    const currentIndex = Math.max(
      filteredList.findIndex((item) => item.id === activeSelectedId),
      0
    )

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = Math.min(currentIndex + 1, filteredList.length - 1)
      setSelectedId(filteredList[nextIndex].id)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = Math.max(currentIndex - 1, 0)
      setSelectedId(filteredList[nextIndex].id)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const target = filteredList[currentIndex]
      void handleCopy(target)
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      removeItem(filteredList[currentIndex].id)
    }
  }

  const favoriteCount = list.filter((item) => item.favorite).length
  const emptyText = keyword
    ? '没有找到匹配的记录'
    : filter === 'all'
      ? '暂无剪贴板历史'
      : '当前筛选没有记录，可以切回“全部”查看其他类型'

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
        <div className="relative min-w-64 flex-1">
          <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索剪贴板历史..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm placeholder-gray-500 backdrop-blur-xl focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="flex max-w-full flex-wrap rounded-lg border border-white/10 bg-white/5 p-1">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === option.key ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="whitespace-nowrap text-sm text-gray-500">
          {filteredList.length} / {list.length} 条
          {favoriteCount > 0 && ` · ${favoriteCount} 收藏`}
        </span>

        {copyMessage && (
          <span className="whitespace-nowrap rounded border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-gray-300">
            {copyMessage}
          </span>
        )}

        <button
          className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
          onClick={() => setShowConfirm(true)}
        >
          <Eraser className="h-4 w-4" />
          清空非收藏
        </button>
      </div>

      <div className="flex-1 overflow-auto py-4">
        {filteredList.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredList.map((item: ClipboardItem) => {
              const meta = getItemMeta(item)
              const expanded = expandedIds.includes(item.id)
              const canExpand = item.content.length > 280 || item.content.split(/\r?\n/).length > 4
              const selected = item.id === activeSelectedId
              const textKind = item.type === 'text' ? getClipboardKind(item.content) : null

              return (
                <div
                  key={item.id}
                  className={`group rounded-lg border p-4 backdrop-blur-xl transition-colors ${
                    selected
                      ? 'border-sky-400/50 bg-sky-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(item.updatedAt)}</span>
                        <span className="text-xs text-gray-500">{getItemStats(item)}</span>
                        {item.type === 'image' && item.originalTooLarge && (
                          <span className="text-xs text-amber-300">已保存压缩版</span>
                        )}
                        {item.favorite && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                            <Star className="h-3 w-3 fill-current" />
                            已收藏
                          </span>
                        )}
                      </div>

                      <div
                        className={`overflow-hidden whitespace-pre-wrap break-all font-mono text-sm leading-6 text-gray-300 ${
                          expanded ? 'max-h-none' : 'max-h-24'
                        }`}
                      >
                        {getPreviewText(item.content)}
                      </div>

                      {item.type === 'image' && <ImagePreview item={item} />}
                      {item.type === 'file' && <FilePreview item={item} />}

                      {canExpand && (
                        <button
                          className="mt-2 rounded px-2 py-1 text-xs text-gray-500 hover:bg-white/10 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleExpanded(item.id)
                          }}
                        >
                          {expanded ? '收起' : '展开'}
                        </button>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      {textKind === 'url' && (
                        <button
                          className="rounded p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-sky-300"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleCopy(item)
                          }}
                          title="复制链接"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                      <TypeIcon item={item} />
                      <button
                        className={`rounded p-2 transition-colors ${
                          item.favorite
                            ? 'text-yellow-400 hover:bg-yellow-500/10'
                            : 'text-gray-500 hover:bg-white/10 hover:text-yellow-400'
                        }`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleFavorite(item.id)
                        }}
                        title={item.favorite ? '取消收藏' : '收藏'}
                      >
                        <Star className={`h-4 w-4 ${item.favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        className={`rounded p-2 transition-colors ${
                          copiedId === item.id
                            ? 'text-green-400'
                            : 'text-gray-500 hover:bg-white/10 hover:text-green-400'
                        }`}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleCopy(item)
                        }}
                        title="复制"
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeItem(item.id)
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-lg border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold">确认清空</h3>
            <p className="mt-2 text-sm text-gray-400">
              此操作将清空所有非收藏剪贴板历史，收藏内容会保留。
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
