import { useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { Diagnostic, linter } from '@codemirror/lint'
import { searchKeymap } from '@codemirror/search'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { EditorView, ViewUpdate, keymap } from '@codemirror/view'
import {
  AlignLeft,
  ArrowDownAZ,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  FileJson,
  ListCollapse,
  ListTree,
  Minimize2,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react'
import {
  JsonDiagnostic,
  JsonMode,
  JsonPath,
  JsonTreeNode,
  JsonValueKind,
  addJsonChildAtPath,
  buildJsonTree,
  collectExpandablePaths,
  compressJson,
  createDefaultExpandedPaths,
  createJsonValueByKind,
  exampleJson,
  exampleJsonc,
  formatJson,
  getJsonLineColumn,
  parseJsonEditableValue,
  parseJsonInput,
  removeJsonValueAtPath,
  renameJsonKeyAtPath,
  setJsonValueAtPath,
  sortJson,
  validateJson
} from '../../../utils/json'

type JsonAction = 'format' | 'compress' | 'sort' | 'validate'

interface StatusState {
  type: 'idle' | 'success' | 'error'
  message: string
}

interface TreeEditorProps {
  node: JsonTreeNode
  rootValue: unknown
  expanded: Set<string>
  onToggle: (id: string) => void
  onChangeRoot: (value: unknown, message: string, expanded?: Set<string>) => void
  onStatus: (status: StatusState) => void
  onCopy: (text: string, message: string) => Promise<void>
}

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: '#e5e7eb',
    height: '100%'
  },
  '.cm-scroller': {
    fontFamily: 'JetBrains Mono, Consolas, monospace'
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: '#6b7280',
    borderRight: '1px solid rgba(255,255,255,0.08)'
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'rgba(22,119,255,0.12)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(22,119,255,0.35) !important'
  }
})

const valueKinds: JsonValueKind[] = ['string', 'number', 'boolean', 'null', 'object', 'array']

function stringifyRoot(value: unknown, compressed = false): string {
  return JSON.stringify(value, null, compressed ? 0 : 2)
}

