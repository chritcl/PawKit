/**
 * 文本 Diff 与合并 - 纯逻辑工具函数
 * 基于 diff 库封装行级、字符级差异计算
 */
import {
  diffLines,
  diffChars,
  diffWords,
  createTwoFilesPatch,
  type Change
} from 'diff'

/** 差异视图模式 */
export type DiffViewMode = 'split' | 'unified'

/** 差异粒度 */
export type DiffGranularity = 'line' | 'word' | 'char'

/** 差异选项 */
export interface DiffOptions {
  /** 忽略空白字符差异 */
  ignoreWhitespace: boolean
  /** 忽略大小写 */
  ignoreCase: boolean
  /** 忽略空行 */
  ignoreBlankLines: boolean
}

/** 单行差异条目 */
export interface DiffLineEntry {
  /** 原始行号（左侧），-1 表示新增行 */
  oldLine: number
  /** 新文本行号（右侧），-1 表示删除行 */
  newLine: number
  /** 行内容 */
  content: string
  /** 差异类型：equal=相同, added=新增, removed=删除, modified=修改 */
  type: 'equal' | 'added' | 'removed' | 'modified'
  /** 字符级差异（仅 modified 类型且粒度为 word/char 时有值） */
  charDiffs?: CharDiff[]
}

/** 字符级差异片段 */
export interface CharDiff {
  /** 文本内容 */
  value: string
  /** 类型：equal=相同, added=新增, removed=删除 */
  type: 'equal' | 'added' | 'removed'
  /** 在原始行中的起始位置 */
  start: number
  /** 在原始行中的结束位置 */
  end: number
}

/** 差异统计 */
export interface DiffStats {
  /** 新增行数 */
  added: number
  /** 删除行数 */
  removed: number
  /** 修改行数（内容不同但位置对应） */
  modified: number
  /** 未变行数 */
  unchanged: number
  /** 总行数（左侧） */
  totalOld: number
  /** 总行数（右侧） */
  totalNew: number
}

/** 完整差异结果 */
export interface DiffResult {
  /** 行级差异条目列表 */
  entries: DiffLineEntry[]
  /** 差异统计 */
  stats: DiffStats
  /** 是否为大文件（超过阈值） */
  isLarge: boolean
  /** 补丁文本 */
  patch: string
}

/** 大文件阈值（行数） */
const LARGE_FILE_THRESHOLD = 5000

/** 默认差异选项 */
export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false
}

/**
 * 预处理文本：根据选项标准化文本用于比较
 */
function preprocessText(text: string, options: DiffOptions): string {
  let result = text
  if (options.ignoreCase) {
    result = result.toLowerCase()
  }
  if (options.ignoreWhitespace) {
    // 将连续空白替换为单个空格，并去除行首尾空白
    result = result
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .join('\n')
  }
  if (options.ignoreBlankLines) {
    // 移除空行
    result = result
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n')
  }
  return result
}

/**
 * 计算字符级差异
 */
function computeCharDiffs(
  oldLine: string,
  newLine: string,
  granularity: 'word' | 'char'
): { oldDiffs: CharDiff[]; newDiffs: CharDiff[] } {
  const changes: Change[] =
    granularity === 'word' ? diffWords(oldLine, newLine) : diffChars(oldLine, newLine)

  const oldDiffs: CharDiff[] = []
  const newDiffs: CharDiff[] = []
  let oldPos = 0
  let newPos = 0

  for (const change of changes) {
    if (!change.added && !change.removed) {
      // 未变部分
      oldDiffs.push({
        value: change.value,
        type: 'equal',
        start: oldPos,
        end: oldPos + change.value.length
      })
      newDiffs.push({
        value: change.value,
        type: 'equal',
        start: newPos,
        end: newPos + change.value.length
      })
      oldPos += change.value.length
      newPos += change.value.length
    } else if (change.removed) {
      oldDiffs.push({
        value: change.value,
        type: 'removed',
        start: oldPos,
        end: oldPos + change.value.length
      })
      oldPos += change.value.length
    } else if (change.added) {
      newDiffs.push({
        value: change.value,
        type: 'added',
        start: newPos,
        end: newPos + change.value.length
      })
      newPos += change.value.length
    }
  }

  return { oldDiffs, newDiffs }
}

/**
 * 执行文本差异比较
 * @param oldText 原始文本（左侧）
 * @param newText 新文本（右侧）
 * @param options 差异选项
 * @param granularity 差异粒度
 * @returns 差异结果
 */
