/**
 * 正则表达式工具函数
 * 提供正则编译、匹配、捕获组、替换预览、模板和解释能力
 */

// ========== 类型定义 ==========

/** 正则引擎风味 */
export type RegexFlavor = 'javascript' | 'java' | 'pcre'

/** 正则标志 */
export interface RegexFlags {
  global: boolean
  ignoreCase: boolean
  multiline: boolean
  dotAll: boolean
  unicode: boolean
  sticky: boolean
}

/** 编译结果 */
export interface CompileResult {
  success: boolean
  regex?: RegExp
  error?: string
}

/** 单个匹配结果 */
export interface MatchResult {
  index: number
  length: number
  text: string
  groups: CaptureGroup[]
}

/** 捕获组 */
export interface CaptureGroup {
  index: number
  name: string | null
  value: string
  start: number
  end: number
}

/** 全部匹配结果 */
export interface MatchAllResult {
  matches: MatchResult[]
  totalCount: number
  elapsed: number
  timedOut: boolean
}

/** 替换预览项 */
export interface ReplacePreviewItem {
  index: number
  original: string
  replaced: string
  start: number
  end: number
}

/** 替换预览结果 */
export interface ReplacePreviewResult {
  items: ReplacePreviewItem[]
  fullText: string
  replacedCount: number
  timedOut: boolean
}

/** 正则模板 */
export interface RegexTemplate {
  name: string
  pattern: string
  flags: string
  description: string
  category: string
}

/** 正则解释节点 */
export interface ExplanationNode {
  text: string
  description: string
  children: ExplanationNode[]
}

/** 大文本阈值（字符数） */
const LARGE_TEXT_THRESHOLD = 50_000

/** 匹配超时时间（毫秒） */
const MATCH_TIMEOUT_MS = 3000

/** 最大匹配数限制 */
const MAX_MATCH_COUNT = 10000

/** 替换预览最大项数 */
const MAX_REPLACE_PREVIEW = 200

// ========== 标志工具 ==========

/** 将标志对象转为字符串 */
export function flagsToString(flags: RegexFlags): string {
  let s = ''
  if (flags.global) s += 'g'
  if (flags.ignoreCase) s += 'i'
  if (flags.multiline) s += 'm'
  if (flags.dotAll) s += 's'
  if (flags.unicode) s += 'u'
  if (flags.sticky) s += 'y'
  return s
}

/** 将字符串转为标志对象 */
export function stringToFlags(str: string): RegexFlags {
  return {
    global: str.includes('g'),
    ignoreCase: str.includes('i'),
    multiline: str.includes('m'),
    dotAll: str.includes('s'),
    unicode: str.includes('u'),
    sticky: str.includes('y')
  }
}

/** 创建默认标志（全局匹配） */
export function createDefaultFlags(): RegexFlags {
  return {
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
    sticky: false
  }
}

// ========== 正则编译 ==========

/** 编译正则表达式 */
export function compileRegex(pattern: string, flags: RegexFlags): CompileResult {
  if (!pattern) {
    return { success: false, error: '请输入正则表达式' }
  }
  try {
    const regex = new RegExp(pattern, flagsToString(flags))
    return { success: true, regex }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '正则表达式语法错误' }
  }
}

// ========== 匹配执行 ==========

/** 检查文本是否超过大文本阈值 */
export function isLargeText(text: string): boolean {
  return text.length > LARGE_TEXT_THRESHOLD
}

/**
 * 执行正则匹配，带超时保护
 * 使用同步分批执行避免灾难性回溯卡死
 */
