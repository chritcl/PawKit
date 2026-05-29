import {
  ParseError,
  ParseErrorCode,
  parse as parseJsonc
} from 'jsonc-parser'

// JSON 解析模式
export type JsonMode = 'strict' | 'jsonc'

// JSON 树路径片段
export type JsonPathSegment = string | number

// JSON 树路径
export type JsonPath = JsonPathSegment[]

// JSON 值类型
export type JsonValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

// JSON 树节点
export interface JsonTreeNode {
  id: string
  path: JsonPath
  pathText: string
  key: string
  kind: JsonValueKind
  depth: number
  valuePreview: string
  editableValue: string
  childCount: number
  expandable: boolean
  children: JsonTreeNode[]
}

// JSON 错误定位
export interface JsonDiagnostic {
  message: string
  offset: number
  line: number
  column: number
}

// JSON 操作结果
export interface JsonToolResult {
  success: boolean
  result: string
  error?: string
  diagnostic?: JsonDiagnostic
}

// JSON 校验结果
export interface JsonValidateResult {
  valid: boolean
  message: string
  diagnostic?: JsonDiagnostic
}

interface ParseSuccess {
  success: true
  value: unknown
}

interface ParseFailure {
  success: false
  diagnostic: JsonDiagnostic
}

type ParseResult = ParseSuccess | ParseFailure

// 判断值类型
export function getJsonValueKind(value: unknown): JsonValueKind {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

// JSON 路径转文本
export function jsonPathToText(path: JsonPath): string {
  if (path.length === 0) return '$'
  return path.reduce<string>((text, segment) => {
    if (typeof segment === 'number') {
      return `${text}[${segment}]`
    }
    return /^[A-Za-z_$][\w$]*$/.test(segment)
      ? `${text}.${segment}`
      : `${text}[${JSON.stringify(segment)}]`
  }, '$')
}

// 创建指定类型的默认值
export function createJsonValueByKind(kind: JsonValueKind): unknown {
  switch (kind) {
    case 'object':
      return {}
    case 'array':
      return []
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'null':
      return null
    default:
      return ''
  }
}

// 将可编辑文本解析为指定类型
export function parseJsonEditableValue(text: string, kind: JsonValueKind): { success: true; value: unknown } | { success: false; error: string } {
  if (kind === 'string') {
    return { success: true, value: text }
  }
  if (kind === 'number') {
    const value = Number(text)
    return Number.isFinite(value)
      ? { success: true, value }
      : { success: false, error: '请输入有效数字' }
  }
  if (kind === 'boolean') {
    if (text === 'true') return { success: true, value: true }
    if (text === 'false') return { success: true, value: false }
    return { success: false, error: '布尔值只能是 true 或 false' }
  }
  if (kind === 'null') {
    return { success: true, value: null }
  }
  try {
    const value = JSON.parse(text)
    const parsedKind = getJsonValueKind(value)
    return parsedKind === kind
      ? { success: true, value }
      : { success: false, error: `请输入 ${kind === 'object' ? '对象' : '数组'} 类型的 JSON` }
  } catch {
    return { success: false, error: '请输入有效 JSON 片段' }
  }
}

// 生成节点预览文本
function createJsonValuePreview(value: unknown): string {
  const kind = getJsonValueKind(value)
  if (kind === 'object') return `{${Object.keys(value as Record<string, unknown>).length}}`
  if (kind === 'array') return `[${(value as unknown[]).length}]`
  if (kind === 'string') return JSON.stringify(value)
  return String(value)
}

// 生成节点可编辑文本
function createEditableValue(value: unknown): string {
  const kind = getJsonValueKind(value)
  if (kind === 'string') return String(value)
  if (kind === 'object' || kind === 'array') return JSON.stringify(value, null, 2)
  return String(value)
}

// 从 JSON 值生成树节点
export function buildJsonTree(value: unknown, path: JsonPath = [], depth = 0): JsonTreeNode {
  const kind = getJsonValueKind(value)
  const entries = kind === 'object'
    ? Object.entries(value as Record<string, unknown>)
    : kind === 'array'
      ? (value as unknown[]).map((item, index) => [String(index), item] as [string, unknown])
      : []
  const key = path.length === 0 ? '$' : String(path[path.length - 1])
  const children = entries.map(([entryKey, entryValue], index) => {
    const nextSegment = kind === 'array' ? index : entryKey
    return buildJsonTree(entryValue, [...path, nextSegment], depth + 1)
  })

  return {
    id: jsonPathToText(path),
    path,
    pathText: jsonPathToText(path),
    key,
    kind,
    depth,
    valuePreview: createJsonValuePreview(value),
    editableValue: createEditableValue(value),
    childCount: children.length,
    expandable: children.length > 0,
    children
  }
}

// 收集默认展开节点
export function createDefaultExpandedPaths(value: unknown, maxDepth = 2): Set<string> {
  const expanded = new Set<string>()
  const walk = (node: JsonTreeNode): void => {
    if (node.expandable && node.depth < maxDepth) {
      expanded.add(node.id)
      node.children.forEach(walk)
    }
  }
  walk(buildJsonTree(value))
  return expanded
}

// 收集全部可展开节点
export function collectExpandablePaths(value: unknown): Set<string> {
  const expanded = new Set<string>()
  const walk = (node: JsonTreeNode): void => {
    if (node.expandable) expanded.add(node.id)
    node.children.forEach(walk)
  }
  walk(buildJsonTree(value))
  return expanded
}

// 深拷贝 JSON 值
function cloneJsonValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

// 获取路径上的容器
function getParentAtPath(root: unknown, path: JsonPath): unknown {
  return path.slice(0, -1).reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown> | unknown[])[segment as never]
    }
    return undefined
  }, root)
}

