import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  ArrowLeftRight,
  Columns2,
  Rows3,
  Copy,
  Check,
  FileInput,
  Download,
  RotateCcw,
  AlignLeft,
  CaseSensitive,
  Eraser,
  FileDiff,
  AlertTriangle,
  Maximize2,
  Minimize2
} from 'lucide-react'
import {
  computeDiff,
  extractDiffText,
  readFileAsText,
  DEFAULT_DIFF_OPTIONS,
  type DiffResult,
  type DiffOptions,
  type DiffViewMode,
  type DiffGranularity,
  type DiffLineEntry
} from '../../../utils/diff'

/** 粒度选项配置 */
const GRANULARITY_OPTIONS: { value: DiffGranularity; label: string }[] = [
  { value: 'line', label: '行级' },
  { value: 'word', label: '词级' },
  { value: 'char', label: '字符级' }
]

export function TextDiffPage(): JSX.Element {
  // ========== 输入状态 ==========
  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')

  // ========== 选项状态 ==========
  const [options, setOptions] = useState<DiffOptions>(DEFAULT_DIFF_OPTIONS)
  const [granularity, setGranularity] = useState<DiffGranularity>('line')
  const [viewMode, setViewMode] = useState<DiffViewMode>('split')
  const [compactMode, setCompactMode] = useState(false)

  // ========== 结果状态 ==========
  const [result, setResult] = useState<DiffResult | null>(null)
  const [copied, setCopied] = useState<'diff' | 'patch' | null>(null)
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'warning'; message: string }>({
    type: 'idle',
    message: ''
  })

  // ========== 引用 ==========
  const oldFileRef = useRef<HTMLInputElement>(null)
  const newFileRef = useRef<HTMLInputElement>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ========== 清理 ==========
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    }
  }, [])

  // ========== 辅助函数 ==========
  const showStatus = useCallback(
    (type: 'success' | 'error' | 'warning', message: string) => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
      setStatus({ type, message })
      statusTimerRef.current = setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000)
    },
    []
  )

  // ========== 核心操作 ==========
  /** 执行差异比较 */
  const handleDiff = useCallback(() => {
    if (!oldText && !newText) {
      showStatus('warning', '请输入需要比较的文本')
      return
    }
    if (oldText === newText) {
      setResult({
        entries: oldText.split('\n').map((line, i) => ({
          oldLine: i + 1,
          newLine: i + 1,
          content: line,
          type: 'equal' as const
        })),
        stats: { added: 0, removed: 0, modified: 0, unchanged: oldText.split('\n').length, totalOld: oldText.split('\n').length, totalNew: newText.split('\n').length },
        isLarge: false,
        patch: ''
      })
      showStatus('success', '两段文本完全相同')
      return
    }
    const diffResult = computeDiff(oldText, newText, options, granularity)
    setResult(diffResult)
    const { stats } = diffResult
    showStatus(
      'success',
      `比较完成：${stats.added} 新增、${stats.removed} 删除、${stats.modified} 修改、${stats.unchanged} 未变`
    )
  }, [oldText, newText, options, granularity, showStatus])

  /** 交换左右文本 */
  const handleSwap = useCallback(() => {
    setOldText(newText)
    setNewText(oldText)
    setResult(null)
  }, [oldText, newText])

  /** 清空所有 */
  const handleClear = useCallback(() => {
    setOldText('')
    setNewText('')
    setResult(null)
    setStatus({ type: 'idle', message: '' })
  }, [])

  /** 导入文件 */
  const handleFileImport = useCallback(
    async (side: 'left' | 'right', file: File | null) => {
      if (!file) return
      try {
        const text = await readFileAsText(file)
        if (side === 'left') {
          setOldText(text)
        } else {
          setNewText(text)
        }
        showStatus('success', `已导入文件：${file.name}`)
      } catch {
        showStatus('error', '文件读取失败')
      }
    },
    [showStatus]
  )

  /** 复制差异文本 */
  const handleCopy = useCallback(
    async (type: 'diff' | 'patch') => {
      if (!result) return
      const text =
        type === 'diff'
          ? extractDiffText(result, 'right')
          : result.patch
      try {
        await navigator.clipboard.writeText(text)
        setCopied(type)
        setTimeout(() => setCopied(null), 2000)
      } catch {
        showStatus('error', '复制失败')
      }
    },
    [result, showStatus]
  )

  /** 导出补丁文件 */
  const handleExportPatch = useCallback(() => {
    if (!result?.patch) return
    const blob = new Blob([result.patch], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'changes.patch'
    a.click()
    URL.revokeObjectURL(url)
    showStatus('success', '补丁文件已导出')
  }, [result, showStatus])

  /** 切换选项 */
  const toggleOption = useCallback(
    (key: keyof DiffOptions) => {
      setOptions((prev) => ({ ...prev, [key]: !prev[key] }))
    },
    []
  )

  // ========== 过滤后的条目（紧凑模式去掉未变行） ==========
  const displayEntries = useMemo(() => {
    if (!result) return []
    if (compactMode) {
      return result.entries.filter((e) => e.type !== 'equal')
    }
    return result.entries
  }, [result, compactMode])

  // ========== 渲染：差异行 ==========
  const renderDiffLine = useCallback(
    (entry: DiffLineEntry, index: number, side: 'left' | 'right') => {
      const lineNum = side === 'left' ? entry.oldLine : entry.newLine
      const isChange = entry.type !== 'equal'

      let bgClass = ''
      let content = entry.content

      if (entry.type === 'added') {
        bgClass = side === 'right' ? 'diff-line-added' : 'diff-line-empty'
        if (side === 'left') content = ''
      } else if (entry.type === 'removed') {
        bgClass = side === 'left' ? 'diff-line-removed' : 'diff-line-empty'
        if (side === 'right') content = ''
      } else if (entry.type === 'modified') {
        bgClass = side === 'left' ? 'diff-line-removed' : 'diff-line-added'
        // 字符级高亮
        if (entry.charDiffs && side === 'right') {
          return (
            <div key={`${side}-${index}`} className={`diff-line ${bgClass}`}>
              <span className="diff-line-num">
                {lineNum > 0 ? lineNum : ''}
              </span>
              <span className="diff-line-content">
                {entry.charDiffs.map((cd: { value: string; type: string }, ci: number) => {
                  if (cd.type === 'equal') return <span key={ci}>{cd.value}</span>
                  if (cd.type === 'added')
                    return (
                      <span key={ci} className="diff-char-added">
                        {cd.value}
                      </span>
                    )
                  return null
                })}
              </span>
            </div>
          )
        }
      }

      return (
        <div key={`${side}-${index}`} className={`diff-line ${bgClass}`}>
          <span className="diff-line-num">
            {lineNum > 0 ? lineNum : ''}
          </span>
          <span className="diff-line-content">
            {isChange && entry.type !== 'modified' && (
              <span className="diff-line-marker">
                {entry.type === 'added' ? '+' : entry.type === 'removed' ? '-' : ' '}
              </span>
            )}
            {content}
          </span>
        </div>
      )
    },
    []
  )

  // ========== 统计摘要 ==========
  const statsSummary = useMemo(() => {
    if (!result) return null
    const { stats } = result
    return [
      { label: '新增', value: stats.added, className: 'diff-stat-added' },
      { label: '删除', value: stats.removed, className: 'diff-stat-removed' },
      { label: '修改', value: stats.modified, className: 'diff-stat-modified' },
      { label: '未变', value: stats.unchanged, className: 'diff-stat-unchanged' }
    ]
  }, [result])

  // ========== 主渲染 ==========
  return (
    <div className="tool-page text-diff-page">
      {/* 工具栏 */}
      <div className="toolbar-surface text-diff-toolbar">
        <div className="text-diff-toolbar-left">
          {/* 视图模式切换 */}
          <div className="segmented-control">
            <button
              className={`segmented-item ${viewMode === 'split' ? 'segmented-item-active' : ''}`}
              onClick={() => setViewMode('split')}
              title="左右视图"
            >
              <Columns2 size={14} />
              <span>左右</span>
            </button>
            <button
              className={`segmented-item ${viewMode === 'unified' ? 'segmented-item-active' : ''}`}
              onClick={() => setViewMode('unified')}
              title="内联视图"
            >
              <Rows3 size={14} />
              <span>内联</span>
            </button>
          </div>

          {/* 粒度选择 */}
          <div className="segmented-control">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`segmented-item ${granularity === opt.value ? 'segmented-item-active' : ''}`}
                onClick={() => setGranularity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 忽略选项 */}
          <div className="text-diff-options">
            <button
              className={`toolbar-button ${options.ignoreWhitespace ? 'toolbar-button-active' : ''}`}
              onClick={() => toggleOption('ignoreWhitespace')}
              title="忽略空白字符差异"
            >
              <AlignLeft size={14} />
              <span>忽略空白</span>
            </button>
            <button
              className={`toolbar-button ${options.ignoreCase ? 'toolbar-button-active' : ''}`}
              onClick={() => toggleOption('ignoreCase')}
              title="忽略大小写"
            >
              <CaseSensitive size={14} />
              <span>忽略大小写</span>
            </button>
            <button
              className={`toolbar-button ${options.ignoreBlankLines ? 'toolbar-button-active' : ''}`}
              onClick={() => toggleOption('ignoreBlankLines')}
              title="忽略空行"
            >
              <Eraser size={14} />
              <span>忽略空行</span>
            </button>
          </div>
        </div>

        <div className="text-diff-toolbar-right">
          {result && (
            <>
              <button
                className={`toolbar-button ${compactMode ? 'toolbar-button-active' : ''}`}
                onClick={() => setCompactMode(!compactMode)}
                title={compactMode ? '显示所有行' : '仅显示差异行'}
              >
                {compactMode ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                <span>{compactMode ? '展开' : '紧凑'}</span>
              </button>
              <button
                className="toolbar-button"
                onClick={() => handleCopy('diff')}
                title="复制差异内容"
              >
                {copied === 'diff' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied === 'diff' ? '已复制' : '复制差异'}</span>
              </button>
              <button
                className="toolbar-button"
                onClick={() => handleCopy('patch')}
                title="复制补丁文本"
              >
                {copied === 'patch' ? <Check size={14} /> : <FileDiff size={14} />}
                <span>{copied === 'patch' ? '已复制' : '补丁'}</span>
              </button>
              {result.patch && (
                <button
                  className="toolbar-button"
                  onClick={handleExportPatch}
                  title="导出 .patch 文件"
                >
                  <Download size={14} />
                  <span>导出补丁</span>
                </button>
              )}
            </>
          )}
          <button className="toolbar-button" onClick={handleClear} title="清空所有">
            <RotateCcw size={14} />
            <span>清空</span>
          </button>
          <button className="toolbar-button-primary" onClick={handleDiff}>
            <FileDiff size={14} />
            <span>比较</span>
          </button>
        </div>
      </div>

      {/* 大文件警告 */}
      {result?.isLarge && (
        <div className="text-diff-large-banner">
          <AlertTriangle size={14} />
          <div>
            <strong>大文件模式</strong>
            <span>文本行数较多，字符级差异高亮已禁用以保证性能</span>
          </div>
        </div>
      )}

      {/* 统计摘要 */}
      {statsSummary && (
        <div className="text-diff-stats">
          {statsSummary.map((s) => (
            <div key={s.label} className={s.className}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      )}

      {/* 主工作区 */}
      {!result ? (
        /* 输入模式：左右两个文本框 */
        <div className="text-diff-input-workspace">
          <section className="editor-surface tool-panel text-diff-input-panel">
            <div className="panel-header">
              <span className="panel-title">原始文本（左侧）</span>
              <div className="text-diff-panel-actions">
                <button
                  className="toolbar-button"
                  onClick={() => oldFileRef.current?.click()}
                  title="导入文件"
                >
                  <FileInput size={14} />
                  <span>导入</span>
                </button>
                <button
                  className="toolbar-button"
                  onClick={handleSwap}
                  title="交换左右文本"
                >
                  <ArrowLeftRight size={14} />
                </button>
              </div>
            </div>
            <textarea
              className="editor-textarea text-diff-textarea"
              value={oldText}
              onChange={(e) => setOldText(e.target.value)}
              placeholder="在此粘贴原始文本..."
              spellCheck={false}
            />
            <input
              ref={oldFileRef}
              type="file"
              hidden
              onChange={(e) => handleFileImport('left', e.target.files?.[0] ?? null)}
            />
          </section>

          <section className="editor-surface tool-panel text-diff-input-panel">
            <div className="panel-header">
              <span className="panel-title">新文本（右侧）</span>
              <div className="text-diff-panel-actions">
                <button
                  className="toolbar-button"
                  onClick={() => newFileRef.current?.click()}
                  title="导入文件"
                >
                  <FileInput size={14} />
                  <span>导入</span>
                </button>
              </div>
            </div>
            <textarea
              className="editor-textarea text-diff-textarea"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="在此粘贴新文本..."
              spellCheck={false}
            />
            <input
              ref={newFileRef}
              type="file"
              hidden
              onChange={(e) => handleFileImport('right', e.target.files?.[0] ?? null)}
            />
          </section>
        </div>
      ) : viewMode === 'split' ? (
        /* 左右视图 */
        <div className="text-diff-split-workspace">
          <section className="editor-surface tool-panel text-diff-result-panel">
            <div className="panel-header">
              <span className="panel-title">原始文本</span>
              <span className="text-diff-line-count">{result.stats.totalOld} 行</span>
            </div>
            <div className="text-diff-scroll">
              {(displayEntries as DiffLineEntry[]).map((entry, i) => renderDiffLine(entry, i, 'left'))}
            </div>
          </section>
          <section className="editor-surface tool-panel text-diff-result-panel">
            <div className="panel-header">
              <span className="panel-title">新文本</span>
              <span className="text-diff-line-count">{result.stats.totalNew} 行</span>
            </div>
            <div className="text-diff-scroll">
              {(displayEntries as DiffLineEntry[]).map((entry, i) => renderDiffLine(entry, i, 'right'))}
            </div>
          </section>
        </div>
      ) : (
        /* 内联视图 */
        <div className="text-diff-unified-workspace">
          <section className="editor-surface tool-panel text-diff-result-panel">
            <div className="panel-header">
              <span className="panel-title">差异视图</span>
              <span className="text-diff-line-count">
                {result.stats.totalOld} → {result.stats.totalNew} 行
              </span>
            </div>
            <div className="text-diff-scroll">
              {(displayEntries as DiffLineEntry[]).map((entry, i) => {
                const lineClass =
                  entry.type === 'added'
                    ? 'diff-line-added'
                    : entry.type === 'removed'
                      ? 'diff-line-removed'
                      : entry.type === 'modified'
                        ? 'diff-line-modified'
                        : ''
                const marker =
                  entry.type === 'added'
                    ? '+'
                    : entry.type === 'removed'
                      ? '-'
                      : entry.type === 'modified'
                        ? '~'
                        : ' '
                return (
                  <div key={i} className={`diff-line ${lineClass}`}>
                    <span className="diff-line-num">
                      {entry.oldLine > 0 ? entry.oldLine : ''}
                    </span>
                    <span className="diff-line-num">
                      {entry.newLine > 0 ? entry.newLine : ''}
                    </span>
                    <span className="diff-line-content">
                      <span className="diff-line-marker">{marker}</span>
                      {entry.content}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {/* 状态栏 */}
      {status.type !== 'idle' && (
        <div className={`text-diff-status text-diff-status-${status.type}`}>
          {status.type === 'error' && <AlertTriangle size={14} />}
          {status.type === 'warning' && <AlertTriangle size={14} />}
          {status.type === 'success' && <Check size={14} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  )
}