export function executeMatch(regex: RegExp, text: string): MatchAllResult {
  if (!text) {
    return { matches: [], totalCount: 0, elapsed: 0, timedOut: false }
  }

  const startTime = performance.now()
  const matches: MatchResult[] = []
  let timedOut = false

  // 为超时保护创建一个新的正则（确保全局标志）
  const flagsStr = regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
  const globalRegex = new RegExp(regex.source, flagsStr)

  let match: RegExpExecArray | null

  while ((match = globalRegex.exec(text)) !== null) {
    // 超时检查
    if (performance.now() - startTime > MATCH_TIMEOUT_MS) {
      timedOut = true
      break
    }

    // 数量上限检查
    if (matches.length >= MAX_MATCH_COUNT) {
      break
    }

    // 提取捕获组
    const groups: CaptureGroup[] = []
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        // 查找命名组
        let groupName: string | null = null
        if (match.groups) {
          for (const [name, val] of Object.entries(match.groups)) {
            if (val === match[i]) {
              groupName = name
              break
            }
          }
        }
        // 通过在 match 的子串中搜索来确定位置
        const groupStart = text.indexOf(match[i], match.index)
        groups.push({
          index: i,
          name: groupName,
          value: match[i],
          start: groupStart >= 0 ? groupStart : match.index,
          end: groupStart >= 0 ? groupStart + match[i].length : match.index + match[i].length
        })
      }
    }

    matches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
      groups
    })

    // 防止零长度匹配导致无限循环
    if (match[0].length === 0) {
      globalRegex.lastIndex++
    }
  }

  return {
    matches,
    totalCount: matches.length,
    elapsed: Math.round(performance.now() - startTime),
    timedOut
  }
}

// ========== 非全局匹配（用于捕获组详细分析） ==========

/** 执行单次匹配，获取完整捕获组信息 */
export function executeSingleMatch(regex: RegExp, text: string): MatchResult | null {
  const match = regex.exec(text)
  if (!match) return null

  const groups: CaptureGroup[] = []
  for (let i = 1; i < match.length; i++) {
    if (match[i] !== undefined) {
      let groupName: string | null = null
      if (match.groups) {
        for (const [name, val] of Object.entries(match.groups)) {
          if (val === match[i]) {
            groupName = name
            break
          }
        }
      }
      // 在整个文本中定位捕获组
      const groupStart = text.indexOf(match[i], match.index)
      groups.push({
        index: i,
        name: groupName,
        value: match[i],
        start: groupStart >= 0 ? groupStart : match.index,
        end: groupStart >= 0 ? groupStart + match[i].length : match.index + match[i].length
      })
    }
  }

  return {
    index: match.index,
    length: match[0].length,
    text: match[0],
    groups
  }
}

// ========== 替换预览 ==========

/** 生成替换预览 */
export function executeReplacePreview(
  regex: RegExp,
  text: string,
  replacement: string
): ReplacePreviewResult {
  if (!text) {
    return { items: [], fullText: text, replacedCount: 0, timedOut: false }
  }

  const startTime = performance.now()
  const items: ReplacePreviewItem[] = []
  let timedOut = false

  const flagsStr = regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
  const globalRegex = new RegExp(regex.source, flagsStr)

  let match: RegExpExecArray | null
  while ((match = globalRegex.exec(text)) !== null) {
    if (performance.now() - startTime > MATCH_TIMEOUT_MS) {
      timedOut = true
      break
    }
    if (items.length >= MAX_REPLACE_PREVIEW) {
      break
    }

    const replaced = match[0].replace(new RegExp(regex.source, regex.flags.replace('g', '')), replacement)
    items.push({
      index: items.length + 1,
      original: match[0],
      replaced,
      start: match.index,
      end: match.index + match[0].length
    })

    if (match[0].length === 0) {
      globalRegex.lastIndex++
    }
  }

  const fullText = text.replace(
    new RegExp(regex.source, flagsStr),
    replacement
  )

  return {
    items,
    fullText,
    replacedCount: items.length,
    timedOut
  }
}

// ========== 正则模板 ==========