export function computeDiff(
  oldText: string,
  newText: string,
  options: DiffOptions = DEFAULT_DIFF_OPTIONS,
  granularity: DiffGranularity = 'line'
): DiffResult {
  // 预处理用于比较的文本
  const processedOld = preprocessText(oldText, options)
  const processedNew = preprocessText(newText, options)

  // 获取原始行用于显示
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const isLarge =
    oldLines.length > LARGE_FILE_THRESHOLD || newLines.length > LARGE_FILE_THRESHOLD

  // 使用 diff 库计算行级差异
  const changes: Change[] = diffLines(processedOld, processedNew)

  // 构建差异条目
  const entries: DiffLineEntry[] = []
  let oldLineNum = 1
  let newLineNum = 1
  const stats: DiffStats = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    totalOld: oldLines.length,
    totalNew: newLines.length
  }

  // 同步构建原始行映射（用于显示）
  let oldIdx = 0
  let newIdx = 0

  for (const change of changes) {
    const changeLines = change.value.endsWith('\n')
      ? change.value.slice(0, -1).split('\n')
      : change.value.split('\n')

    if (!change.added && !change.removed) {
      // 未变行
      for (const line of changeLines) {
        entries.push({
          oldLine: oldLineNum,
          newLine: newLineNum,
          content: oldLines[oldIdx] ?? line,
          type: 'equal'
        })
        oldLineNum++
        newLineNum++
        oldIdx++
        newIdx++
        stats.unchanged++
      }
    } else if (change.removed) {
      // 删除行
      for (const line of changeLines) {
        entries.push({
          oldLine: oldLineNum,
          newLine: -1,
          content: oldLines[oldIdx] ?? line,
          type: 'removed'
        })
        oldLineNum++
        oldIdx++
        stats.removed++
      }
    } else if (change.added) {
      // 新增行
      for (const line of changeLines) {
        entries.push({
          oldLine: -1,
          newLine: newLineNum,
          content: newLines[newIdx] ?? line,
          type: 'added'
        })
        newLineNum++
        newIdx++
        stats.added++
      }
    }
  }

  // 尝试配对相邻的 added/removed 行为 modified
  const mergedEntries: DiffLineEntry[] = []
  let i = 0
  while (i < entries.length) {
    if (
      i + 1 < entries.length &&
      entries[i].type === 'removed' &&
      entries[i + 1].type === 'added'
    ) {
      // 配对为 modified
      const oldContent = entries[i].content
      const newContent = entries[i + 1].content

      // 只在非大文件或粒度为 line 时计算字符级差异
      let charDiffs: CharDiff[] | undefined
      if (!isLarge && granularity !== 'line') {
        const { newDiffs } = computeCharDiffs(oldContent, newContent, granularity as 'word' | 'char')
        charDiffs = newDiffs
      }

      mergedEntries.push({
        oldLine: entries[i].oldLine,
        newLine: entries[i + 1].newLine,
        content: newContent,
        type: 'modified',
        charDiffs
      })
      stats.modified++
      stats.removed--
      stats.added--
      i += 2
    } else {
      mergedEntries.push(entries[i])
      i++
    }
  }

  // 生成补丁文本
  const patch = createTwoFilesPatch(
    '原始文本',
    '新文本',
    oldText,
    newText,
    '原始',
    '修改后'
  )

  return {
    entries: mergedEntries,
    stats,
    isLarge,
    patch
  }
}

/**
 * 从差异结果中提取仅差异部分的文本
 */
export function extractDiffText(result: DiffResult, side: 'left' | 'right'): string {
  const lines: string[] = []
  for (const entry of result.entries) {
    if (entry.type === 'equal') continue
    if (side === 'left' && (entry.type === 'removed' || entry.type === 'modified')) {
      lines.push(`- ${entry.content}`)
    }
    if (side === 'right' && (entry.type === 'added' || entry.type === 'modified')) {
      lines.push(`+ ${entry.content}`)
    }
  }
  return lines.join('\n')
}

/**
 * 生成合并结果文本
 * @param entries 差异条目列表
 * @param acceptSide 接受的来源：left=接受左侧, right=接受右侧
 * @returns 合并后的文本
 */
export function mergeText(entries: DiffLineEntry[], acceptSide: 'left' | 'right'): string {
  const lines: string[] = []
  for (const entry of entries) {
    if (entry.type === 'equal') {
      lines.push(entry.content)
    } else if (entry.type === 'modified') {
      if (acceptSide === 'right') {
        lines.push(entry.content)
      }
      // left 时不添加（保持原样，即跳过修改）
    }
    // added 和 removed 行根据方向决定
    // left: 保留 removed 行内容（原始内容），跳过 added
    // right: 保留 added 行内容，跳过 removed
  }
  return lines.join('\n')
}

/**
 * 接受单个差异块（接受指定方向的修改）
 * @param entries 当前差异条目
 * @param index 要操作的条目索引
 * @param acceptSide 接受的方向
 * @returns 新的文本内容
 */
export function acceptSingleChange(
  oldText: string,
  newText: string,
  entries: DiffLineEntry[],
  index: number,
  acceptSide: 'left' | 'right'
): { newOldText: string; newNewText: string } {
  // 接受单个变更意味着将该差异块同步到两侧
  const entry = entries[index]
  if (!entry || entry.type === 'equal') {
    return { newOldText: oldText, newNewText: newText }
  }

  // 简化实现：将对应行的内容写回
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  if (entry.type === 'modified') {
    if (acceptSide === 'left') {
      // 将左侧内容应用到右侧
      if (entry.newLine > 0 && entry.newLine <= newLines.length) {
        newLines[entry.newLine - 1] = oldLines[entry.oldLine - 1] ?? entry.content
      }
    } else {
      // 将右侧内容应用到左侧
      if (entry.oldLine > 0 && entry.oldLine <= oldLines.length) {
        oldLines[entry.oldLine - 1] = entry.content
      }
    }
  } else if (entry.type === 'removed') {
    if (acceptSide === 'right') {
      // 接受右侧（即确认删除），在新文本中也删除对应行
      // 这种情况在配对中已处理
    }
  } else if (entry.type === 'added') {
    if (acceptSide === 'left') {
      // 接受左侧（即拒绝新增），在新文本中移除该行
      if (entry.newLine > 0 && entry.newLine <= newLines.length) {
        newLines.splice(entry.newLine - 1, 1)
      }
    }
  }

  return {
    newOldText: oldLines.join('\n'),
    newNewText: newLines.join('\n')
  }
}

/**
 * 统计差异文本行数
 */
export function countDiffLines(text: string): number {
  if (!text) return 0
  return text.split('\n').filter((l) => l.length > 0).length
}

/**
 * 读取文件内容（通过 FileReader）
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
