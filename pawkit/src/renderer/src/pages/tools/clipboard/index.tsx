import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import {
  AlignLeft,
  ClipboardCopy,
  Copy,
  Eraser,
  ExternalLink,
  FileJson,
  Files,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  ListFilter,
  MoreHorizontal,
  ScanText,
  Save,
  Star,
  Terminal,
  Trash2,
  X
} from 'lucide-react'
import { ClipboardFileItem, ClipboardItem } from '../../../../../shared/types'
import { TOOL_IDS } from '../../../../../shared/constants'
import { useClipboardStore } from '../../../stores/clipboard-store'
import { useAppStore } from '../../../stores/app-store'
import { useImageToolStore } from '../../../stores/image-tool-store'
import { useOcrToolStore } from '../../../stores/ocr-tool-store'
import {
  ClipboardFilter,
  filterClipboardItems,
  formatClipboardTime,
  getClipboardKind,
  getClipboardMeta,
  getClipboardStats
} from '../../../utils/clipboard'

const filterOptions: Array<{ key: ClipboardFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '图片' },
  { key: 'file', label: '文件' },
  { key: 'richText', label: '富文本' },
  { key: 'favorite', label: '收藏' }
]

interface FeedbackState {
  message: string
  tone: 'success' | 'danger' | 'neutral'
  undoToken?: string
}

interface ContextMenuState {
  item: ClipboardItem
  x: number
  y: number
}

function getPreviewText(content: string): string {
  if (content.length === 0) return '空文本'
  if (content.trim().length === 0) return '空白文本'
  return content
}

function TypeIcon({ item }: { item: ClipboardItem }): JSX.Element {
  if (item.type === 'image') return <ImageIcon className="h-4 w-4 tone-danger" />
  if (item.type === 'file') return <Files className="h-4 w-4 tone-info" />
  if (item.type === 'richText') return <FileText className="h-4 w-4 tone-success" />

  const kind = getClipboardKind(item.content)
  if (kind === 'json') return <FileJson className="h-4 w-4 tone-success" />
  if (kind === 'command') return <Terminal className="h-4 w-4 tone-accent" />
  return <AlignLeft className="h-4 w-4 text-[color:var(--text-muted)]" />
}