// 修改指定路径的值
export function setJsonValueAtPath(root: unknown, path: JsonPath, value: unknown): unknown {
  if (path.length === 0) return value
  const nextRoot = cloneJsonValue(root)
  const parent = getParentAtPath(nextRoot, path)
  const segment = path[path.length - 1]
  if (Array.isArray(parent) && typeof segment === 'number') {
    parent[segment] = value
  } else if (parent && typeof parent === 'object' && typeof segment === 'string') {
    ;(parent as Record<string, unknown>)[segment] = value
  }
  return nextRoot
}

// 删除指定路径的值
export function removeJsonValueAtPath(root: unknown, path: JsonPath): unknown {
  if (path.length === 0) return root
  const nextRoot = cloneJsonValue(root)
  const parent = getParentAtPath(nextRoot, path)
  const segment = path[path.length - 1]
  if (Array.isArray(parent) && typeof segment === 'number') {
    parent.splice(segment, 1)
  } else if (parent && typeof parent === 'object' && typeof segment === 'string') {
    delete (parent as Record<string, unknown>)[segment]
  }
  return nextRoot
}

// 重命名对象属性
export function renameJsonKeyAtPath(root: unknown, path: JsonPath, nextKey: string): { success: true; value: unknown } | { success: false; error: string } {
  if (path.length === 0) return { success: false, error: '根节点不能重命名' }
  if (!nextKey) return { success: false, error: '键名不能为空' }
  const nextRoot = cloneJsonValue(root)
  const parent = getParentAtPath(nextRoot, path)
  const segment = path[path.length - 1]
  if (!parent || typeof parent !== 'object' || Array.isArray(parent) || typeof segment !== 'string') {
    return { success: false, error: '数组项不能重命名' }
  }
  const record = parent as Record<string, unknown>
  if (nextKey !== segment && Object.prototype.hasOwnProperty.call(record, nextKey)) {
    return { success: false, error: '同级对象中已存在该键名' }
  }
  const renamed: Record<string, unknown> = {}
  Object.keys(record).forEach((key) => {
    renamed[key === segment ? nextKey : key] = record[key]
  })
  Object.keys(record).forEach((key) => delete record[key])
  Object.assign(record, renamed)
  return { success: true, value: nextRoot }
}

// 给对象或数组添加子节点
export function addJsonChildAtPath(
  root: unknown,
  path: JsonPath,
  kind: JsonValueKind,
  key = 'newKey'
): { success: true; value: unknown } | { success: false; error: string } {
  const nextRoot = cloneJsonValue(root)
  const parent = path.length === 0
    ? nextRoot
    : path.reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown> | unknown[])[segment as never]
      }
      return undefined
    }, nextRoot)

  if (Array.isArray(parent)) {
    parent.push(createJsonValueByKind(kind))
    return { success: true, value: nextRoot }
  }

  if (parent && typeof parent === 'object') {
    const record = parent as Record<string, unknown>
    let nextKey = key.trim() || 'newKey'
    let index = 1
    while (Object.prototype.hasOwnProperty.call(record, nextKey)) {
      nextKey = `${key}${index}`
      index += 1
    }
    record[nextKey] = createJsonValueByKind(kind)
    return { success: true, value: nextRoot }
  }

  return { success: false, error: '只能给对象或数组添加节点' }
}

// 根据偏移量获取行列
export function getJsonLineColumn(json: string, offset: number): JsonDiagnostic {
  const safeOffset = Math.max(0, Math.min(offset, json.length))
  const before = json.slice(0, safeOffset)
  const lines = before.split('\n')
  return {
    message: '',
    offset: safeOffset,
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

// 翻译 JSONC 错误
function translateJsoncError(error: ParseErrorCode): string {
  switch (error) {
    case ParseErrorCode.InvalidSymbol:
      return '包含无效字符'
    case ParseErrorCode.InvalidNumberFormat:
      return '数字格式无效'
    case ParseErrorCode.PropertyNameExpected:
      return '对象属性名必须使用双引号'
    case ParseErrorCode.ValueExpected:
      return '缺少 JSON 值'
    case ParseErrorCode.ColonExpected:
      return '属性名后缺少冒号'
    case ParseErrorCode.CommaExpected:
      return '缺少逗号'
    case ParseErrorCode.CloseBraceExpected:
      return '对象缺少右花括号'
    case ParseErrorCode.CloseBracketExpected:
      return '数组缺少右方括号'
    case ParseErrorCode.EndOfFileExpected:
      return 'JSON 结束后还有多余内容'
    default:
      return 'JSON 格式错误'
  }
}

// 从严格 JSON 错误中提取定位
function parseStrictJsonError(json: string, error: Error): JsonDiagnostic {
  const message = error.message
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) {
    const line = Number(lineColumnMatch[1])
    const column = Number(lineColumnMatch[2])
    const offset = json.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0) + column - 1
    return {
      message: translateStrictJsonMessage(message),
      offset: Math.max(0, Math.min(offset, json.length)),
      line,
      column
    }
  }

  const positionMatch = message.match(/position\s+(\d+)/i)
  const offset = positionMatch ? Number(positionMatch[1]) : 0
  const location = getJsonLineColumn(json, offset)
  return {
    ...location,
    message: translateStrictJsonMessage(message)
  }
}

