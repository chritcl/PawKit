import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { Diagnostic, linter } from '@codemirror/lint'
import { defaultKeymap, historyKeymap, undo } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { EditorView, ViewUpdate, keymap } from '@codemirror/view'
import {
  AlignLeft,
  ArrowDownAZ,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  FileJson,
  GitCompareArrows,
  ListCollapse,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  X
} from 'lucide-react'
import {
  JsonDiagnostic,
  JsonDiffEntry,
  JsonDiffKind,
  JsonMode,
  JsonPath,
  JsonQueryMatch,
  JsonTreeNode,
  JsonValueKind,
  addJsonChildAtPath,
  buildJsonTree,
  collectExpandablePaths,
  compressJson,
  countJsonNodes,
  createDefaultExpandedPaths,
  createJsonValueByKind,
  diffJsonValues,
  exampleJson,
  exampleJsonc,
  formatJson,
  getJsonLineColumn,
  parseJsonEditableValue,
  parseJsonInput,
  queryJsonPath,
  removeJsonValueAtPath,
  renameJsonKeyAtPath,
  searchJsonValue,
  setJsonValueAtPath,
  sortJson,
  validateJson
} from '../../../utils/json'

type WorkMode = 'browse' | 'query' | 'diff' | 'edit'
type QueryMode = 'search' | 'jsonpath'
type DiffView = 'semantic' | 'text'

interface StatusState {
  type: 'idle' | 'success' | 'error' | 'warning'
  message: string
}

interface JsonSessionState {
  input: string
  mode: JsonMode
  original: string
}

interface TreeViewProps {
  node: JsonTreeNode
  rootValue: unknown
  expanded: Set<string>
  editable: boolean
  selectedPath: string
  onToggle: (id: string) => void
  onChangeRoot: (value: unknown, message: string, expanded?: Set<string>) => void
  onStatus: (status: StatusState) => void
  onCopy: (text: string, message: string) => Promise<void>
}

const LARGE_JSON_BYTES = 5 * 1024 * 1024
const valueKinds: JsonValueKind[] = ['string', 'number', 'boolean', 'null', 'object', 'array']

// 页面卸载时保留当前会话，应用退出后自然清空
let jsonSession: JsonSessionState = {
  input: '',
  mode: 'strict',
  original: ''
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-scroller': {
    backgroundColor: 'transparent',
    fontFamily: 'Consolas, "Cascadia Code", "Microsoft YaHei UI", monospace'
  },
  '.cm-content, .cm-line': {
    backgroundColor: 'transparent'
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--glass-muted)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--glass-border)'
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(var(--color-primary-rgb), 0.24) !important'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  }
})

function stringifyRoot(value: unknown, compressed = false): string {
  return JSON.stringify(value, null, compressed ? 0 : 2)
}

function getValueAtPath(rootValue: unknown, path: JsonPath): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown> | unknown[])[segment as never]
    }
    return undefined
  }, rootValue)
}