/** 内置正则模板库 */
export const REGEX_TEMPLATES: RegexTemplate[] = [
  // 基础
  { name: '邮箱地址', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'gi', description: '匹配常见邮箱格式', category: '基础' },
  { name: 'URL 链接', pattern: 'https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[\\/\\w\\-._~:?#\\[\\]@!$&\'()*+,;=%]*', flags: 'gi', description: '匹配 HTTP/HTTPS URL', category: '基础' },
  { name: 'IPv4 地址', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b', flags: 'g', description: '匹配 IPv4 地址', category: '基础' },
  { name: '手机号码（中国大陆）', pattern: '1[3-9]\\d{9}', flags: 'g', description: '匹配 11 位手机号', category: '基础' },
  { name: '身份证号', pattern: '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]', flags: 'g', description: '匹配 18 位身份证号', category: '基础' },

  // 数字
  { name: '整数', pattern: '-?\\d+', flags: 'g', description: '匹配正负整数', category: '数字' },
  { name: '浮点数', pattern: '-?\\d+\\.\\d+', flags: 'g', description: '匹配浮点数', category: '数字' },
  { name: '十六进制颜色', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'gi', description: '匹配 HEX 颜色值', category: '数字' },

  // 文本
  { name: '中文字符', pattern: '[\\u4e00-\\u9fa5]+', flags: 'g', description: '匹配中文字符', category: '文本' },
  { name: 'HTML 标签', pattern: '<\\/?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?\\/?>', flags: 'g', description: '匹配 HTML 标签', category: '文本' },
  { name: '空白行', pattern: '^\\s*$\\n', flags: 'gm', description: '匹配空白行', category: '文本' },
  { name: '首尾空格', pattern: '^\\s+|\\s+$', flags: 'gm', description: '匹配行首尾空格', category: '文本' },

  // 日期时间
  { name: '日期 YYYY-MM-DD', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', description: '匹配 ISO 日期格式', category: '日期时间' },
  { name: '时间 HH:MM:SS', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d', flags: 'g', description: '匹配 24 小时制时间', category: '日期时间' },
  { name: 'ISO 8601 日期时间', pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?', flags: 'g', description: '匹配 ISO 8601 完整格式', category: '日期时间' },

  // 编程
  { name: 'CSS 颜色值', pattern: '(?:rgb|rgba|hsl|hsla)\\([^)]+\\)', flags: 'gi', description: '匹配 CSS 颜色函数', category: '编程' },
  { name: 'JavaScript 变量名', pattern: '[a-zA-Z_$][a-zA-Z0-9_$]*', flags: 'g', description: '匹配合法 JS 标识符', category: '编程' },
  { name: '字符串（双引号）', pattern: '"(?:[^"\\\\]|\\\\.)*"', flags: 'g', description: '匹配双引号字符串', category: '编程' },
  { name: '字符串（单引号）', pattern: "'(?:[^'\\\\]|\\\\.)*'", flags: 'g', description: '匹配单引号字符串', category: '编程' },

  // 文件路径
  { name: 'Windows 路径', pattern: '[a-zA-Z]:\\\\(?:[^\\\\/:*?"<>|\\r\\n]+\\\\)*[^\\\\/:*?"<>|\\r\\n]*', flags: 'g', description: '匹配 Windows 文件路径', category: '文件路径' },
  { name: '文件扩展名', pattern: '\\.[a-zA-Z0-9]{1,10}$', flags: 'gm', description: '匹配文件扩展名', category: '文件路径' },
]

/** 按分类获取模板 */
export function getTemplatesByCategory(): Map<string, RegexTemplate[]> {
  const map = new Map<string, RegexTemplate[]>()
  for (const tpl of REGEX_TEMPLATES) {
    const list = map.get(tpl.category) || []
    list.push(tpl)
    map.set(tpl.category, list)
  }
  return map
}

// ========== 正则解释 ==========

/** 解释正则表达式的各部分含义 */
export function explainRegex(pattern: string): ExplanationNode[] {
  if (!pattern) return []

  const nodes: ExplanationNode[] = []
  let i = 0

  while (i < pattern.length) {
    const ch = pattern[i]

    // 转义字符
    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1]
      const escapeMap: Record<string, string> = {
        'd': '匹配数字 [0-9]',
        'D': '匹配非数字 [^0-9]',
        'w': '匹配单词字符 [a-zA-Z0-9_]',
        'W': '匹配非单词字符',
        's': '匹配空白字符（空格、制表符、换行等）',
        'S': '匹配非空白字符',
        'b': '匹配单词边界',
        'B': '匹配非单词边界',
        'n': '匹配换行符',
        'r': '匹配回车符',
        't': '匹配制表符',
        '0': '匹配空字符',
      }
      if (escapeMap[next]) {
        nodes.push({ text: `\\${next}`, description: escapeMap[next], children: [] })
      } else {
        nodes.push({ text: `\\${next}`, description: `匹配字面量 "${next}"`, children: [] })
      }
      i += 2
      continue
    }

    // 字符集
    if (ch === '[') {
      const end = findClosingBracket(pattern, i)
      if (end > i) {
        const set = pattern.slice(i, end + 1)
        const negated = set[1] === '^'
        nodes.push({
          text: set,
          description: negated
            ? `匹配不在 "${set.slice(2, -1)}" 中的任意字符`
            : `匹配 "${set.slice(1, -1)}" 中的任意字符`,
          children: []
        })
        i = end + 1
        continue
      }
    }

    // 分组
    if (ch === '(') {
      const end = findClosingParen(pattern, i)
      if (end > i) {
        const groupContent = pattern.slice(i + 1, end)
        let groupDesc = '捕获组'
        let actualContent = groupContent

        if (groupContent.startsWith('?:')) {
          groupDesc = '非捕获组'
          actualContent = groupContent.slice(2)
        } else if (groupContent.startsWith('?=')) {
          groupDesc = '正向前瞻断言'
          actualContent = groupContent.slice(2)
        } else if (groupContent.startsWith('?!')) {
          groupDesc = '负向前瞻断言'
          actualContent = groupContent.slice(2)
        } else if (groupContent.startsWith('?<=')) {
          groupDesc = '正向后顾断言'
          actualContent = groupContent.slice(3)
        } else if (groupContent.startsWith('?<!')) {
          groupDesc = '负向后顾断言'
          actualContent = groupContent.slice(4)
        } else if (groupContent.startsWith('?<') && groupContent.includes('>')) {
          const nameEnd = groupContent.indexOf('>')
          const name = groupContent.slice(2, nameEnd)
          groupDesc = `命名捕获组 "${name}"`
          actualContent = groupContent.slice(nameEnd + 1)
        }

        const children = explainRegex(actualContent)
        nodes.push({
          text: pattern.slice(i, end + 1),
          description: groupDesc,
          children
        })
        i = end + 1
        continue
      }
    }

    // 量词
    if (ch === '{') {
      const end = pattern.indexOf('}', i)
      if (end > i) {
        const quant = pattern.slice(i, end + 1)
        const inner = quant.slice(1, -1)
        let desc: string
        if (inner.includes(',')) {
          const [min, max] = inner.split(',')
          if (max === '') {
            desc = `重复 ${min} 次或更多`
          } else {
            desc = `重复 ${min} 到 ${max} 次`
          }
        } else {
          desc = `恰好重复 ${inner} 次`
        }
        // 检查懒惰修饰
        if (end + 1 < pattern.length && pattern[end + 1] === '?') {
          desc += '（懒惰匹配）'
          nodes.push({ text: quant + '?', description: desc, children: [] })
          i = end + 2
        } else {
          nodes.push({ text: quant, description: desc, children: [] })
          i = end + 1
        }
        continue
      }
    }

    // 单字符
    const simpleMap: Record<string, string> = {
      '.': '匹配除换行外的任意字符',
      '^': '匹配行/字符串开头',
      '$': '匹配行/字符串结尾',
      '*': '匹配前面的表达式零次或多次',
      '+': '匹配前面的表达式一次或多次',
      '?': '匹配前面的表达式零次或一次',
      '|': '或（匹配左边或右边的表达式）',
    }

    if (simpleMap[ch]) {
      let text = ch
      let desc = simpleMap[ch]
      // 检查懒惰修饰
      if ((ch === '*' || ch === '+' || ch === '?') && i + 1 < pattern.length && pattern[i + 1] === '?') {
        text += '?'
        desc += '（懒惰匹配）'
        i += 2
      } else {
        i += 1
      }
      nodes.push({ text, description: desc, children: [] })
      continue
    }

    // 普通字面字符
    nodes.push({ text: ch, description: `匹配字面量 "${ch}"`, children: [] })
    i++
  }

  return nodes
}

/** 查找闭合方括号 */
function findClosingBracket(pattern: string, start: number): number {
  let i = start + 1
  // 跳过开头的 ] 或 ^]
  if (i < pattern.length && pattern[i] === ']') i++
  if (i < pattern.length && pattern[i] === '^') i++
  while (i < pattern.length) {
    if (pattern[i] === '\\') {
      i += 2
      continue
    }
    if (pattern[i] === ']') return i
    i++
  }
  return -1
}

/** 查找闭合圆括号 */
function findClosingParen(pattern: string, start: number): number {
  let depth = 0
  let i = start
  while (i < pattern.length) {
    if (pattern[i] === '\\') {
      i += 2
      continue
    }
    if (pattern[i] === '[') {
      i = findClosingBracket(pattern, i)
      if (i === -1) return -1
      i++
      continue
    }
    if (pattern[i] === '(') depth++
    if (pattern[i] === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

// ========== 风味兼容性检查 ==========

/** Java 不支持的 JS 特性 */
const JAVA_UNSUPPORTED = [/\(\?=/, /\(\?!/, /\(\?<=/, /\(\?<!/]

/** 检查风味兼容性警告 */
export function checkFlavorWarnings(pattern: string, flavor: RegexFlavor): string[] {
  const warnings: string[] = []

  if (flavor === 'javascript') {
    // JS 不支持 lookbehind 在部分旧引擎
    if (pattern.includes('(?<=')) {
      warnings.push('JavaScript 后顾断言在旧版引擎中可能不支持')
    }
    if (pattern.includes('(?<!')) {
      warnings.push('JavaScript 负向后顾断言在旧版引擎中可能不支持')
    }
    if (pattern.includes('(?<')) {
      warnings.push('命名捕获组使用 (?<name>...) 语法')
    }
  }

  if (flavor === 'java') {
    for (const pat of JAVA_UNSUPPORTED) {
      if (pat.test(pattern)) {
        warnings.push('Java 不完全支持此语法')
        break
      }
    }
    if (pattern.includes('(?<')) {
      // Java 支持命名捕获组，但用法不同
    }
  }

  return warnings
}

// ========== Web Worker 超时执行 ==========

/**
 * 创建带超时保护的正则匹配执行器
 * 使用 Web Worker 防止灾难性回溯卡死主线程
 */
export function createTimeoutExecutor(): {
  execute: (regex: RegExp, text: string, timeout?: number) => Promise<MatchAllResult>
  terminate: () => void
} {
  let worker: Worker | null = null

  function ensureWorker(): Worker {
    if (worker) return worker

    const workerCode = `
      self.onmessage = function(e) {
        const { source, flags, text, maxMatches } = e.data
        try {
          const regex = new RegExp(source, flags)
          const matches = []
          let match
          while ((match = regex.exec(text)) !== null) {
            if (matches.length >= maxMatches) break
            const groups = []
            for (let i = 1; i < match.length; i++) {
              if (match[i] !== undefined) {
                let name = null
                if (match.groups) {
                  for (const [k, v] of Object.entries(match.groups)) {
                    if (v === match[i]) { name = k; break }
                  }
                }
                groups.push({ index: i, name, value: match[i] })
              }
            }
            matches.push({
              index: match.index,
              length: match[0].length,
              text: match[0],
              groups
            })
            if (match[0].length === 0) regex.lastIndex++
          }
          self.postMessage({ success: true, matches })
        } catch (err) {
          self.postMessage({ success: false, error: err.message })
        }
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    worker = new Worker(URL.createObjectURL(blob))
    return worker
  }

  function execute(regex: RegExp, text: string, timeout = MATCH_TIMEOUT_MS): Promise<MatchAllResult> {
    return new Promise((resolve) => {
      const w = ensureWorker()
      const startTime = performance.now()

      const timer = setTimeout(() => {
        w.terminate()
        worker = null
        resolve({
          matches: [],
          totalCount: 0,
          elapsed: Math.round(performance.now() - startTime),
          timedOut: true
        })
      }, timeout)

      w.onmessage = (e) => {
        clearTimeout(timer)
        const { success, matches } = e.data
        if (success) {
          resolve({
            matches: matches.map((m: MatchResult) => ({
              ...m,
              groups: m.groups || []
            })),
            totalCount: matches.length,
            elapsed: Math.round(performance.now() - startTime),
            timedOut: false
          })
        } else {
          resolve({
            matches: [],
            totalCount: 0,
            elapsed: Math.round(performance.now() - startTime),
            timedOut: false
          })
        }
      }

      w.onerror = () => {
        clearTimeout(timer)
        resolve({
          matches: [],
          totalCount: 0,
          elapsed: Math.round(performance.now() - startTime),
          timedOut: false
        })
      }

      w.postMessage({
        source: regex.source,
        flags: regex.flags,
        text,
        maxMatches: MAX_MATCH_COUNT
      })
    })
  }

  function terminate(): void {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  return { execute, terminate }
}
