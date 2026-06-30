import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Copy,
  ClipboardPaste,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  Replace,
  BookOpen,
  Lightbulb,
  Layers
} from 'lucide-react'
import {
  compileRegex,
  executeMatch,
  executeReplacePreview,
  explainRegex,
  checkFlavorWarnings,
  isLargeText,
  createDefaultFlags,
  getTemplatesByCategory,
  createTimeoutExecutor,
  REGEX_TEMPLATES,
  type RegexFlavor,
  type RegexFlags,
  type MatchAllResult,
  type ReplacePreviewResult,
  type ExplanationNode,
  type RegexTemplate
} from '../../../utils/regex'

/** 右侧面板标签页 */
type ResultTab = 'matches' | 'groups' | 'replace' | 'explain'

/** 风味选项 */
const FLAVOR_OPTIONS: { value: RegexFlavor; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'pcre', label: 'PCRE' }
]

/** 标志选项 */
const FLAG_OPTIONS: { key: keyof RegexFlags; label: string; char: string }[] = [
  { key: 'global', label: '全局', char: 'g' },
  { key: 'ignoreCase', label: '忽略大小写', char: 'i' },
  { key: 'multiline', label: '多行', char: 'm' },
  { key: 'dotAll', label: '点号匹配换行', char: 's' },
  { key: 'unicode', label: 'Unicode', char: 'u' }
]