function getNodeValueText(rootValue: unknown, path: JsonPath): string {
  const value = getValueAtPath(rootValue, path)
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatPreview(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (text === undefined) return '未定义'
  return text.length > 240 ? `${text.slice(0, 240)}…` : text
}

function formatFullValue(value: unknown): string {
  if (value === undefined) return '未定义'
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function createTextDiffRows(leftText: string, rightText: string): Array<{ left: string; right: string; changed: boolean }> {
  const leftLines = leftText.split('\n')
  const rightLines = rightText.split('\n')
  return Array.from({ length: Math.max(leftLines.length, rightLines.length) }, (_, index) => ({
    left: leftLines[index] ?? '',
    right: rightLines[index] ?? '',
    changed: leftLines[index] !== rightLines[index]
  }))
}

function getDiffLabel(kind: JsonDiffKind): string {
  if (kind === 'added') return '新增'
  if (kind === 'removed') return '删除'
  if (kind === 'type-changed') return '类型变化'
  return '修改'
}

function getDiffClassName(kind: JsonDiffKind): string {
  if (kind === 'added') return 'json-diff-added'
  if (kind === 'removed') return 'json-diff-removed'
  if (kind === 'type-changed') return 'json-diff-type'
  return 'json-diff-modified'
}

function getTypeClassName(kind: JsonValueKind): string {
  return `json-type-${kind}`
}

function findMatchOffset(text: string, match: JsonQueryMatch): number {
  const lastSegment = match.path[match.path.length - 1]
  const candidates = [
    typeof lastSegment === 'string' ? JSON.stringify(lastSegment) : '',
    typeof match.value === 'string' ? JSON.stringify(match.value) : JSON.stringify(match.value)
  ].filter(Boolean)
  for (const candidate of candidates) {
    const offset = text.indexOf(candidate)
    if (offset >= 0) return offset
  }
  return 0
}

function TreeView({
  node,
  rootValue,
  expanded,
  editable,
  selectedPath,
  onToggle,
  onChangeRoot,
  onStatus,
  onCopy
}: TreeViewProps): JSX.Element {
  const isExpanded = expanded.has(node.id)
  const isRoot = node.path.length === 0
  const canRename = editable && !isRoot && typeof node.path[node.path.length - 1] === 'string'
  const isPrimitive = !node.expandable && node.kind !== 'object' && node.kind !== 'array'

  const updateNodeValue = (text: string, kind = node.kind): void => {
    const parsed = parseJsonEditableValue(text, kind)
    if (!parsed.success) {
      onStatus({ type: 'error', message: parsed.error })
      return
    }
    onChangeRoot(setJsonValueAtPath(rootValue, node.path, parsed.value), '节点值已更新')
  }

  const updateNodeKind = (kind: JsonValueKind): void => {
    const nextRoot = setJsonValueAtPath(rootValue, node.path, createJsonValueByKind(kind))
    onChangeRoot(nextRoot, '节点类型已切换', createDefaultExpandedPaths(nextRoot))
  }

  const renameNode = (nextKey: string): void => {
    if (!canRename || nextKey === node.key) return
    const result = renameJsonKeyAtPath(rootValue, node.path, nextKey)
    if (!result.success) {
      onStatus({ type: 'error', message: result.error })
      return
    }
    onChangeRoot(result.value, '键名已更新', createDefaultExpandedPaths(result.value))
  }

  const removeNode = (): void => {
    if (!window.confirm(`确定删除 ${node.pathText} 吗？此操作可通过撤销恢复。`)) return
    const nextRoot = removeJsonValueAtPath(rootValue, node.path)
    onChangeRoot(nextRoot, '节点已删除', createDefaultExpandedPaths(nextRoot))
  }

  const addChild = (kind: JsonValueKind): void => {
    const key = node.kind === 'object'
      ? window.prompt('请输入新键名', 'newKey') ?? ''
      : ''
    const result = addJsonChildAtPath(rootValue, node.path, kind, key)
    if (!result.success) {
      onStatus({ type: 'error', message: result.error })
      return
    }
    const nextExpanded = new Set(expanded)
    nextExpanded.add(node.id)
    onChangeRoot(result.value, '子节点已添加', nextExpanded)
  }

  return (
    <div>
      <div
        className={`json-tree-row ${selectedPath === node.pathText ? 'json-tree-row-selected' : ''}`}
        style={{ paddingLeft: 10 + node.depth * 16 }}
      >
        <button
          className="json-tree-toggle"
          disabled={!node.expandable}
          onClick={() => onToggle(node.id)}
          title={isExpanded ? '收起节点' : '展开节点'}
        >
          {node.expandable
            ? isExpanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            : null}
        </button>

        {canRename ? (
          <input
            key={`${node.id}-key`}
            className="field-input json-tree-input"
            defaultValue={node.key}
            onBlur={(event) => renameNode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                renameNode(event.currentTarget.value)
                event.currentTarget.blur()
              }
            }}
            title="键名"
          />
        ) : (
          <button
            className="json-tree-key"
            onClick={() => void onCopy(node.pathText, '路径已复制')}
            title={`${node.pathText}，点击复制路径`}
          >
            {isRoot ? '$' : node.key}
          </button>
        )}

        {editable ? (
          <select
            className="field-select json-tree-select"
            value={node.kind}
            onChange={(event) => updateNodeKind(event.target.value as JsonValueKind)}
            title="类型"
          >
            {valueKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        ) : (
          <span className={`json-type-badge ${getTypeClassName(node.kind)}`}>{node.kind}</span>
        )}

        {editable && isPrimitive ? (
          <input
            key={`${node.id}-value-${node.kind}`}
            className="field-input json-tree-input"
            defaultValue={node.editableValue}
            onBlur={(event) => updateNodeValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                updateNodeValue(event.currentTarget.value)
                event.currentTarget.blur()
              }
            }}
            title="节点值"
          />
        ) : (
          <button
            className={`json-tree-preview ${getTypeClassName(node.kind)}`}
            onClick={() => void onCopy(getNodeValueText(rootValue, node.path), '节点值已复制')}
            title={`${node.valuePreview}，点击复制值`}
          >
            {node.valuePreview}
          </button>
        )}

        {editable && (
          <div className="json-tree-actions">
            {(node.kind === 'object' || node.kind === 'array') && (
              <button onClick={() => addChild('string')} title="添加字符串节点"><Plus className="h-3.5 w-3.5" /></button>
            )}
            {(node.kind === 'object' || node.kind === 'array') && (
              <button onClick={() => addChild('object')} title="添加对象节点"><Braces className="h-3.5 w-3.5" /></button>
            )}
            {!isRoot && <button className="tone-danger" onClick={removeNode} title="删除节点"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        )}
      </div>

      {node.expandable && isExpanded && node.children.map((child) => (
        <TreeView
          key={child.id}
          node={child}
          rootValue={rootValue}
          expanded={expanded}
          editable={editable}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onChangeRoot={onChangeRoot}
          onStatus={onStatus}
          onCopy={onCopy}
        />
      ))}
    </div>
  )
}