// 翻译严格 JSON 错误
function translateStrictJsonMessage(message: string): string {
  if (message.includes('Unexpected end')) {
    return 'JSON 不完整，意外结束'
  }
  if (message.includes('Unexpected token')) {
    return 'JSON 包含意外字符'
  }
  if (message.includes('Expected property name')) {
    return '对象属性名必须使用双引号'
  }
  if (message.includes('Expected')) {
    return '缺少预期的 JSON 符号'
  }
  if (message.includes('not valid JSON')) {
    return '输入的文本不是有效的 JSON'
  }
  return `JSON 解析错误：${message}`
}

// 解析 JSON 输入
export function parseJsonInput(json: string, mode: JsonMode): ParseResult {
  if (json.length === 0) {
    return {
      success: false,
      diagnostic: {
        message: '请输入 JSON 内容',
        offset: 0,
        line: 1,
        column: 1
      }
    }
  }

  if (mode === 'strict') {
    try {
      return {
        success: true,
        value: JSON.parse(json)
      }
    } catch (error) {
      return {
        success: false,
        diagnostic: parseStrictJsonError(json, error as Error)
      }
    }
  }

  const errors: ParseError[] = []
  const value = parseJsonc(json, errors, {
    allowTrailingComma: true,
    disallowComments: false
  })

  if (errors.length > 0) {
    const firstError = errors[0]
    const location = getJsonLineColumn(json, firstError.offset)
    return {
      success: false,
      diagnostic: {
        ...location,
        message: translateJsoncError(firstError.error)
      }
    }
  }

  return {
    success: true,
    value
  }
}

// 递归排序对象键名，数组顺序保持不变
export function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortJsonValue(record[key])
        return sorted
      }, {})
  }

  return value
}

// 构造失败结果
function createFailureResult(diagnostic: JsonDiagnostic): JsonToolResult {
  return {
    success: false,
    result: '',
    error: `第 ${diagnostic.line} 行，第 ${diagnostic.column} 列：${diagnostic.message}`,
    diagnostic
  }
}

// 格式化 JSON
export function formatJson(json: string, mode: JsonMode = 'strict'): JsonToolResult {
  const parsed = parseJsonInput(json, mode)
  if (!parsed.success) return createFailureResult(parsed.diagnostic)

  return {
    success: true,
    result: JSON.stringify(parsed.value, null, 2)
  }
}

// 压缩 JSON
export function compressJson(json: string, mode: JsonMode = 'strict'): JsonToolResult {
  const parsed = parseJsonInput(json, mode)
  if (!parsed.success) return createFailureResult(parsed.diagnostic)

  return {
    success: true,
    result: JSON.stringify(parsed.value)
  }
}

// 排序 JSON
export function sortJson(json: string, mode: JsonMode = 'strict'): JsonToolResult {
  const parsed = parseJsonInput(json, mode)
  if (!parsed.success) return createFailureResult(parsed.diagnostic)

  return {
    success: true,
    result: JSON.stringify(sortJsonValue(parsed.value), null, 2)
  }
}

// 校验 JSON
export function validateJson(json: string, mode: JsonMode = 'strict'): JsonValidateResult {
  const parsed = parseJsonInput(json, mode)
  if (!parsed.success) {
    return {
      valid: false,
      message: `第 ${parsed.diagnostic.line} 行，第 ${parsed.diagnostic.column} 列：${parsed.diagnostic.message}`,
      diagnostic: parsed.diagnostic
    }
  }

  return {
    valid: true,
    message: mode === 'jsonc' ? 'JSONC 格式正确，可输出为标准 JSON' : 'JSON 格式正确'
  }
}

// 示例 JSON
export const exampleJson = `{
  "name": "PawKit",
  "version": "0.0.1",
  "description": "Windows 桌面效率工具箱",
  "features": [
    "剪贴板历史",
    "JSON 工具",
    "时间戳转换",
    "调色板"
  ],
  "author": {
    "name": "噗噗",
    "role": "开发者"
  },
  "isAwesome": true,
  "score": 99.5
}`

// 示例 JSONC
export const exampleJsonc = `{
  // JSONC 支持注释和尾逗号
  "name": "PawKit",
  "features": [
    "格式化",
    "压缩",
    "排序",
  ],
}`