function ClipboardCard({
  item,
  selected,
  onSelect,
  onCopy,
  onFavorite,
  onContextMenu
}: {
  item: ClipboardItem
  selected: boolean
  onSelect: () => void
  onCopy: () => void
  onFavorite: () => void
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void
}): JSX.Element {
  const meta = getClipboardMeta(item)

  return (
    <div
      className={`interactive-row clipboard-history-card ${selected ? 'selected-surface' : ''}`}
      onClick={onSelect}
      onDoubleClick={onCopy}
      onContextMenu={onContextMenu}
      role="option"
      aria-selected={selected}
    >
      <div className="clipboard-card-heading">
        <div className="flex min-w-0 items-center gap-2">
          <span className="clipboard-type-icon"><TypeIcon item={item} /></span>
          <span className={`meta-badge meta-badge-${meta.tone}`}>{meta.label}</span>
          <span className="truncate text-xs text-[color:var(--text-muted)]">{getClipboardStats(item)}</span>
        </div>
        <button
          className={`icon-button h-8 min-h-8 w-8 min-w-8 ${item.favorite ? 'tone-warning' : ''}`}
          title={item.favorite ? '取消收藏' : '收藏'}
          onClick={(event) => {
            event.stopPropagation()
            onFavorite()
          }}
        >
          <Star className={`h-4 w-4 ${item.favorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="clipboard-card-preview">
        {item.type === 'image' && (
          <img src={item.thumbnailDataUrl} alt="剪贴板图片缩略图" draggable={false} />
        )}
        {item.type === 'file' ? (
          <div className="space-y-1.5">
            {item.files.slice(0, 2).map((file) => (
              <div key={file.path} className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 tone-info" />
                <span className="truncate">{file.name || file.path}</span>
                {!file.exists && <span className="shrink-0 tone-warning">已失效</span>}
              </div>
            ))}
            {item.files.length > 2 && <div className="text-xs muted">还有 {item.files.length - 2} 个文件</div>}
          </div>
        ) : item.type !== 'image' ? (
          <div className="clipboard-card-text">{getPreviewText(item.content)}</div>
        ) : null}
      </div>

      <div className="clipboard-card-footer">
        <span>{formatClipboardTime(item.updatedAt)}</span>
        <span className="flex items-center gap-1.5">
          {item.favorite && <Star className="h-3 w-3 fill-current tone-warning" />}
          双击复制
        </span>
      </div>
    </div>
  )
}

function ClipboardDetail({
  item,
  onClose,
  onCopy,
  onCopyText,
  onFavorite,
  onDelete,
  onOpenLink,
  onSaveImage,
  onSendImage,
  onOcrImage,
  onShowFile
}: {
  item: ClipboardItem
  onClose: () => void
  onCopy: () => void
  onCopyText: () => void
  onFavorite: () => void
  onDelete: () => void
  onOpenLink: () => void
  onSaveImage: () => void
  onSendImage: () => void
  onOcrImage: () => void
  onShowFile: (path: string) => void
}): JSX.Element {
  const [imageData, setImageData] = useState<string | null>(item.type === 'image' ? item.thumbnailDataUrl : null)
  const [richMode, setRichMode] = useState<'preview' | 'plain'>('preview')
  const meta = getClipboardMeta(item)
  const kind = item.type === 'text' ? getClipboardKind(item.content) : null

  useEffect(() => {
    let active = true
    if (item.type === 'image') {
      window.electronAPI?.clipboard?.getImageData(item.id).then((value) => {
        if (active) setImageData(value)
      }).catch(() => {
        if (active) setImageData(null)
      })
    }
    return () => {
      active = false
    }
  }, [item])

  let domain = ''
  if (kind === 'url') {
    try {
      domain = new URL(item.content.trim()).hostname
    } catch {
      domain = ''
    }
  }

  return (
    <aside className="glass-panel clipboard-detail-panel">
      <div className="clipboard-detail-heading">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`meta-badge meta-badge-${meta.tone}`}>{meta.label}</span>
            <span className="text-xs muted">{getClipboardStats(item)}</span>
          </div>
          <h2 className="mt-3 truncate text-base font-semibold">
            {domain || (item.type === 'file' ? `${item.files.length} 个文件` : meta.label)}
          </h2>
        </div>
        <button className="icon-button clipboard-detail-close" title="关闭详情" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="clipboard-detail-meta">
        <div><span>创建时间</span><strong>{formatClipboardTime(item.createdAt, true)}</strong></div>
        <div><span>最近使用</span><strong>{formatClipboardTime(item.updatedAt, true)}</strong></div>
      </div>

      <div className="clipboard-detail-actions">
        <button className="toolbar-button-primary" onClick={onCopy}><ClipboardCopy className="h-4 w-4" />复制</button>
        <button className="toolbar-button" onClick={onFavorite}>
          <Star className={`h-4 w-4 ${item.favorite ? 'fill-current tone-warning' : ''}`} />
          {item.favorite ? '取消收藏' : '收藏'}
        </button>
        {kind === 'url' && (
          <button className="toolbar-button" onClick={onOpenLink}><ExternalLink className="h-4 w-4" />打开链接</button>
        )}
        {item.type === 'image' && (
          <>
            <button className="toolbar-button" onClick={onSaveImage}><Save className="h-4 w-4" />保存图片</button>
            <button className="toolbar-button" onClick={onSendImage}><ImageIcon className="h-4 w-4" />图片处理</button>
            <button className="toolbar-button" onClick={onOcrImage}><ScanText className="h-4 w-4" />OCR 识别</button>
          </>
        )}
        {(item.type === 'file' || item.type === 'richText') && (
          <button className="toolbar-button" onClick={onCopyText}><Copy className="h-4 w-4" />复制纯文本</button>
        )}
        <button className="toolbar-button-danger" onClick={onDelete}><Trash2 className="h-4 w-4" />删除</button>
      </div>

      <div className="clipboard-detail-content">
        {item.type === 'image' && (
          <div className="clipboard-image-stage">
            {imageData || item.thumbnailDataUrl ? (
              <img src={imageData ?? item.thumbnailDataUrl} alt="剪贴板图片预览" draggable={false} />
            ) : (
              <div className="empty-state flex-col gap-2">
                <ImageIcon className="h-8 w-8" />
                <span>图片文件已失效</span>
              </div>
            )}
            {item.originalTooLarge && <div className="alert-surface alert-warning">原图过大，当前历史保存并复制的是压缩版本。</div>}
          </div>
        )}

        {item.type === 'file' && (
          <div className="clipboard-file-detail-list">
            {item.files.map((file) => (
              <div key={file.path} className="clipboard-file-detail-row">
                <FileText className="h-4 w-4 shrink-0 tone-info" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name || file.path}</div>
                  <div className="mt-1 break-all text-xs muted">{file.path}</div>
                </div>
                <button
                  className="icon-button"
                  title={file.exists ? '在资源管理器中定位' : '文件已失效'}
                  disabled={!file.exists}
                  onClick={() => onShowFile(file.path)}
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {item.type === 'richText' && (
          <>
            <div className="segmented-control w-fit">
              <button className={`segmented-item ${richMode === 'preview' ? 'segmented-item-active' : ''}`} onClick={() => setRichMode('preview')}>可读预览</button>
              <button className={`segmented-item ${richMode === 'plain' ? 'segmented-item-active' : ''}`} onClick={() => setRichMode('plain')}>纯文本</button>
            </div>
            <div className={`clipboard-full-text ${richMode === 'preview' ? 'clipboard-rich-preview' : ''}`}>
              {getPreviewText(item.content)}
            </div>
          </>
        )}

        {item.type === 'text' && (
          <>
            {kind === 'url' && domain && (
              <div className="clipboard-link-summary">
                <ExternalLink className="h-4 w-4 tone-info" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{domain}</div>
                  <div className="mt-1 break-all text-xs muted">{item.content.trim()}</div>
                </div>
              </div>
            )}
            <div className="clipboard-full-text">{getPreviewText(item.content)}</div>
          </>
        )}
      </div>
    </aside>
  )
}

// 剪贴板工具组件
export function ClipboardPage(): JSX.Element {
  const list = useClipboardStore((state) => state.list)
  const keyword = useClipboardStore((state) => state.keyword)
  const loading = useClipboardStore((state) => state.loading)
  const setKeyword = useClipboardStore((state) => state.setKeyword)
  const removeItem = useClipboardStore((state) => state.removeItem)
  const restoreItem = useClipboardStore((state) => state.restoreItem)
  const clearList = useClipboardStore((state) => state.clearList)
  const toggleFavorite = useClipboardStore((state) => state.toggleFavorite)
  const copyItem = useClipboardStore((state) => state.copyItem)
  const init = useClipboardStore((state) => state.init)
  const setActiveTool = useAppStore((state) => state.setActiveTool)
  const enabledTools = useAppStore((state) => state.enabledTools)
  const setEnabledTools = useAppStore((state) => state.setEnabledTools)
  const addImageSources = useImageToolStore((state) => state.addSources)
  const addOcrSources = useOcrToolStore((state) => state.addSources)

  const [showConfirm, setShowConfirm] = useState(false)
  const [filter, setFilter] = useState<ClipboardFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailDismissed, setDetailDismissed] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => init(), [init])

  useEffect(() => {
    const closeMenu = (): void => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('blur', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('blur', closeMenu)
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const filteredList = filterClipboardItems(list, keyword, filter)
  const selectedItem = filteredList.find((item) => item.id === selectedId) ?? filteredList[0] ?? null
  const favoriteCount = list.filter((item) => item.favorite).length

  const showFeedback = (next: FeedbackState, duration = 3500): void => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    setFeedback(next)
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), duration)
  }

  const handleCopy = async (item: ClipboardItem): Promise<void> => {
    const result = await copyItem(item.id)
    showFeedback({
      message: result.message ?? (result.success ? '已复制到剪贴板' : '复制失败'),
      tone: result.success ? 'success' : 'danger'
    })
    if (result.success) setSelectedId(item.id)
  }

  const handleCopyText = async (item: ClipboardItem): Promise<void> => {
    const result = await window.electronAPI.clipboard.copyItemText(item.id)
    showFeedback({ message: result.message ?? '复制失败', tone: result.success ? 'success' : 'danger' })
  }

  const handleDelete = async (item: ClipboardItem): Promise<void> => {
    const result = await removeItem(item.id)
    showFeedback({
      message: result.message,
      tone: result.success ? 'neutral' : 'danger',
      undoToken: result.undoToken
    }, result.undoToken ? 7000 : 3500)
  }

  const handleUndo = async (): Promise<void> => {
    if (!feedback?.undoToken) return
    const result = await restoreItem(feedback.undoToken)
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'danger' })
  }

  const handleClearConfirm = async (): Promise<void> => {
    const removedCount = list.filter((item) => !item.favorite).length
    await clearList(true)
    setShowConfirm(false)
    showFeedback({ message: `已清理 ${removedCount} 条非收藏记录`, tone: 'success' })
  }

  const handleOpenLink = async (item: ClipboardItem): Promise<void> => {
    const result = await window.electronAPI.clipboard.openLink(item.id)
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'danger' })
  }

  const handleSaveImage = async (item: ClipboardItem): Promise<void> => {
    const result = await window.electronAPI.clipboard.saveImage(item.id)
    showFeedback({ message: result.message ?? '图片保存失败', tone: result.success ? 'success' : result.status === 'cancelled' ? 'neutral' : 'danger' })
  }

  const handleSendImage = async (item: ClipboardItem): Promise<void> => {
    if (item.type !== 'image') return
    const source = await window.electronAPI.imageTool.importClipboardHistory(item.id)
    if (!source) {
      showFeedback({ message: '图片文件已失效，无法发送到图片处理', tone: 'danger' })
      return
    }
    addImageSources([source])
    if (!enabledTools.includes(TOOL_IDS.IMAGE_TOOL)) {
      setEnabledTools([...enabledTools, TOOL_IDS.IMAGE_TOOL])
    }
    setActiveTool(TOOL_IDS.IMAGE_TOOL)
    showFeedback({ message: '已发送到图片处理', tone: 'success' })
  }

  const handleOcrImage = async (item: ClipboardItem): Promise<void> => {
    if (item.type !== 'image') return
    const dataUrl = await window.electronAPI.clipboard.getImageData(item.id)
    if (!dataUrl) {
      showFeedback({ message: '图片文件已失效，无法 OCR 识别', tone: 'danger' })
      return
    }
    const source = await window.electronAPI.ocr.sendToTool({
      dataUrl,
      name: `clipboard-${item.id}.png`,
      sourceKind: 'clipboard-history',
      mode: 'auto'
    })
    if (!source) {
      showFeedback({ message: '发送到 OCR 识别失败', tone: 'danger' })
      return
    }
    addOcrSources([source])
    if (!enabledTools.includes(TOOL_IDS.OCR_TOOL)) {
      setEnabledTools([...enabledTools, TOOL_IDS.OCR_TOOL])
    }
    setActiveTool(TOOL_IDS.OCR_TOOL)
    showFeedback({ message: '已发送到 OCR 识别', tone: 'success' })
  }

  const handleShowFile = async (item: ClipboardFileItem, path: string): Promise<void> => {
    const result = await window.electronAPI.clipboard.showFile(item.id, path)
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'danger' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }

    const target = event.target as HTMLElement
    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || filteredList.length === 0) return
    const currentIndex = Math.max(filteredList.findIndex((item) => item.id === selectedItem?.id), 0)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const offset = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = Math.min(Math.max(currentIndex + offset, 0), filteredList.length - 1)
      setSelectedId(filteredList[nextIndex].id)
      setDetailDismissed(false)
    } else if (event.key === 'Enter' && selectedItem) {
      event.preventDefault()
      void handleCopy(selectedItem)
    } else if (event.key === 'Delete' && selectedItem) {
      event.preventDefault()
      void handleDelete(selectedItem)
    } else if (event.key === 'Escape') {
      setContextMenu(null)
      setDetailDismissed(true)
    }
  }

  const openContextMenu = (event: MouseEvent<HTMLDivElement>, item: ClipboardItem): void => {
    event.preventDefault()
    setSelectedId(item.id)
    setDetailDismissed(false)
    setContextMenu({
      item,
      x: Math.min(event.clientX, window.innerWidth - 208),
      y: Math.min(event.clientY, window.innerHeight - 280)
    })
  }

  const emptyText = keyword
    ? '没有找到匹配的记录'
    : filter === 'all'
      ? '暂无剪贴板历史'
      : '当前筛选没有记录'
  const contextFirstExistingFile = contextMenu?.item.type === 'file'
    ? contextMenu.item.files.find((file) => file.exists)
    : undefined

  if (loading) return <div className="empty-state">加载中...</div>

  return (
    <div className="tool-page outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="toolbar-surface tab-toolbar clipboard-toolbar">
        <div className="tab-toolbar-main">
          <div className="relative min-w-56 flex-1">
            <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="搜索内容、文件名或路径..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="field-input pl-10 pr-4 text-sm"
            />
          </div>
          <div className="segmented-control clipboard-filter-control">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                className={`segmented-item ${filter === option.key ? 'segmented-item-active' : ''}`}
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-actions">
          <span className="chip whitespace-nowrap">{filteredList.length} / {list.length} 条{favoriteCount > 0 && ` · ${favoriteCount} 收藏`}</span>
          <button className="toolbar-button-danger" onClick={() => setShowConfirm(true)} disabled={!list.some((item) => !item.favorite)}>
            <Eraser className="h-4 w-4" />清空非收藏
          </button>
        </div>
      </div>

      <div className={`clipboard-workspace ${selectedItem && !detailDismissed ? 'clipboard-detail-open' : ''}`}>
        <div className="clipboard-list-panel" role="listbox" aria-label="剪贴板历史">
          {filteredList.length === 0 ? (
            <div className="empty-state clipboard-empty-state">
              <ClipboardCopy className="h-8 w-8" />
              <div className="font-medium">{emptyText}</div>
              <div className="text-xs">支持文本、图片、文件和富文本，复制后会自动记录</div>
            </div>
          ) : (
            <div className="clipboard-card-list">
              {filteredList.map((item) => (
                <ClipboardCard
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => {
                    setSelectedId(item.id)
                    setDetailDismissed(false)
                  }}
                  onCopy={() => void handleCopy(item)}
                  onFavorite={() => void toggleFavorite(item.id)}
                  onContextMenu={(event) => openContextMenu(event, item)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedItem ? (
          <ClipboardDetail
            key={selectedItem.id}
            item={selectedItem}
            onClose={() => setDetailDismissed(true)}
            onCopy={() => void handleCopy(selectedItem)}
            onCopyText={() => void handleCopyText(selectedItem)}
            onFavorite={() => void toggleFavorite(selectedItem.id)}
            onDelete={() => void handleDelete(selectedItem)}
            onOpenLink={() => void handleOpenLink(selectedItem)}
            onSaveImage={() => void handleSaveImage(selectedItem)}
            onSendImage={() => void handleSendImage(selectedItem)}
            onOcrImage={() => void handleOcrImage(selectedItem)}
            onShowFile={(path) => selectedItem.type === 'file' && void handleShowFile(selectedItem, path)}
          />
        ) : (
          <aside className="glass-panel clipboard-detail-panel clipboard-detail-placeholder">
            <MoreHorizontal className="h-7 w-7" />
            <span>选择一条记录查看完整内容</span>
          </aside>
        )}
      </div>

      {contextMenu && (
        <div
          className="clipboard-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => { setContextMenu(null); void handleCopy(contextMenu.item) }}><ClipboardCopy className="h-4 w-4" />复制</button>
          <button onClick={() => { setContextMenu(null); void toggleFavorite(contextMenu.item.id) }}>
            <Star className="h-4 w-4" />{contextMenu.item.favorite ? '取消收藏' : '收藏'}
          </button>
          {contextMenu.item.type === 'text' && getClipboardKind(contextMenu.item.content) === 'url' && (
            <button onClick={() => { setContextMenu(null); void handleOpenLink(contextMenu.item) }}><ExternalLink className="h-4 w-4" />打开链接</button>
          )}
          {contextMenu.item.type === 'image' && (
            <>
              <button onClick={() => { setContextMenu(null); void handleSaveImage(contextMenu.item) }}><Save className="h-4 w-4" />保存图片</button>
              <button onClick={() => { setContextMenu(null); void handleSendImage(contextMenu.item) }}><ImageIcon className="h-4 w-4" />图片处理</button>
              <button onClick={() => { setContextMenu(null); void handleOcrImage(contextMenu.item) }}><ScanText className="h-4 w-4" />OCR 识别</button>
            </>
          )}
          {contextMenu.item.type === 'file' && contextFirstExistingFile && (
            <button onClick={() => { setContextMenu(null); void handleShowFile(contextMenu.item as ClipboardFileItem, contextFirstExistingFile.path) }}>
              <FolderOpen className="h-4 w-4" />定位第一个文件
            </button>
          )}
          {(contextMenu.item.type === 'file' || contextMenu.item.type === 'richText') && (
            <button onClick={() => { setContextMenu(null); void handleCopyText(contextMenu.item) }}><Copy className="h-4 w-4" />复制纯文本</button>
          )}
          <div className="clipboard-context-separator" />
          <button className="tone-danger" onClick={() => { setContextMenu(null); void handleDelete(contextMenu.item) }}><Trash2 className="h-4 w-4" />删除</button>
        </div>
      )}

      {feedback && (
        <div className={`clipboard-feedback clipboard-feedback-${feedback.tone}`}>
          <span>{feedback.message}</span>
          {feedback.undoToken && <button onClick={() => void handleUndo()}>撤销</button>}
        </div>
      )}

      {showConfirm && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-96 rounded-[8px] p-6">
            <h3 className="text-lg font-semibold">确认清空非收藏记录</h3>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              将清理 {list.filter((item) => !item.favorite).length} 条记录，收藏内容会保留。此操作无法撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="toolbar-button" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="toolbar-button-danger" onClick={() => void handleClearConfirm()}>确认清空</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