export function RegexToolPage(): JSX.Element {
  // ========== 状态 ==========
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<RegexFlags>(createDefaultFlags)
  const [flavor, setFlavor] = useState<RegexFlavor>('javascript')
  const [testText, setTestText] = useState('')
  const [replaceMode, setReplaceMode] = useState(false)
  const [replacement, setReplacement] = useState('')
  const [activeTab, setActiveTab] = useState<ResultTab>('matches')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'warning'; message: string }>({ type: 'idle', message: '' })
  const [largeTextDismissed, setLargeTextDismissed] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const executorRef = useRef(createTimeoutExecutor())
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ========== 清理 ==========
  useEffect(() => {
    const executor = executorRef.current
    const statusTimer = statusTimerRef.current
    return () => {
      executor.terminate()
      if (statusTimer) clearTimeout(statusTimer)
    }
  }, [])

  // ========== 编译正则 ==========
  const compileResult = useMemo(() => compileRegex(pattern, flags), [pattern, flags])

  // ========== 风味警告 ==========
  const flavorWarnings = useMemo(() => {
    if (!pattern) return []
    return checkFlavorWarnings(pattern, flavor)
  }, [pattern, flavor])

  // ========== 匹配结果 ==========

  // 小文本同步匹配（useMemo 避免 effect 中同步 setState）
  const syncMatchResult = useMemo<MatchAllResult>(() => {
    if (!compileResult.success || !compileResult.regex || !testText) {
      return { matches: [], totalCount: 0, elapsed: 0, timedOut: false }
    }
    if (!isLargeText(testText)) {
      return executeMatch(compileResult.regex, testText)
    }
    // 大文本返回空，交给异步处理
    return { matches: [], totalCount: 0, elapsed: 0, timedOut: false }
  }, [compileResult, testText])

  // 大文本异步匹配
  const [asyncMatchResult, setAsyncMatchResult] = useState<MatchAllResult>({
    matches: [],
    totalCount: 0,
    elapsed: 0,
    timedOut: false
  })
  const isMatching = isLargeText(testText) && asyncMatchResult.totalCount === 0 && compileResult.success

  useEffect(() => {
    if (!compileResult.success || !compileResult.regex || !testText || !isLargeText(testText)) {
      return
    }

    const executor = executorRef.current
    const timeoutId = setTimeout(() => {
      executor.execute(compileResult.regex!, testText).then((result) => {
        setAsyncMatchResult(result)
      })
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [compileResult, testText])

  // 合并结果：小文本用同步结果，大文本用异步结果
  const matchResult = isLargeText(testText) ? asyncMatchResult : syncMatchResult

  // ========== 替换预览 ==========
  const replaceResult = useMemo<ReplacePreviewResult>(() => {
    if (!replaceMode || !compileResult.success || !compileResult.regex || !testText) {
      return { items: [], fullText: testText, replacedCount: 0, timedOut: false }
    }
    return executeReplacePreview(compileResult.regex, testText, replacement)
  }, [replaceMode, compileResult, testText, replacement])

  // ========== 正则解释 ==========
  const explanation = useMemo<ExplanationNode[]>(() => explainRegex(pattern), [pattern])

  // ========== 模板列表 ==========
  const templatesByCategory = useMemo(() => getTemplatesByCategory(), [])

  // ========== 大文本警告 ==========
  const showLargeTextWarning = useMemo(() => isLargeText(testText) && !largeTextDismissed, [testText, largeTextDismissed])

  // ========== 工具函数 ==========
  const setStatusMessage = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    setStatus({ type, message })
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    if (type === 'success') {
      statusTimerRef.current = setTimeout(() => setStatus({ type: 'idle', message: '' }), 2600)
    }
  }, [])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await window.electronAPI.clipboard.writeText(text)
      setStatusMessage('success', '已复制到剪贴板')
    } catch {
      setStatusMessage('error', '复制失败')
    }
  }, [setStatusMessage])

  const handlePaste = useCallback(async () => {
    try {
      const text = await window.electronAPI.clipboard.readText()
      if (text) setTestText(text)
    } catch {
      setStatusMessage('error', '粘贴失败')
    }
  }, [setStatusMessage])

  const handleClear = useCallback(() => {
    setPattern('')
    setTestText('')
    setReplacement('')
    setLargeTextDismissed(false)
    setStatus({ type: 'idle', message: '' })
  }, [])

  const handleApplyTemplate = useCallback((tpl: RegexTemplate) => {
    setPattern(tpl.pattern)
    setFlags(createDefaultFlags())
    // 解析模板标志
    for (const ch of tpl.flags) {
      if (ch === 'g') setFlags((f) => ({ ...f, global: true }))
      if (ch === 'i') setFlags((f) => ({ ...f, ignoreCase: true }))
      if (ch === 'm') setFlags((f) => ({ ...f, multiline: true }))
      if (ch === 's') setFlags((f) => ({ ...f, dotAll: true }))
      if (ch === 'u') setFlags((f) => ({ ...f, unicode: true }))
    }
    setTemplatesOpen(false)
    setStatusMessage('success', `已应用模板: ${tpl.name}`)
  }, [setStatusMessage])

  // 同步滚动
  const handleTextareaScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // ========== 渲染：匹配高亮 ==========
  const renderHighlightedText = (): JSX.Element => {
    if (!testText) {
      return <span className="regex-highlight-placeholder">在此输入或粘贴测试文本...</span>
    }
    if (!pattern || !compileResult.success || matchResult.matches.length === 0) {
      return <span>{testText}</span>
    }

    const parts: JSX.Element[] = []
    let lastIndex = 0

    for (let i = 0; i < matchResult.matches.length; i++) {
      const m = matchResult.matches[i]
      // 匹配前的普通文本
      if (m.index > lastIndex) {
        parts.push(<span key={`t-${i}`}>{testText.slice(lastIndex, m.index)}</span>)
      }
      // 高亮匹配
      parts.push(
        <mark key={`m-${i}`} className="regex-match-highlight" data-match-index={i + 1}>
          {m.text}
        </mark>
      )
      lastIndex = m.index + m.length
    }
    // 尾部文本
    if (lastIndex < testText.length) {
      parts.push(<span key="t-end">{testText.slice(lastIndex)}</span>)
    }

    return <>{parts}</>
  }

  // ========== 渲染：替换高亮预览 ==========
  const renderReplacePreview = (): JSX.Element => {
    if (!replaceResult.fullText && replaceResult.replacedCount === 0) {
      return <span className="regex-highlight-placeholder">替换预览将在此显示...</span>
    }

    if (replaceResult.replacedCount === 0) {
      return <span>{testText}</span>
    }

    const parts: JSX.Element[] = []
    let lastIndex = 0

    for (const item of replaceResult.items) {
      if (item.start > lastIndex) {
        parts.push(<span key={`rp-${item.index}`}>{testText.slice(lastIndex, item.start)}</span>)
      }
      parts.push(
        <mark key={`rr-${item.index}`} className="regex-replace-highlight">
          {item.replaced}
        </mark>
      )
      lastIndex = item.end
    }
    if (lastIndex < testText.length) {
      parts.push(<span key="rp-end">{testText.slice(lastIndex)}</span>)
    }

    return <>{parts}</>
  }

  // ========== 渲染：标志切换 ==========
  const renderFlagButtons = (): JSX.Element => {
    return (
      <div className="regex-flag-group">
        {FLAG_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`regex-flag-btn ${flags[opt.key] ? 'regex-flag-active' : ''}`}
            onClick={() => setFlags((f) => ({ ...f, [opt.key]: !f[opt.key] }))}
            title={opt.label}
          >
            {opt.char}
          </button>
        ))}
      </div>
    )
  }

  // ========== 渲染：捕获组面板 ==========
  const renderGroupsPanel = (): JSX.Element => {
    if (matchResult.matches.length === 0) {
      return <div className="regex-empty-hint">暂无捕获组</div>
    }

    const allGroups = matchResult.matches.flatMap((m, mi) =>
      m.groups.map((g) => ({ ...g, matchIndex: mi + 1, matchText: m.text }))
    )

    if (allGroups.length === 0) {
      return <div className="regex-empty-hint">当前匹配中没有捕获组</div>
    }

    return (
      <div className="regex-groups-list">
        {allGroups.map((g, i) => (
          <div key={i} className="regex-group-item">
            <div className="regex-group-header">
              <span className="regex-group-badge">
                {g.name ? (
                  <>
                    <span className="regex-group-named">{g.name}</span>
                    <span className="regex-group-index">#{g.index}</span>
                  </>
                ) : (
                  <span className="regex-group-index">组 #{g.index}</span>
                )}
              </span>
              <span className="regex-group-match">
                匹配 #{g.matchIndex}
              </span>
            </div>
            <div className="regex-group-value">
              <code>{g.value}</code>
              <button
                className="icon-button h-5 w-5"
                onClick={() => handleCopy(g.value)}
                title="复制"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ========== 渲染：解释面板 ==========
  const renderExplanation = (): JSX.Element => {
    if (explanation.length === 0) {
      return <div className="regex-empty-hint">输入正则表达式后将自动解释</div>
    }

    return (
      <div className="regex-explain-list">
        {explanation.map((node, i) => (
          <div key={i} className="regex-explain-item">
            <code className="regex-explain-token">{node.text}</code>
            <span className="regex-explain-desc">{node.description}</span>
            {node.children.length > 0 && (
              <div className="regex-explain-children">
                {node.children.map((child, j) => (
                  <div key={j} className="regex-explain-child">
                    <code className="regex-explain-token">{child.text}</code>
                    <span className="regex-explain-desc">{child.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ========== 渲染：模板面板 ==========
  const renderTemplatesPanel = (): JSX.Element => {
    const categories = Array.from(templatesByCategory.entries())

    return (
      <div className="regex-templates-panel">
        <button
          className="regex-templates-toggle"
          onClick={() => setTemplatesOpen(!templatesOpen)}
        >
          {templatesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <BookOpen className="h-4 w-4" />
          <span>常用正则模板</span>
          <span className="regex-templates-count">{REGEX_TEMPLATES.length}</span>
        </button>
        {templatesOpen && (
          <div className="regex-templates-body">
            {categories.map(([cat, tpls]) => (
              <div key={cat} className="regex-template-category">
                <div className="regex-template-category-title">{cat}</div>
                {tpls.map((tpl) => (
                  <button
                    key={tpl.name}
                    className="regex-template-item"
                    onClick={() => handleApplyTemplate(tpl)}
                    title={tpl.description}
                  >
                    <span className="regex-template-name">{tpl.name}</span>
                    <code className="regex-template-pattern">{tpl.pattern}</code>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ========== 主渲染 ==========
  return (
    <div className="tool-page regex-tool-page">
      {/* 工具栏 */}
      <div className="toolbar-surface regex-toolbar">
        <div className="regex-toolbar-left">
          {/* 风味选择 */}
          <div className="segmented-control segmented-scroll">
            {FLAVOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`segmented-item ${flavor === opt.value ? 'segmented-item-active' : ''}`}
                onClick={() => setFlavor(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 替换模式切换 */}
          <button
            className={`toolbar-button ${replaceMode ? 'toolbar-button-active' : ''}`}
            onClick={() => setReplaceMode(!replaceMode)}
            title="切换替换模式"
          >
            <Replace className="h-4 w-4" />
            <span>替换</span>
          </button>
        </div>

        <div className="regex-toolbar-right">
          {/* 操作按钮 */}
          <button className="toolbar-button" onClick={handlePaste} title="粘贴测试文本">
            <ClipboardPaste className="h-4 w-4" />
          </button>
          <button
            className="toolbar-button"
            onClick={() => handleCopy(matchResult.matches.map((m) => m.text).join('\n'))}
            title="复制所有匹配"
            disabled={matchResult.matches.length === 0}
          >
            <Copy className="h-4 w-4" />
          </button>
          <button className="toolbar-button toolbar-button-danger" onClick={handleClear} title="清空所有">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 大文本警告 */}
      {showLargeTextWarning && (
        <div className="regex-large-banner">
          <AlertTriangle className="h-4 w-4" />
          <span>
            测试文本较大（{testText.length.toLocaleString()} 字符），匹配可能较慢。
            {isMatching && ' 正在匹配中...'}
          </span>
          <button className="regex-banner-dismiss" onClick={() => setLargeTextDismissed(true)}>
            知道了
          </button>
        </div>
      )}

      {/* 超时警告 */}
      {matchResult.timedOut && (
        <div className="regex-timeout-banner">
          <AlertTriangle className="h-4 w-4" />
          <span>匹配超时（{matchResult.elapsed}ms），可能存在灾难性回溯，已中断执行</span>
        </div>
      )}

      {/* 主工作区 */}
      <div className="regex-workspace">
        {/* 左侧面板：模式和输入 */}
        <section className="editor-surface tool-panel regex-input-panel">
          <div className="panel-header">
            <span className="panel-title">正则表达式</span>
            <span className="panel-subtitle">
              {compileResult.success ? (
                <span className="regex-compile-ok">
                  <Check className="h-3 w-3" /> 语法正确
                </span>
              ) : pattern ? (
                <span className="regex-compile-error">{compileResult.error}</span>
              ) : null}
            </span>
          </div>
          <div className="panel-body regex-input-body">
            {/* 模式输入 */}
            <div className="regex-pattern-row">
              <span className="regex-pattern-delimiter">/</span>
              <input
                type="text"
                className="regex-pattern-input"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="输入正则表达式..."
                spellCheck={false}
              />
              <span className="regex-pattern-delimiter">/</span>
              {renderFlagButtons()}
            </div>

            {/* 风味警告 */}
            {flavorWarnings.length > 0 && (
              <div className="regex-flavor-warnings">
                {flavorWarnings.map((w, i) => (
                  <div key={i} className="regex-flavor-warning">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 替换输入 */}
            {replaceMode && (
              <div className="regex-replace-row">
                <span className="regex-replace-label">替换为</span>
                <input
                  type="text"
                  className="regex-replace-input"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  placeholder="替换字符串（支持 $1, $2, $<name>）"
                  spellCheck={false}
                />
              </div>
            )}

            {/* 测试文本 */}
            <div className="regex-textarea-wrapper">
              <div className="regex-textarea-header">
                <span className="panel-title">测试文本</span>
                <div className="regex-textarea-stats">
                  {testText && (
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {testText.length.toLocaleString()} 字符
                    </span>
                  )}
                </div>
              </div>
              <div className="regex-textarea-container">
                <div
                  ref={highlightRef}
                  className="regex-highlight-layer"
                  aria-hidden="true"
                >
                  {replaceMode ? renderReplacePreview() : renderHighlightedText()}
                </div>
                <textarea
                  ref={textareaRef}
                  className="regex-textarea"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  onScroll={handleTextareaScroll}
                  placeholder="在此输入或粘贴测试文本..."
                  spellCheck={false}
                />
              </div>
            </div>

            {/* 模板面板 */}
            {renderTemplatesPanel()}
          </div>
        </section>

        {/* 右侧面板：结果 */}
        <section className="editor-surface tool-panel regex-result-panel">
          <div className="panel-header">
            <div className="regex-result-tabs">
              <button
                className={`regex-result-tab ${activeTab === 'matches' ? 'regex-result-tab-active' : ''}`}
                onClick={() => setActiveTab('matches')}
              >
                <Search className="h-3.5 w-3.5" />
                <span>匹配</span>
                {matchResult.totalCount > 0 && (
                  <span className="regex-result-badge">{matchResult.totalCount}</span>
                )}
              </button>
              <button
                className={`regex-result-tab ${activeTab === 'groups' ? 'regex-result-tab-active' : ''}`}
                onClick={() => setActiveTab('groups')}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>捕获组</span>
              </button>
              {replaceMode && (
                <button
                  className={`regex-result-tab ${activeTab === 'replace' ? 'regex-result-tab-active' : ''}`}
                  onClick={() => setActiveTab('replace')}
                >
                  <Replace className="h-3.5 w-3.5" />
                  <span>替换</span>
                  {replaceResult.replacedCount > 0 && (
                    <span className="regex-result-badge">{replaceResult.replacedCount}</span>
                  )}
                </button>
              )}
              <button
                className={`regex-result-tab ${activeTab === 'explain' ? 'regex-result-tab-active' : ''}`}
                onClick={() => setActiveTab('explain')}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>解释</span>
              </button>
            </div>
            {matchResult.elapsed > 0 && (
              <span className="text-xs text-[color:var(--text-muted)]">
                {matchResult.elapsed}ms
              </span>
            )}
          </div>
          <div className="panel-body regex-result-body">
            {/* 匹配列表 */}
            {activeTab === 'matches' && (
              <div className="regex-matches-list">
                {matchResult.matches.length === 0 ? (
                  <div className="regex-empty-hint">
                    {pattern ? (testText ? '无匹配结果' : '请输入测试文本') : '请输入正则表达式'}
                  </div>
                ) : (
                  matchResult.matches.map((m, i) => (
                    <div key={i} className="regex-match-item">
                      <div className="regex-match-header">
                        <span className="regex-match-index">#{i + 1}</span>
                        <span className="regex-match-position">
                          位置 {m.index}–{m.index + m.length}
                        </span>
                        <span className="regex-match-length">
                          长度 {m.length}
                        </span>
                        <button
                          className="icon-button h-5 w-5"
                          onClick={() => handleCopy(m.text)}
                          title="复制匹配"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="regex-match-text">
                        <code>{m.text}</code>
                      </div>
                      {m.groups.length > 0 && (
                        <div className="regex-match-groups">
                          {m.groups.map((g, j) => (
                            <div key={j} className="regex-match-group">
                              <span className="regex-group-label">
                                {g.name ? `$<${g.name}>` : `$${g.index}`}
                              </span>
                              <code className="regex-group-val">{g.value}</code>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {matchResult.totalCount >= 10000 && (
                  <div className="regex-match-limit-hint">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>已达到匹配上限（10,000 条），结果可能不完整</span>
                  </div>
                )}
              </div>
            )}

            {/* 捕获组 */}
            {activeTab === 'groups' && renderGroupsPanel()}

            {/* 替换预览 */}
            {activeTab === 'replace' && replaceMode && (
              <div className="regex-replace-list">
                {replaceResult.replacedCount === 0 ? (
                  <div className="regex-empty-hint">
                    {pattern && testText ? '无替换结果' : '请输入正则和测试文本'}
                  </div>
                ) : (
                  <>
                    <div className="regex-replace-summary">
                      <span>共替换 {replaceResult.replacedCount} 处</span>
                      {replaceResult.timedOut && (
                        <span className="regex-replace-timeout">（部分替换因超时中断）</span>
                      )}
                    </div>
                    <div className="regex-replace-result-text">
                      <div className="panel-header">
                        <span className="panel-title">替换结果</span>
                        <button
                          className="toolbar-button"
                          onClick={() => handleCopy(replaceResult.fullText)}
                          title="复制替换结果"
                        >
                          <Copy className="h-4 w-4" />
                          <span>复制</span>
                        </button>
                      </div>
                      <pre className="regex-replace-output">{replaceResult.fullText}</pre>
                    </div>
                    <div className="regex-replace-items">
                      {replaceResult.items.map((item) => (
                        <div key={item.index} className="regex-replace-item">
                          <span className="regex-replace-item-index">#{item.index}</span>
                          <code className="regex-replace-item-original">{item.original}</code>
                          <span className="regex-replace-arrow">→</span>
                          <code className="regex-replace-item-replaced">{item.replaced}</code>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 解释 */}
            {activeTab === 'explain' && renderExplanation()}
          </div>
        </section>
      </div>

      {/* 状态栏 */}
      <div className="status-strip regex-status-strip">
        <div className="regex-status-left">
          {compileResult.success ? (
            <span className="tone-success">
              <Check className="h-3 w-3 inline" /> 语法正确
            </span>
          ) : pattern ? (
            <span className="tone-danger">{compileResult.error}</span>
          ) : (
            <span>等待输入</span>
          )}
          {matchResult.totalCount > 0 && (
            <span className="regex-status-count">
              {matchResult.totalCount.toLocaleString()} 个匹配
              {matchResult.elapsed > 0 && ` · ${matchResult.elapsed}ms`}
            </span>
          )}
        </div>
        <div className="regex-status-right">
          {status.type !== 'idle' && (
            <span className={`tone-${status.type === 'success' ? 'success' : status.type === 'error' ? 'danger' : 'warning'}`}>
              {status.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
