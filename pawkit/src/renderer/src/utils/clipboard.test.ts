import { describe, expect, it } from 'vitest'
import { ClipboardItem } from '../../../shared/types'
import { filterClipboardItems, getClipboardKind } from './clipboard'

const textItem = (content: string): ClipboardItem => ({
  id: content,
  type: 'text',
  content,
  favorite: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
})

describe('剪贴板纯逻辑', () => {
  it('识别安全展示所需的文本类型', () => {
    expect(getClipboardKind('https://example.com/path')).toBe('url')
    expect(getClipboardKind('{"name":"PawKit"}')).toBe('json')
    expect(getClipboardKind('pnpm run test')).toBe('command')
    expect(getClipboardKind('const value = 1;')).toBe('code')
  })

  it('搜索文件名和完整路径', () => {
    const fileItem: ClipboardItem = {
      id: 'file',
      type: 'file',
      content: 'C:\\Work\\PawKit\\notes.txt',
      files: [{ path: 'C:\\Work\\PawKit\\notes.txt', name: 'notes.txt', exists: true }],
      favorite: false,
      createdAt: '2026-06-15T00:00:00.000Z',
      updatedAt: '2026-06-15T00:00:00.000Z'
    }
    const list = [textItem('普通文本'), fileItem]

    expect(filterClipboardItems(list, 'notes', 'all')).toEqual([fileItem])
    expect(filterClipboardItems(list, 'pawkit', 'file')).toEqual([fileItem])
  })

  it('收藏筛选只返回收藏记录', () => {
    const favorite = { ...textItem('收藏内容'), favorite: true }
    expect(filterClipboardItems([textItem('普通内容'), favorite], '', 'favorite')).toEqual([favorite])
  })
})
