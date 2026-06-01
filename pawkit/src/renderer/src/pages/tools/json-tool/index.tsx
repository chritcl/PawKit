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
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-scroller': {
    backgroundColor: 'transparent',
    fontFamily: 'Consolas, "SFMono-Regular", "Microsoft YaHei UI", monospace'
  },
  '.cm-content': {
    backgroundColor: 'transparent',
    caretColor: 'var(--text-primary)'
  },
  '.cm-line': {
    backgroundColor: 'transparent'
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
        className="grid min-w-[640px] grid-cols-[24px_minmax(120px,1fr)_96px_minmax(140px,1.1fr)_140px] items-center gap-2 border-b border-[var(--glass-border)] px-4 py-2.5 text-sm hover:bg-[var(--glass-surface-hover)]"
        style={{ paddingLeft: 12 + node.depth * 18 }}
      >
        <button
          className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[color:var(--text-muted)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)] disabled:opacity-20"
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
            className="field-input h-8 min-h-8 px-2 font-mono text-xs"
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
          <div className="truncate font-mono text-xs text-[color:var(--text-muted)]" title={node.pathText}>
            {isRoot ? '$' : node.key}
          </div>
        )}

        <select
          className="field-select h-8 min-h-8 px-2 text-xs"
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
            className="field-input h-8 min-h-8 px-2 font-mono text-xs"
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
          <div className="truncate font-mono text-xs text-[color:var(--text-muted)]" title={node.valuePreview}>
            {node.valuePreview}
          </div>
        )}

        <div className="action-cluster-tight justify-end">
          {(node.kind === 'object' || node.kind === 'array') && (
            <>
              <button className="rounded-[6px] px-2 py-1 text-xs text-[color:var(--text-muted)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)]" onClick={() => addChild('string')} title="添加字符串">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button className="rounded-[6px] px-2 py-1 text-xs text-[color:var(--text-muted)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)]" onClick={() => addChild('object')} title="添加对象">
                <Braces className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button className="rounded-[6px] px-2 py-1 text-xs text-[color:var(--text-muted)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)]" onClick={() => onCopy(node.pathText, '路径已复制')} title="复制路径">
            路径
          </button>
          <button className="rounded-[6px] px-2 py-1 text-xs text-[color:var(--text-muted)] hover:bg-[var(--glass-surface-hover)] hover:text-[color:var(--text-primary)]" onClick={() => onCopy(getNodeValueText(rootValue, node.path), '节点值已复制')} title="复制值">
            值
          </button>
          {!isRoot && (
            <button className="rounded-[6px] px-2 py-1 text-xs tone-danger hover:bg-[var(--tone-danger-soft)]" onClick={removeNode} title="删除节点">
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
    ? 'tone-success'
    : status.type === 'error'
      ? 'tone-danger'
      : 'text-[color:var(--text-muted)]'
  const inputBytes = new Blob([input]).size

  return (
    <div className="tool-page">
      <div className="toolbar-surface tab-toolbar">
        <div className="segmented-control segmented-scroll">
          <button className={`segmented-item ${mode === 'strict' ? 'segmented-item-active' : ''}`} onClick={() => handleModeChange('strict')}>
            严格 JSON
          </button>
          <button className={`segmented-item ${mode === 'jsonc' ? 'segmented-item-active' : ''}`} onClick={() => handleModeChange('jsonc')}>
            JSONC
          </button>
        </div>

        <div className="panel-actions">
          <button className="toolbar-button-primary" onClick={() => runAction('format')} title="格式化并回写">
            <AlignLeft className="h-4 w-4" />
            格式化
          </button>
          <button className="toolbar-button" onClick={() => runAction('compress')} title="压缩并回写">
            <Minimize2 className="h-4 w-4" />
            压缩
          </button>
          <button className="toolbar-button" onClick={() => runAction('sort')} title="递归排序并回写">
            <ArrowDownAZ className="h-4 w-4" />
            排序
          </button>
          <button className="toolbar-button" onClick={() => runAction('validate')} title="校验">
            <Check className="h-4 w-4" />
            校验
          </button>
          <button className="toolbar-button" onClick={handlePaste} title="从剪贴板粘贴">
            <Clipboard className="h-4 w-4" />
            粘贴
          </button>
          <button className="toolbar-button disabled:opacity-40" onClick={() => void handleCopy()} disabled={!input} title="复制 JSON">
            <Copy className="h-4 w-4" />
            复制
          </button>
          <button className="toolbar-button" onClick={handleExample} title="填充示例">
            <FileJson className="h-4 w-4" />
            示例
          </button>
          <button className="toolbar-button" onClick={handleClear} title="清空">
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="tool-workspace tool-grid-editor">
        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>文本编辑</span>
            <span className="text-xs text-[color:var(--text-muted)]">{inputBytes} bytes</span>
          </div>
          <div className="panel-body">
            <CodeMirror
              value={input}
              height="100%"
              className="code-editor-light"
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

        <section className="editor-surface tool-panel">
          <div className="panel-header">
            <span>结构编辑</span>
            <div className="action-cluster-tight">
              <button className="icon-button h-7 min-h-7 w-7 min-w-7 disabled:opacity-30" disabled={!parsed.success} onClick={() => parsed.success && setExpanded(collectExpandablePaths(parsed.value))} title="展开全部">
                <ListTree className="h-3.5 w-3.5" />
              </button>
              <button className="icon-button h-7 min-h-7 w-7 min-w-7 disabled:opacity-30" disabled={!parsed.success} onClick={() => setExpanded(new Set(['$']))} title="收起全部">
                <ListCollapse className="h-3.5 w-3.5" />
              </button>
              <button className="toolbar-button min-h-7 px-2 py-1 text-xs disabled:opacity-30" disabled={!parsed.success} onClick={() => collapseToLevel(2)} title="展开前 2 层">
                2层
              </button>
            </div>
          </div>
          <div className="panel-body overflow-auto">
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
              <div className="empty-state flex-col gap-3 text-sm">
                <Braces className="h-9 w-9" />
                <span>{input ? 'JSON 无法解析，修正后可编辑结构树' : '输入 JSON 后显示结构树'}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="status-strip flex flex-wrap items-center gap-3 text-xs">
        <span className={statusClassName}>{status.message}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">模式：{mode === 'jsonc' ? 'JSONC' : '严格 JSON'}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">光标：第 {cursor.line} 行，第 {cursor.column} 列</span>
        {diagnostic && (
          <>
            <span className="text-[color:var(--text-muted)]">|</span>
            <button className="inline-flex items-center gap-1 rounded px-2 py-1 tone-danger hover:bg-[var(--tone-danger-soft)]" onClick={() => focusDiagnostic(diagnostic)}>
              <RotateCcw className="h-3.5 w-3.5" />
              定位错误
            </button>
          </>
        )}
      </div>
    </div>
  )
}