// JSON 专业调试台
export function JsonToolPage(): JSX.Element {
  const [input, setInput] = useState(jsonSession.input)
  const [mode, setMode] = useState<JsonMode>(jsonSession.mode)
  const [original, setOriginal] = useState(jsonSession.original)
  const [workMode, setWorkMode] = useState<WorkMode>('browse')
  const [status, setStatus] = useState<StatusState>({ type: 'idle', message: '等待输入' })
  const [diagnostic, setDiagnostic] = useState<JsonDiagnostic | null>(null)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['$']))
  const [selectedPath, setSelectedPath] = useState('')
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [queryMode, setQueryMode] = useState<QueryMode>('search')
  const [queryText, setQueryText] = useState('')
  const [diffInput, setDiffInput] = useState('')
  const [diffView, setDiffView] = useState<DiffView>('semantic')
  const [selectedDiff, setSelectedDiff] = useState<JsonDiffEntry | null>(null)
  const [pendingMatchOffset, setPendingMatchOffset] = useState<number | null>(null)
  const [largeAnalysisEnabled, setLargeAnalysisEnabled] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const inputViewRef = useRef<EditorView | null>(null)
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inputBytes = useMemo(() => new Blob([input]).size, [input])
  const diffBytes = useMemo(() => new Blob([diffInput]).size, [diffInput])
  const hasLargeDocument = inputBytes > LARGE_JSON_BYTES || diffBytes > LARGE_JSON_BYTES
  const lightweightMode = hasLargeDocument && !largeAnalysisEnabled
  const parsed = useMemo(
    () => lightweightMode ? null : parseJsonInput(input, mode),
    [input, lightweightMode, mode]
  )
  const tree = useMemo(
    () => parsed?.success ? buildJsonTree(parsed.value) : null,
    [parsed]
  )
  const nodeCount = useMemo(
    () => parsed?.success ? countJsonNodes(parsed.value) : 0,
    [parsed]
  )
  const automaticDiagnostic = input && parsed && !parsed.success ? parsed.diagnostic : null
  const activeDiagnostic = diagnostic ?? automaticDiagnostic

  const queryResult = useMemo(() => {
    if (!parsed?.success || !queryText.trim()) return { matches: [] as JsonQueryMatch[], error: '' }
    if (queryMode === 'search') {
      return { matches: searchJsonValue(parsed.value, queryText), error: '' }
    }
    const result = queryJsonPath(parsed.value, queryText)
    return result.success
      ? { matches: result.matches, error: '' }
      : { matches: [] as JsonQueryMatch[], error: result.error }
  }, [parsed, queryMode, queryText])

  const parsedDiff = useMemo(
    () => diffInput && !lightweightMode ? parseJsonInput(diffInput, mode) : null,
    [diffInput, lightweightMode, mode]
  )
  const diffEntries = useMemo(
    () => parsed?.success && parsedDiff?.success ? diffJsonValues(parsed.value, parsedDiff.value) : [],
    [parsed, parsedDiff]
  )
  const diffSummary = useMemo(() => diffEntries.reduce<Record<JsonDiffKind, number>>((summary, entry) => {
    summary[entry.kind] += 1
    return summary
  }, { added: 0, removed: 0, modified: 0, 'type-changed': 0 }), [diffEntries])

  const inputExtensions = useMemo(() => {
    const diagnosticLinter = linter((): Diagnostic[] => {
      if (!activeDiagnostic) return []
      return [{
        from: activeDiagnostic.offset,
        to: Math.min(input.length, activeDiagnostic.offset + 1),
        severity: 'error',
        message: activeDiagnostic.message
      }]
    })

    return [
      json(),
      diagnosticLinter,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.lineWrapping,
      editorTheme
    ]
  }, [activeDiagnostic, input.length])

  useEffect(() => {
    jsonSession = { input, mode, original }
  }, [input, mode, original])

  useEffect(() => {
    if (status.type !== 'success') return
    const timer = window.setTimeout(() => setStatus({ type: 'idle', message: '就绪' }), 2600)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return
      if (event.key.toLowerCase() === 'f' && !lightweightMode) {
        event.preventDefault()
        setWorkMode('query')
        setQueryMode('search')
      } else if (event.shiftKey && event.key.toLowerCase() === 'q') {
        event.preventDefault()
        setWorkMode('query')
        setQueryMode('jsonpath')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [lightweightMode])

  useEffect(() => {
    if (pendingMatchOffset === null || !inputViewRef.current) return
    const view = inputViewRef.current
    view.dispatch({
      selection: { anchor: pendingMatchOffset },
      effects: EditorView.scrollIntoView(pendingMatchOffset, { y: 'center' })
    })
    view.focus()
    setPendingMatchOffset(null)
  }, [pendingMatchOffset])

  useEffect(() => () => {
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current)
  }, [])

  const focusDiagnostic = (nextDiagnostic: JsonDiagnostic | null): void => {
    if (!nextDiagnostic || !inputViewRef.current) return
    const view = inputViewRef.current
    view.dispatch({
      selection: { anchor: nextDiagnostic.offset },
      effects: EditorView.scrollIntoView(nextDiagnostic.offset, { y: 'center' })
    })
    view.focus()
  }

  const recordSnapshot = (): void => {
    setUndoStack((current) => [...current.slice(-19), input])
  }

  const rewriteInput = (
    text: string,
    message: string,
    nextExpanded?: Set<string>,
    preserveOriginal = true
  ): void => {
    recordSnapshot()
    setInput(text)
    setDiagnostic(null)
    setStatus({ type: 'success', message })
    if (!preserveOriginal || !original) setOriginal(text)
    if (nextExpanded) setExpanded(nextExpanded)
    if (new Blob([text]).size > LARGE_JSON_BYTES) setLargeAnalysisEnabled(false)
  }

  const rewriteRootValue = (value: unknown, message: string, nextExpanded?: Set<string>): void => {
    rewriteInput(stringifyRoot(value), message, nextExpanded)
  }

  const handleUndo = (): void => {
    if (undoStack.length > 0) {
      const previous = undoStack[undoStack.length - 1]
      setUndoStack((current) => current.slice(0, -1))
      setInput(previous)
      setDiagnostic(null)
      setStatus({ type: 'success', message: '已撤销上一步操作' })
      return
    }
    if (inputViewRef.current && undo(inputViewRef.current)) {
      setStatus({ type: 'success', message: '已撤销编辑内容' })
      return
    }
    setStatus({ type: 'idle', message: '没有可撤销的操作' })
  }

  const runTransform = (action: 'format' | 'compress' | 'sort'): void => {
    if (lightweightMode) {
      setStatus({ type: 'warning', message: '大型 JSON 需先执行完整分析' })
      return
    }
    const result = action === 'format'
      ? formatJson(input, mode)
      : action === 'compress'
        ? compressJson(input, mode)
        : sortJson(input, mode)

    if (result.success) {
      const reparsed = parseJsonInput(result.result, 'strict')
      rewriteInput(
        result.result,
        action === 'format' ? '已格式化，可随时撤销' : action === 'compress' ? '已压缩，可随时撤销' : '已按键名排序，可随时撤销',
        reparsed.success ? createDefaultExpandedPaths(reparsed.value) : undefined
      )
      setMode('strict')
      return
    }
    setDiagnostic(result.diagnostic ?? null)
    setStatus({ type: 'error', message: result.error ?? '处理失败' })
    focusDiagnostic(result.diagnostic ?? null)
  }

  const handleValidate = (): void => {
    if (lightweightMode) {
      setStatus({ type: 'warning', message: '轻量模式未执行完整校验，请先执行完整分析' })
      return
    }
    const result = validateJson(input, mode)
    setDiagnostic(result.diagnostic ?? null)
    setStatus({ type: result.valid ? 'success' : 'error', message: result.message })
    if (!result.valid) focusDiagnostic(result.diagnostic ?? null)
  }

  const handlePaste = async (): Promise<void> => {
    const text = await window.electronAPI.clipboard.readText()
    const pastedBytes = new Blob([text]).size
    recordSnapshot()
    setInput(text)
    setOriginal(text)
    setDiagnostic(null)
    setLargeAnalysisEnabled(pastedBytes <= LARGE_JSON_BYTES)
    if (pastedBytes <= LARGE_JSON_BYTES) {
      const pasted = parseJsonInput(text, mode)
      setExpanded(pasted.success ? createDefaultExpandedPaths(pasted.value) : new Set(['$']))
      setStatus({
        type: pasted.success ? 'success' : 'error',
        message: pasted.success ? '已粘贴并完成基础校验' : pasted.diagnostic.message
      })
    } else {
      setExpanded(new Set(['$']))
      setStatus({ type: 'warning', message: '已粘贴大型 JSON，自动进入轻量模式' })
    }
  }

  const handlePasteDiff = async (): Promise<void> => {
    const text = await window.electronAPI.clipboard.readText()
    setDiffInput(text)
    if (new Blob([text]).size > LARGE_JSON_BYTES) setLargeAnalysisEnabled(false)
    setSelectedDiff(null)
    setStatus({ type: 'success', message: '已粘贴临时对比文档 B' })
  }

  const handleCopy = async (text = input, message = 'JSON 已复制'): Promise<void> => {
    if (!text) return
    await window.electronAPI.clipboard.writeText(text)
    setStatus({ type: 'success', message })
  }

  const handleClear = (): void => {
    if (input && !window.confirm('确定清空当前 JSON 吗？此操作可通过撤销恢复。')) return
    rewriteInput('', '已清空', new Set(['$']))
    setSelectedPath('')
  }

  const handleExample = (): void => {
    const text = mode === 'jsonc' ? exampleJsonc : exampleJson
    const parsedExample = parseJsonInput(text, mode)
    rewriteInput(
      text,
      '已填充示例',
      parsedExample.success ? createDefaultExpandedPaths(parsedExample.value) : new Set(['$']),
      false
    )
  }

  const handleRestoreOriginal = (): void => {
    if (!original || original === input) {
      setStatus({ type: 'idle', message: '当前内容已经是最初版本' })
      return
    }
    rewriteInput(original, '已恢复最初内容')
  }

  const handleModeChange = (nextMode: JsonMode): void => {
    setMode(nextMode)
    setDiagnostic(null)
    setStatus({ type: 'idle', message: nextMode === 'jsonc' ? 'JSONC 模式已启用' : '严格 JSON 模式已启用' })
  }

  const handleInputUpdate = (update: ViewUpdate): void => {
    const offset = update.state.selection.main.head
    const location = getJsonLineColumn(update.state.doc.toString(), offset)
    setCursor({ line: location.line, column: location.column })
  }

  const handleInputChange = (value: string): void => {
    setInput(value)
    if (!original && value) setOriginal(value)
    setDiagnostic(null)
    if (new Blob([value]).size > LARGE_JSON_BYTES) setLargeAnalysisEnabled(false)
  }

  const handleToggle = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const prepareMatchLocation = (match: JsonQueryMatch): number => {
    setSelectedPath(match.pathText)
    const nextExpanded = new Set(expanded)
    let currentPath = '$'
    nextExpanded.add('$')
    match.path.forEach((segment) => {
      currentPath += typeof segment === 'number' ? `[${segment}]` : /^[A-Za-z_$][\w$]*$/.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`
      nextExpanded.add(currentPath)
    })
    setExpanded(nextExpanded)
    return findMatchOffset(input, match)
  }

  const startFullAnalysis = (): void => {
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current)
    setAnalyzing(true)
    setStatus({ type: 'warning', message: '正在准备完整分析，可取消' })
    analysisTimerRef.current = setTimeout(() => {
      setLargeAnalysisEnabled(true)
      setAnalyzing(false)
      setStatus({ type: 'success', message: '完整分析已启用' })
    }, 80)
  }

  const cancelAnalysis = (): void => {
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current)
    setAnalyzing(false)
    setStatus({ type: 'idle', message: '已取消完整分析' })
  }

  const closeDiffMode = (): void => {
    setWorkMode('browse')
    setDiffInput('')
    setSelectedDiff(null)
  }

  const statusClassName = status.type === 'success'
    ? 'tone-success'
    : status.type === 'error'
      ? 'tone-danger'
      : status.type === 'warning'
        ? 'tone-warning'
        : 'text-[color:var(--text-muted)]'

  const renderEditorPanel = (title = '主文档 A'): JSX.Element => (
    <section className="editor-surface tool-panel json-main-editor">
      <div className="panel-header">
        <div className="json-panel-title">
          <Code2 className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <div className="json-panel-meta">
          <span>{formatBytes(inputBytes)}</span>
          {parsed?.success && <span>{nodeCount} 个节点</span>}
          {lightweightMode && <span className="json-mode-badge json-mode-light">轻量模式</span>}
        </div>
      </div>
      <div className="panel-body code-editor-panel-body">
        <CodeMirror
          value={input}
          height="100%"
          className="code-editor-light"
          basicSetup={{ foldGutter: false }}
          extensions={inputExtensions}
          onChange={handleInputChange}
          onUpdate={handleInputUpdate}
          onCreateEditor={(view) => {
            inputViewRef.current = view
          }}
          placeholder="粘贴接口响应或 JSON / JSONC 内容..."
        />
      </div>
    </section>
  )

  const renderTreePanel = (editable: boolean): JSX.Element => (
    <section className="editor-surface tool-panel json-assistant-panel">
      <div className="panel-header">
        <div className="json-panel-title">
          {editable ? <Pencil className="h-4 w-4" /> : <ListTree className="h-4 w-4" />}
          <span>{editable ? '结构编辑' : '结构浏览'}</span>
        </div>
        <div className="action-cluster-tight">
          <button className="icon-button json-compact-icon" disabled={!parsed?.success} onClick={() => parsed?.success && setExpanded(collectExpandablePaths(parsed.value))} title="展开全部">
            <ListTree className="h-3.5 w-3.5" />
          </button>
          <button className="icon-button json-compact-icon" disabled={!parsed?.success} onClick={() => setExpanded(new Set(['$']))} title="收起全部">
            <ListCollapse className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="panel-body json-tree-body">
        {lightweightMode ? (
          <div className="json-empty-state">
            <Braces className="h-9 w-9" />
            <strong>大型 JSON 已暂停构建结构树</strong>
            <span>当前仍可使用文本浏览、搜索与复制。</span>
            <button className="toolbar-button-primary" onClick={startFullAnalysis}>完整分析</button>
          </div>
        ) : parsed?.success && tree ? (
          <TreeView
            node={tree}
            rootValue={parsed.value}
            expanded={expanded}
            editable={editable}
            selectedPath={selectedPath}
            onToggle={handleToggle}
            onChangeRoot={rewriteRootValue}
            onStatus={setStatus}
            onCopy={handleCopy}
          />
        ) : (
          <div className="json-empty-state">
            <Braces className="h-9 w-9" />
            <strong>{input ? 'JSON 无法解析' : '等待 JSON 内容'}</strong>
            <span>{input ? '修正错误后即可浏览结构。' : '粘贴响应后将在这里展示结构树。'}</span>
          </div>
        )}
      </div>
    </section>
  )

  const renderQueryPanel = (): JSX.Element => (
    <section className="editor-surface tool-panel json-assistant-panel">
      <div className="panel-header json-query-header">
        <div className="segmented-control json-mini-tabs">
          <button className={`segmented-item ${queryMode === 'search' ? 'segmented-item-active' : ''}`} onClick={() => setQueryMode('search')}>
            普通搜索
          </button>
          <button className={`segmented-item ${queryMode === 'jsonpath' ? 'segmented-item-active' : ''}`} onClick={() => setQueryMode('jsonpath')}>
            JSONPath
          </button>
        </div>
        <span className="json-query-count">{queryResult.matches.length} 项结果</span>
      </div>
      <div className="json-query-input-wrap">
        <Search className="h-4 w-4" />
        <input
          autoFocus
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder={queryMode === 'search' ? '搜索键名、路径或值...' : '例如：$.users[*].name 或 $..id'}
        />
        {queryText && <button onClick={() => setQueryText('')} title="清空查询"><X className="h-4 w-4" /></button>}
      </div>
      {queryMode === 'jsonpath' && (
        <div className="json-query-help">
          支持属性、数组索引、<code>*</code> 通配符与 <code>..</code> 递归查找。
        </div>
      )}
      <div className="panel-body json-result-list">
        {lightweightMode ? (
          <div className="json-empty-state">
            <Search className="h-9 w-9" />
            <strong>大型 JSON 已暂停结构查询</strong>
            <span>文本编辑器仍可使用 Ctrl+F 搜索；完整分析后可使用 JSONPath。</span>
            <button className="toolbar-button-primary" onClick={startFullAnalysis}>完整分析</button>
          </div>
        ) : queryResult.error ? (
          <div className="alert-surface alert-danger">{queryResult.error}</div>
        ) : queryText && queryResult.matches.length === 0 ? (
          <div className="json-empty-state"><Search className="h-8 w-8" /><strong>没有匹配结果</strong></div>
        ) : !queryText ? (
          <div className="json-empty-state"><Search className="h-8 w-8" /><strong>输入查询条件开始定位字段</strong></div>
        ) : (
          queryResult.matches.map((match, index) => (
            <div key={`${match.pathText}-${index}`} className="json-result-row">
              <button
                className="json-result-main"
                onClick={() => {
                  const offset = prepareMatchLocation(match)
                  setPendingMatchOffset(offset)
                }}
              >
                <span className="json-result-path">{match.pathText}</span>
                <span className={`json-result-preview ${getTypeClassName(match.kind)}`}>{formatPreview(match.value)}</span>
              </button>
              <span className={`json-type-badge ${getTypeClassName(match.kind)}`}>{match.kind}</span>
              <div className="json-result-actions">
                <button onClick={() => void handleCopy(match.pathText, '路径已复制')}>路径</button>
                <button onClick={() => void handleCopy(getNodeValueText(parsed?.success ? parsed.value : null, match.path), '值已复制')}>值</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )

  const renderDiffPanel = (): JSX.Element => (
    <section className="editor-surface tool-panel json-diff-panel">
      <div className="panel-header json-diff-header">
        <div className="segmented-control json-mini-tabs">
          <button className={`segmented-item ${diffView === 'semantic' ? 'segmented-item-active' : ''}`} onClick={() => setDiffView('semantic')}>语义差异</button>
          <button className={`segmented-item ${diffView === 'text' ? 'segmented-item-active' : ''}`} onClick={() => setDiffView('text')}>左右文本</button>
        </div>
        <button className="icon-button json-compact-icon" onClick={closeDiffMode} title="退出并丢弃临时文档 B"><X className="h-4 w-4" /></button>
      </div>

      {!diffInput ? (
        <div className="json-empty-state json-diff-empty">
          <GitCompareArrows className="h-10 w-10" />
          <strong>粘贴临时文档 B 开始对比</strong>
          <span>退出对比模式后，临时文档 B 会被丢弃。</span>
          <button className="toolbar-button-primary" onClick={() => void handlePasteDiff()}><Clipboard className="h-4 w-4" />粘贴文档 B</button>
        </div>
      ) : lightweightMode ? (
        <div className="json-empty-state">
          <GitCompareArrows className="h-9 w-9" />
          <strong>大型 JSON 需先执行完整分析</strong>
          <span>完整分析前不会解析主文档 A 或临时文档 B。</span>
          <button className="toolbar-button-primary" onClick={startFullAnalysis}>完整分析</button>
        </div>
      ) : parsedDiff && !parsedDiff.success ? (
        <div className="json-diff-invalid">
          <div className="alert-surface alert-danger">文档 B 无法解析：{parsedDiff.diagnostic.message}</div>
          <textarea className="field-textarea" value={diffInput} onChange={(event) => setDiffInput(event.target.value)} />
        </div>
      ) : diffView === 'text' ? (
        <div className="json-text-diff">
          <div>
            <div className="json-text-diff-title">主文档 A</div>
            <div className="json-text-diff-lines">
              {createTextDiffRows(input, diffInput).map((row, index) => (
                <div key={`left-${index}`} className={row.changed ? 'json-text-line-changed' : ''}>
                  <span>{index + 1}</span><code>{row.left || ' '}</code>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="json-text-diff-title">临时文档 B</div>
            <div className="json-text-diff-lines">
              {createTextDiffRows(input, diffInput).map((row, index) => (
                <div key={`right-${index}`} className={row.changed ? 'json-text-line-changed' : ''}>
                  <span>{index + 1}</span><code>{row.right || ' '}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="json-diff-summary">
            {(['added', 'removed', 'modified', 'type-changed'] as JsonDiffKind[]).map((kind) => (
              <div key={kind} className={getDiffClassName(kind)}>
                <span>{getDiffLabel(kind)}</span>
                <strong>{diffSummary[kind]}</strong>
              </div>
            ))}
            <button className="toolbar-button" onClick={() => void handlePasteDiff()}><RefreshCcw className="h-4 w-4" />重新粘贴 B</button>
          </div>
          <div className="json-diff-workspace">
            <div className="json-diff-list">
              {diffEntries.length === 0 ? (
                <div className="json-empty-state"><Check className="h-9 w-9 tone-success" /><strong>两份 JSON 语义一致</strong></div>
              ) : diffEntries.map((entry, index) => (
                <button
                  key={`${entry.kind}-${entry.pathText}-${index}`}
                  className={`json-diff-row ${getDiffClassName(entry.kind)} ${selectedDiff === entry ? 'json-diff-row-selected' : ''}`}
                  onClick={() => setSelectedDiff(entry)}
                >
                  <span>{getDiffLabel(entry.kind)}</span>
                  <code>{entry.pathText}</code>
                </button>
              ))}
            </div>
            <div className="json-diff-detail">
              {selectedDiff ? (
                <>
                  <div className="json-diff-detail-title">
                    <span className={getDiffClassName(selectedDiff.kind)}>{getDiffLabel(selectedDiff.kind)}</span>
                    <code>{selectedDiff.pathText}</code>
                    <button onClick={() => void handleCopy(selectedDiff.pathText, '路径已复制')}><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="json-diff-values">
                    <div><span>原值</span><pre>{formatFullValue(selectedDiff.before)}</pre></div>
                    <div><span>新值</span><pre>{formatFullValue(selectedDiff.after)}</pre></div>
                  </div>
                </>
              ) : (
                <div className="json-empty-state"><GitCompareArrows className="h-8 w-8" /><strong>选择一项差异查看前后值</strong></div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )

  return (
    <div className="tool-page json-tool-page">
      <div className="toolbar-surface json-toolbar">
        <div className="json-primary-actions">
          <button className="toolbar-button-primary" onClick={() => void handlePaste()}><Clipboard className="h-4 w-4" />粘贴</button>
          <button className="toolbar-button" disabled={!input || lightweightMode} onClick={() => runTransform('format')}><AlignLeft className="h-4 w-4" />格式化</button>
          <button className="toolbar-button" disabled={!input} onClick={() => void handleCopy()}><Copy className="h-4 w-4" />复制</button>
          <button className="toolbar-button" onClick={handleUndo}><Undo2 className="h-4 w-4" />撤销</button>
        </div>

        <div className="segmented-control json-work-tabs">
          <button className={`segmented-item ${workMode === 'browse' ? 'segmented-item-active' : ''}`} onClick={() => setWorkMode('browse')}><ListTree className="h-4 w-4" />浏览</button>
          <button className={`segmented-item ${workMode === 'query' ? 'segmented-item-active' : ''}`} onClick={() => setWorkMode('query')}><Search className="h-4 w-4" />查询</button>
          <button className={`segmented-item ${workMode === 'diff' ? 'segmented-item-active' : ''}`} onClick={() => setWorkMode('diff')}><GitCompareArrows className="h-4 w-4" />对比</button>
          <button className={`segmented-item ${workMode === 'edit' ? 'segmented-item-active' : ''}`} disabled={lightweightMode} onClick={() => setWorkMode('edit')}><Pencil className="h-4 w-4" />结构编辑</button>
        </div>

        <details
          className="json-more-menu"
          onClick={(event) => {
            const target = event.target as HTMLElement
            if (target.closest('.json-more-popover > button')) {
              event.currentTarget.open = false
            }
          }}
        >
          <summary className="toolbar-button"><MoreHorizontal className="h-4 w-4" />更多</summary>
          <div className="json-more-popover">
            <div className="json-more-heading">解析模式</div>
            <div className="segmented-control json-mode-switch">
              <button className={`segmented-item ${mode === 'strict' ? 'segmented-item-active' : ''}`} onClick={() => handleModeChange('strict')}>严格 JSON</button>
              <button className={`segmented-item ${mode === 'jsonc' ? 'segmented-item-active' : ''}`} onClick={() => handleModeChange('jsonc')}>JSONC</button>
            </div>
            <button disabled={!input || lightweightMode} onClick={() => runTransform('compress')}><Braces className="h-4 w-4" />压缩内容</button>
            <button disabled={!input || lightweightMode} onClick={() => runTransform('sort')}><ArrowDownAZ className="h-4 w-4" />键名排序</button>
            <button disabled={!input || lightweightMode} onClick={handleValidate}><Check className="h-4 w-4" />完整校验</button>
            <button onClick={handleRestoreOriginal}><RotateCcw className="h-4 w-4" />恢复最初内容</button>
            <button onClick={handleExample}><FileJson className="h-4 w-4" />填充示例</button>
            <button className="tone-danger" onClick={handleClear}><Trash2 className="h-4 w-4" />清空内容</button>
          </div>
        </details>
      </div>

      {hasLargeDocument && (
        <div className="json-large-banner">
          <div>
            <strong>{lightweightMode ? '大型 JSON 轻量模式' : '大型 JSON 完整分析模式'}</strong>
            <span>{lightweightMode ? '已暂停实时构树、结构编辑与 JSONPath，文本浏览和搜索仍然可用。' : '完整分析已启用，修改内容后会自动返回轻量模式。'}</span>
          </div>
          {analyzing ? (
            <button className="toolbar-button" onClick={cancelAnalysis}>取消分析</button>
          ) : lightweightMode ? (
            <button className="toolbar-button-primary" onClick={startFullAnalysis}>完整分析</button>
          ) : (
            <button className="toolbar-button" onClick={() => setLargeAnalysisEnabled(false)}>返回轻量模式</button>
          )}
        </div>
      )}

      {activeDiagnostic && (
        <button className="json-error-banner" onClick={() => focusDiagnostic(activeDiagnostic)}>
          <span>第 {activeDiagnostic.line} 行，第 {activeDiagnostic.column} 列：{activeDiagnostic.message}</span>
          <strong>定位错误</strong>
        </button>
      )}

      <div className={`json-workbench json-workbench-${workMode}`}>
        {workMode === 'diff' ? renderDiffPanel() : (
          <>
            {renderEditorPanel()}
            {workMode === 'query' ? renderQueryPanel() : renderTreePanel(workMode === 'edit')}
          </>
        )}
      </div>

      <div className="status-strip json-status-strip">
        <span className={statusClassName}>{status.message}</span>
        <span>{mode === 'jsonc' ? 'JSONC' : '严格 JSON'}</span>
        <span>{input ? formatBytes(inputBytes) : '空文档'}</span>
        {parsed?.success && <span>{nodeCount} 个节点</span>}
        <span>第 {cursor.line} 行，第 {cursor.column} 列</span>
        {activeDiagnostic && <button className="tone-danger" onClick={() => focusDiagnostic(activeDiagnostic)}>定位错误</button>}
      </div>
    </div>
  )
}