function getNodeValueText(rootValue: unknown, path: JsonPath): string {
  const value = path.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown> | unknown[])[segment as never]
    }
    return undefined
  }, rootValue)
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function TreeEditor({
  node,
  rootValue,
  expanded,
  onToggle,
  onChangeRoot,
  onStatus,
  onCopy
}: TreeEditorProps): JSX.Element {
  const isExpanded = expanded.has(node.id)
  const isRoot = node.path.length === 0
  const canRename = !isRoot && typeof node.path[node.path.length - 1] === 'string'
  const isPrimitive = !node.expandable && node.kind !== 'object' && node.kind !== 'array'

  const updateNodeValue = (text: string, kind = node.kind): void => {
    const parsed = parseJsonEditableValue(text, kind)
    if (!parsed.success) {
      onStatus({ type: 'error', message: parsed.error })
      return
    }
    const nextRoot = setJsonValueAtPath(rootValue, node.path, parsed.value)
    onChangeRoot(nextRoot, '节点值已更新')
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
        className="grid min-w-[720px] grid-cols-[24px_180px_110px_minmax(160px,1fr)_170px] items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-sm hover:bg-white/[0.04]"
        style={{ paddingLeft: 12 + node.depth * 18 }}
      >
        <button
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-20"
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
            className="h-8 rounded border border-white/10 bg-black/20 px-2 font-mono text-xs text-gray-200 outline-none focus:border-[#1677ff]/60"
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
          <div className="truncate font-mono text-xs text-gray-400" title={node.pathText}>
            {isRoot ? '$' : node.key}
          </div>
        )}

        <select
          className="h-8 rounded border border-white/10 bg-[#101722] px-2 text-xs text-gray-200 outline-none focus:border-[#1677ff]/60"
          value={node.kind}
          onChange={(event) => updateNodeKind(event.target.value as JsonValueKind)}
          title="类型"
        >
          {valueKinds.map((kind) => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>

        {isPrimitive ? (
          <input
            key={`${node.id}-value-${node.kind}`}
            className="h-8 rounded border border-white/10 bg-black/20 px-2 font-mono text-xs text-gray-200 outline-none focus:border-[#1677ff]/60"
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
          <div className="truncate font-mono text-xs text-gray-500" title={node.valuePreview}>
            {node.valuePreview}
          </div>
        )}

        <div className="flex items-center justify-end gap-1">
          {(node.kind === 'object' || node.kind === 'array') && (
            <>
              <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" onClick={() => addChild('string')} title="添加字符串">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" onClick={() => addChild('object')} title="添加对象">
                <Braces className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" onClick={() => onCopy(node.pathText, '路径已复制')} title="复制路径">
            路径
          </button>
          <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" onClick={() => onCopy(getNodeValueText(rootValue, node.path), '节点值已复制')} title="复制值">
            值
          </button>
          {!isRoot && (
            <button className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10" onClick={removeNode} title="删除节点">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {node.expandable && isExpanded && node.children.map((child) => (
        <TreeEditor
          key={child.id}
          node={child}
          rootValue={rootValue}
          expanded={expanded}
          onToggle={onToggle}
          onChangeRoot={onChangeRoot}
          onStatus={onStatus}
          onCopy={onCopy}
        />
      ))}
    </div>
  )
}

// JSON 工具组件
export function JsonToolPage(): JSX.Element {
  const [mode, setMode] = useState<JsonMode>('strict')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<StatusState>({ type: 'idle', message: '等待输入' })
  const [diagnostic, setDiagnostic] = useState<JsonDiagnostic | null>(null)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['$']))
  const inputViewRef = useRef<EditorView | null>(null)

  const parsed = useMemo(() => parseJsonInput(input, mode), [input, mode])
  const tree = useMemo(() => parsed.success ? buildJsonTree(parsed.value) : null, [parsed])

  const inputExtensions = useMemo(() => {
    const diagnosticLinter = linter((): Diagnostic[] => {
      if (!diagnostic) return []
      return [{
        from: diagnostic.offset,
        to: Math.min(input.length, diagnostic.offset + 1),
        severity: 'error',
        message: diagnostic.message
      }]
    })

    return [
      json(),
      diagnosticLinter,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      editorTheme
    ]
  }, [diagnostic, input.length])

  const focusDiagnostic = (nextDiagnostic: JsonDiagnostic | null): void => {
    if (!nextDiagnostic || !inputViewRef.current) return
    const view = inputViewRef.current
    view.dispatch({
      selection: { anchor: nextDiagnostic.offset },
      effects: EditorView.scrollIntoView(nextDiagnostic.offset, { y: 'center' })
    })
    view.focus()
  }

  const rewriteInput = (text: string, message: string, nextExpanded?: Set<string>): void => {
    setInput(text)
    setDiagnostic(null)
    setStatus({ type: 'success', message })
    if (nextExpanded) {
      setExpanded(nextExpanded)
    }
  }

  const rewriteRootValue = (value: unknown, message: string, nextExpanded?: Set<string>): void => {
    rewriteInput(stringifyRoot(value), message, nextExpanded)
  }

  const runAction = (action: JsonAction): void => {
    if (action === 'validate') {
      const result = validateJson(input, mode)
      setDiagnostic(result.diagnostic ?? null)
      setStatus({
        type: result.valid ? 'success' : 'error',
        message: result.message
      })
      if (!result.valid) focusDiagnostic(result.diagnostic ?? null)
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
        action === 'format' ? '已格式化并回写编辑器' : action === 'compress' ? '已压缩并回写编辑器' : '已排序并回写编辑器',
        reparsed.success ? createDefaultExpandedPaths(reparsed.value) : undefined
      )
      setMode('strict')
      return
    }

    setDiagnostic(result.diagnostic ?? null)
    setStatus({ type: 'error', message: result.error ?? '处理失败' })
    focusDiagnostic(result.diagnostic ?? null)
  }

  const handlePaste = async (): Promise<void> => {
    const text = await window.electronAPI.clipboard.readText()
    setInput(text)
    const pasted = parseJsonInput(text, mode)
    setExpanded(pasted.success ? createDefaultExpandedPaths(pasted.value) : new Set(['$']))
    setDiagnostic(null)
    setStatus({ type: 'success', message: '已从剪贴板粘贴' })
  }

  const handleCopy = async (text = input, message = 'JSON 已复制'): Promise<void> => {
    if (!text) return
    await window.electronAPI.clipboard.writeText(text)
    setStatus({ type: 'success', message })
  }

  const handleClear = (): void => {
    setInput('')
    setDiagnostic(null)
    setExpanded(new Set(['$']))
    setStatus({ type: 'idle', message: '已清空' })
  }

  const handleExample = (): void => {
    const text = mode === 'jsonc' ? exampleJsonc : exampleJson
    const parsedExample = parseJsonInput(text, mode)
    setInput(text)
    setExpanded(parsedExample.success ? createDefaultExpandedPaths(parsedExample.value) : new Set(['$']))
    setDiagnostic(null)
    setStatus({ type: 'success', message: '已填充示例' })
  }

  const handleModeChange = (nextMode: JsonMode): void => {
    setMode(nextMode)
    setDiagnostic(null)
    setStatus({
      type: 'idle',
      message: nextMode === 'jsonc' ? 'JSONC 模式已启用' : '严格 JSON 模式已启用'
    })
  }

  const handleInputUpdate = (update: ViewUpdate): void => {
    const offset = update.state.selection.main.head
    const location = getJsonLineColumn(update.state.doc.toString(), offset)
    setCursor({ line: location.line, column: location.column })
  }

  const handleToggle = (id: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const collapseToLevel = (level: number): void => {
    if (!parsed.success) return
    setExpanded(createDefaultExpandedPaths(parsed.value, level))
    setStatus({ type: 'success', message: `已展开前 ${level} 层` })
  }

  const statusClassName = status.type === 'success'
    ? 'text-emerald-300'
    : status.type === 'error'
      ? 'text-red-300'
      : 'text-gray-400'
  const inputBytes = new Blob([input]).size

  return (
    <div className="flex h-full min-h-[620px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <div className="mr-2 inline-flex rounded-md border border-white/10 bg-white/5 p-1">
          <button className={`h-8 rounded px-3 text-sm ${mode === 'strict' ? 'bg-[#1677ff] text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleModeChange('strict')}>
            严格 JSON
          </button>
          <button className={`h-8 rounded px-3 text-sm ${mode === 'jsonc' ? 'bg-[#1677ff] text-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleModeChange('jsonc')}>
            JSONC
          </button>
        </div>

        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1677ff] px-3 text-sm font-medium text-white hover:bg-[#2f86ff]" onClick={() => runAction('format')} title="格式化并回写">
          <AlignLeft className="h-4 w-4" />
          格式化
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={() => runAction('compress')} title="压缩并回写">
          <Minimize2 className="h-4 w-4" />
          压缩
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={() => runAction('sort')} title="递归排序并回写">
          <ArrowDownAZ className="h-4 w-4" />
          排序
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={() => runAction('validate')} title="校验">
          <Check className="h-4 w-4" />
          校验
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={handlePaste} title="从剪贴板粘贴">
            <Clipboard className="h-4 w-4" />
            粘贴
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40" onClick={() => void handleCopy()} disabled={!input} title="复制 JSON">
            <Copy className="h-4 w-4" />
            复制
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={handleExample} title="填充示例">
            <FileJson className="h-4 w-4" />
            示例
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-gray-200 hover:bg-white/10" onClick={handleClear} title="清空">
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,0.9fr)_minmax(440px,1.1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>文本编辑</span>
            <span className="text-xs text-gray-500">{inputBytes} bytes</span>
          </div>
          <div className="min-h-0 flex-1">
            <CodeMirror
              value={input}
              height="100%"
              theme="dark"
              extensions={inputExtensions}
              onChange={(value) => {
                setInput(value)
                setDiagnostic(null)
              }}
              onUpdate={handleInputUpdate}
              onCreateEditor={(view) => {
                inputViewRef.current = view
              }}
              placeholder="粘贴 JSON 或 JSONC 内容..."
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-sm text-gray-300">
            <span>结构编辑</span>
            <div className="flex items-center gap-1">
              <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" disabled={!parsed.success} onClick={() => parsed.success && setExpanded(collectExpandablePaths(parsed.value))} title="展开全部">
                <ListTree className="h-3.5 w-3.5" />
              </button>
              <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" disabled={!parsed.success} onClick={() => setExpanded(new Set(['$']))} title="收起全部">
                <ListCollapse className="h-3.5 w-3.5" />
              </button>
              <button className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white" disabled={!parsed.success} onClick={() => collapseToLevel(2)} title="展开前 2 层">
                2层
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {parsed.success && tree ? (
              <TreeEditor
                node={tree}
                rootValue={parsed.value}
                expanded={expanded}
                onToggle={handleToggle}
                onChangeRoot={rewriteRootValue}
                onStatus={setStatus}
                onCopy={handleCopy}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
                <Braces className="h-9 w-9 text-gray-600" />
                <span>{input ? 'JSON 无法解析，修正后可编辑结构树' : '输入 JSON 后显示结构树'}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-xs">
        <span className={statusClassName}>{status.message}</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">模式：{mode === 'jsonc' ? 'JSONC' : '严格 JSON'}</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">光标：第 {cursor.line} 行，第 {cursor.column} 列</span>
        {diagnostic && (
          <>
            <span className="text-gray-600">|</span>
            <button className="inline-flex items-center gap-1 text-red-300 hover:text-red-200" onClick={() => focusDiagnostic(diagnostic)}>
              <RotateCcw className="h-3.5 w-3.5" />
              定位错误
            </button>
          </>
        )}
      </div>
    </div>
  )
}
