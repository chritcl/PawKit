import { describe, it, expect } from 'vitest'
import {
  computeDiff,
  extractDiffText,
  countDiffLines,
  DEFAULT_DIFF_OPTIONS,
  type DiffOptions
} from './diff'

describe('文本 Diff 工具', () => {
  describe('computeDiff', () => {
    it('相同文本应返回全部 equal', () => {
      const text = '第一行\n第二行\n第三行'
      const result = computeDiff(text, text)
      expect(result.stats.unchanged).toBe(3)
      expect(result.stats.added).toBe(0)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.modified).toBe(0)
      expect(result.entries.every((e) => e.type === 'equal')).toBe(true)
    })

    it('应检测新增行', () => {
      const old = '第一行\n第二行'
      const newText = '第一行\n第二行\n第三行'
      const result = computeDiff(old, newText)
      expect(result.stats.added).toBe(1)
      expect(result.stats.removed).toBe(0)
      const addedEntry = result.entries.find((e) => e.type === 'added')
      expect(addedEntry).toBeDefined()
      expect(addedEntry!.content).toBe('第三行')
    })

    it('应检测删除行', () => {
      const old = '第一行\n第二行\n第三行'
      const newText = '第一行\n第三行'
      const result = computeDiff(old, newText)
      expect(result.stats.removed).toBe(1)
      const removedEntry = result.entries.find((e) => e.type === 'removed')
      expect(removedEntry).toBeDefined()
      expect(removedEntry!.content).toBe('第二行')
    })

    it('应检测修改行（配对 added/removed 为 modified）', () => {
      const old = '第一行\n原始内容\n第三行'
      const newText = '第一行\n修改后内容\n第三行'
      const result = computeDiff(old, newText)
      expect(result.stats.modified).toBe(1)
      expect(result.stats.added).toBe(0)
      expect(result.stats.removed).toBe(0)
      const modifiedEntry = result.entries.find((e) => e.type === 'modified')
      expect(modifiedEntry).toBeDefined()
    })

    it('应正确处理空文本', () => {
      const result = computeDiff('', '新文本')
      expect(result.stats.added).toBe(1)
      expect(result.stats.totalOld).toBe(1) // 空字符串 split 后仍有一行
      expect(result.stats.totalNew).toBe(1)
    })

    it('应正确处理两个空文本', () => {
      const result = computeDiff('', '')
      // diff 库对两个空字符串不产生变更，entries 为空
      expect(result.entries.length).toBe(0)
      expect(result.stats.added).toBe(0)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.totalOld).toBe(1)
      expect(result.stats.totalNew).toBe(1)
    })

    it('ignoreWhitespace 选项应忽略空白差异', () => {
      const old = 'hello  world'
      const newText = 'hello world'
      const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ignoreWhitespace: true }
      const result = computeDiff(old, newText, options)
      expect(result.stats.unchanged).toBe(1)
    })

    it('ignoreCase 选项应忽略大小写差异', () => {
      const old = 'Hello World'
      const newText = 'hello world'
      const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ignoreCase: true }
      const result = computeDiff(old, newText, options)
      expect(result.stats.unchanged).toBe(1)
    })

    it('ignoreBlankLines 选项应忽略空行', () => {
      const old = '第一行\n\n第三行'
      const newText = '第一行\n第三行'
      const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ignoreBlankLines: true }
      const result = computeDiff(old, newText, options)
      expect(result.stats.unchanged).toBe(2)
    })

    it('应生成补丁文本', () => {
      const old = '原始内容'
      const newText = '修改后内容'
      const result = computeDiff(old, newText)
      expect(result.patch).toContain('原始内容')
      expect(result.patch).toContain('修改后内容')
    })

    it('大文件应标记 isLarge', () => {
      const lines = Array.from({ length: 6000 }, (_, i) => `行 ${i}`)
      const old = lines.join('\n')
      const newText = lines.join('\n') + '\n新增行'
      const result = computeDiff(old, newText)
      expect(result.isLarge).toBe(true)
    })

    it('词级粒度应生成 charDiffs', () => {
      const old = 'hello world'
      const newText = 'hello earth'
      const result = computeDiff(old, newText, DEFAULT_DIFF_OPTIONS, 'word')
      const modified = result.entries.find((e) => e.type === 'modified')
      if (modified) {
        expect(modified.charDiffs).toBeDefined()
        expect(modified.charDiffs!.length).toBeGreaterThan(0)
      }
    })
  })

  describe('extractDiffText', () => {
    it('应提取右侧差异文本', () => {
      const old = '相同\n删除行\n相同'
      const newText = '相同\n新增行\n相同'
      const result = computeDiff(old, newText)
      const diffText = extractDiffText(result, 'right')
      expect(diffText).toContain('+')
    })

    it('应提取左侧差异文本', () => {
      const old = '相同\n删除行\n相同'
      const newText = '相同\n新增行\n相同'
      const result = computeDiff(old, newText)
      const diffText = extractDiffText(result, 'left')
      expect(diffText).toContain('-')
    })
  })

  describe('countDiffLines', () => {
    it('应正确统计行数', () => {
      expect(countDiffLines('')).toBe(0)
      expect(countDiffLines('一行')).toBe(1)
      expect(countDiffLines('第一行\n第二行\n第三行')).toBe(3)
    })
  })
})
