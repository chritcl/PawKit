import { ClipboardItem } from '../../../shared/types'

export type ClipboardFilter = 'all' | 'text' | 'image' | 'file' | 'richText' | 'favorite'
export type ClipboardKind = 'url' | 'json' | 'command' | 'code' | 'long' | 'text'
export type ClipboardBadgeTone = 'neutral' | 'blue' | 'green' | 'purple' | 'cyan' | 'amber' | 'pink' | 'lime'

const commandPattern = /^(pnpm|npm|npx|yarn|git|docker|kubectl|curl|ssh|cd|ls|dir|cmd|powershell)\b/i

const kindMeta: Record<ClipboardKind, { label: string; tone: ClipboardBadgeTone }> = {
  url: { label: '链接', tone: 'blue' },
  json: { label: 'JSON', tone: 'green' },
  command: { label: '命令', tone: 'purple' },
  code: { label: '代码', tone: 'cyan' },
  long: { label: '长文本', tone: 'amber' },
  text: { label: '文本', tone: 'neutral' }
}

// 判断文本内容类型，用于提供安全的类型提示
export function getClipboardKind(content: string): ClipboardKind {
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

  if (commandPattern.test(trimmed)) return 'command'
  if (/(\b(import|export|const|let|function|class|interface|return)\b|=>|;\s*$)/m.test(content)) return 'code'
  if (content.length > 500 || content.split(/\r?\n/).length > 8) return 'long'
  return 'text'
}

// 获取历史项的类型标签
export function getClipboardMeta(item: ClipboardItem): { label: string; tone: ClipboardBadgeTone } {
  if (item.type === 'image') return { label: '图片', tone: 'pink' }
  if (item.type === 'file') return { label: '文件', tone: 'cyan' }
  if (item.type === 'richText') return { label: '富文本', tone: 'lime' }
  return kindMeta[getClipboardKind(item.content)]
}

// 获取历史项的简要统计
export function getClipboardStats(item: ClipboardItem): string {
  if (item.type === 'image') return `${item.width} × ${item.height} · ${(item.size / 1024).toFixed(1)} KB`
  if (item.type === 'file') return `${item.files.length} 个文件`
  if (item.type === 'richText') return `${item.content.length} 字符预览`
  return `${item.content.length} 字符`
}

// 根据搜索词和类型筛选历史
export function filterClipboardItems(
  list: ClipboardItem[],
  keyword: string,
  filter: ClipboardFilter
): ClipboardItem[] {
  const value = keyword.trim().toLowerCase()

  return list.filter((item) => {
    if (filter === 'favorite' && !item.favorite) return false
    if (filter !== 'all' && filter !== 'favorite' && item.type !== filter) return false
    if (!value) return true

    const fileText = item.type === 'file'
      ? item.files.map((file) => `${file.name}\n${file.path}`).join('\n')
      : ''
    return `${item.content}\n${fileText}`.toLowerCase().includes(value)
  })
}

// 格式化剪贴板时间
export function formatClipboardTime(value: string, includeYear = false): string {
  const date = new Date(value)
  return date.toLocaleString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
