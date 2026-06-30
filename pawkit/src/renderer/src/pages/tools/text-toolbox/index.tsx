import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownUp,
  CaseSensitive,
  Clipboard,
  Copy,
  Dice5,
  Eraser,
  FileInput,
  FileOutput,
  Hash,
  ListFilter,
  Plus,
  RefreshCcw,
  Regex,
  Rows3,
  Scissors,
  Shuffle,
  Sparkles,
  TextCursorInput,
  Trash2
} from 'lucide-react'
import {
  addLineAffixes,
  convertFullHalfWidth,
  convertLineEndings,
  convertNaming,
  convertTabsAndSpaces,
  decodeUnicodeEscapes,
  encodeUnicodeEscapes,
  extractTextItems,
  formatTextStats,
  replaceTemplateVariables,
  shuffleLines,
  splitOrJoinBySeparator,
  transformCase,
  transformLines,
  type TemplateVariable
} from '../../../utils/text-toolbox'

type CategoryId = 'case' | 'line' | 'separator' | 'extract' | 'encoding' | 'template'

interface CategoryItem {
  id: CategoryId
  label: string
  icon: LucideIcon
}

interface OperationItem {
  id: string
  category: CategoryId
  label: string
  description: string
  icon: LucideIcon
}

interface TemplateRow extends TemplateVariable {
  id: string
}

const categoryItems: CategoryItem[] = [
  { id: 'case', label: '大小写与命名', icon: CaseSensitive },
  { id: 'line', label: '行处理', icon: Rows3 },
  { id: 'separator', label: '分隔符', icon: Scissors },
  { id: 'extract', label: '提取', icon: Regex },
  { id: 'encoding', label: '编码与空白', icon: ArrowDownUp },
  { id: 'template', label: '模板替换', icon: TextCursorInput }
]

const operationItems: OperationItem[] = [
  { id: 'case-upper', category: 'case', label: '转大写', description: '将字母统一转换为大写', icon: CaseSensitive },
  { id: 'case-lower', category: 'case', label: '转小写', description: '将字母统一转换为小写', icon: CaseSensitive },
  { id: 'case-title', category: 'case', label: '标题大小写', description: '每个单词首字母大写', icon: Sparkles },
  { id: 'case-sentence', category: 'case', label: '句首大写', description: '段首和句号后首字母大写', icon: Sparkles },
  { id: 'name-camel', category: 'case', label: '驼峰命名', description: '转换为 camelCase', icon: Hash },
  { id: 'name-pascal', category: 'case', label: '帕斯卡命名', description: '转换为 PascalCase', icon: Hash },
  { id: 'name-kebab', category: 'case', label: '短横线命名', description: '转换为 kebab-case', icon: Hash },
  { id: 'name-snake', category: 'case', label: '下划线命名', description: '转换为 snake_case', icon: Hash },

  { id: 'line-remove-empty', category: 'line', label: '去空行', description: '移除空白行', icon: ListFilter },
  { id: 'line-trim', category: 'line', label: '去首尾空格', description: '逐行去除首尾空白', icon: Eraser },
  { id: 'line-merge-spaces', category: 'line', label: '合并连续空格', description: '行内连续空格和 Tab 合并为一个空格', icon: Eraser },
  { id: 'line-sort-asc', category: 'line', label: '升序排序', description: '按行内容升序排列', icon: ArrowDownUp },
  { id: 'line-sort-desc', category: 'line', label: '降序排序', description: '按行内容降序排列', icon: ArrowDownUp },
  { id: 'line-unique', category: 'line', label: '行去重', description: '保留首次出现的行', icon: ListFilter },
  { id: 'line-reverse', category: 'line', label: '行反转', description: '反转所有行顺序', icon: RefreshCcw },
  { id: 'line-number', category: 'line', label: '添加行号', description: '按 1 开始添加行号', icon: Hash },
  { id: 'line-affix', category: 'line', label: '前缀后缀', description: '为每一行添加固定前缀和后缀', icon: FileInput },
  { id: 'line-shuffle', category: 'line', label: '随机打乱', description: '随机打乱行顺序', icon: Shuffle },

  { id: 'separator-split', category: 'separator', label: '按分隔符拆分', description: '把分隔符切分结果输出为多行', icon: Scissors },
  { id: 'separator-join', category: 'separator', label: '按分隔符合并', description: '把多行文本合并为分隔符文本', icon: FileOutput },

  { id: 'extract-url', category: 'extract', label: '提取 URL', description: '提取 http 和 https 链接', icon: Regex },
  { id: 'extract-email', category: 'extract', label: '提取邮箱', description: '提取常见邮箱地址', icon: Regex },
  { id: 'extract-phone', category: 'extract', label: '提取手机号', description: '提取中国大陆手机号', icon: Regex },
  { id: 'extract-ip', category: 'extract', label: '提取 IP', description: '提取 IPv4 和 IPv6 地址', icon: Regex },

  { id: 'unicode-encode', category: 'encoding', label: 'Unicode 编码', description: '转为 Unicode 转义文本', icon: ArrowDownUp },
  { id: 'unicode-decode', category: 'encoding', label: 'Unicode 解码', description: '解码 Unicode 转义文本', icon: ArrowDownUp },
  { id: 'width-half', category: 'encoding', label: '全角转半角', description: '转换 ASCII 全角字符和空格', icon: CaseSensitive },
  { id: 'width-full', category: 'encoding', label: '半角转全角', description: '转换 ASCII 半角字符和空格', icon: CaseSensitive },
  { id: 'ending-lf', category: 'encoding', label: '换行 LF', description: '转换为 Unix 换行', icon: Rows3 },
  { id: 'ending-crlf', category: 'encoding', label: '换行 CRLF', description: '转换为 Windows 换行', icon: Rows3 },
  { id: 'ending-cr', category: 'encoding', label: '换行 CR', description: '转换为经典 Mac 换行', icon: Rows3 },
  { id: 'tab-to-space', category: 'encoding', label: 'Tab 转空格', description: '按指定宽度展开 Tab', icon: ArrowDownUp },
  { id: 'space-to-tab', category: 'encoding', label: '空格转 Tab', description: '按指定宽度压缩空格', icon: ArrowDownUp },

  { id: 'template-replace', category: 'template', label: '模板替换', description: '使用键值表替换双大括号占位符', icon: TextCursorInput }
]

let templateRowSeed = 0

function createTemplateRow(key = '', value = ''): TemplateRow {
  templateRowSeed += 1
  return { id: `template-row-${templateRowSeed}`, key, value }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function findOperation(operationId: string): OperationItem {
  return operationItems.find((item) => item.id === operationId) ?? operationItems[0]
}

function getFirstOperationId(categoryId: CategoryId): string {
  return operationItems.find((item) => item.category === categoryId)?.id ?? operationItems[0].id
}

function getExample(operationId: string): string {
  if (operationId.startsWith('extract')) {
    return '访问 https://pawkit.dev，联系 hi@pawkit.dev 或 +86 138-0013-8000，服务器 192.168.1.1 与 2001:db8::1'
  }
  if (operationId.startsWith('separator')) return 'alpha,beta,,gamma'
  if (operationId.startsWith('unicode')) return operationId === 'unicode-decode' ? '\\u0050\\u0061\\u0077\\u004b\\u0069\\u0074 \\u6587\\u672c' : 'PawKit 文本'
  if (operationId.startsWith('width')) return operationId === 'width-half' ? 'ＰａｗＫｉｔ　１２３，文本！' : 'PawKit 123,文本!'
  if (operationId.startsWith('ending') || operationId.includes('tab')) return 'alpha\tbeta\n  gamma    delta'
  if (operationId.startsWith('template')) return '你好 {{name}}，今天是 {{day}}，任务：{{task}}。'
  if (operationId.startsWith('line')) return '  beta  \n\nalpha\nbeta\n  alpha  '
  return 'user_name demoText-工具'
}

function getOutput(
  text: string,
  operationId: string,
  options: {
    prefix: string
    suffix: string
    separator: string
    spaceSize: number
    templateRows: TemplateRow[]
  }
): string {
  switch (operationId) {
    case 'case-upper':
      return transformCase(text, 'upper')
    case 'case-lower':
      return transformCase(text, 'lower')
    case 'case-title':
      return transformCase(text, 'title')
    case 'case-sentence':
      return transformCase(text, 'sentence')
    case 'name-camel':
      return convertNaming(text, 'camel')
    case 'name-pascal':
      return convertNaming(text, 'pascal')
    case 'name-kebab':
      return convertNaming(text, 'kebab')
    case 'name-snake':
      return convertNaming(text, 'snake')
    case 'line-remove-empty':
      return transformLines(text, 'remove-empty')
    case 'line-trim':
      return transformLines(text, 'trim')
    case 'line-merge-spaces':
      return transformLines(text, 'merge-spaces')
    case 'line-sort-asc':
      return transformLines(text, 'sort-asc')
    case 'line-sort-desc':
      return transformLines(text, 'sort-desc')
    case 'line-unique':
      return transformLines(text, 'unique')
    case 'line-reverse':
      return transformLines(text, 'reverse')
    case 'line-number':
      return transformLines(text, 'number')
    case 'line-affix':
      return addLineAffixes(text, options.prefix, options.suffix)
    case 'line-shuffle':
      return shuffleLines(text)
    case 'separator-split':
      return splitOrJoinBySeparator(text, options.separator, 'split')
    case 'separator-join':
      return splitOrJoinBySeparator(text, options.separator, 'join')
    case 'extract-url':
      return extractTextItems(text, 'url').join('\n')
    case 'extract-email':
      return extractTextItems(text, 'email').join('\n')
    case 'extract-phone':
      return extractTextItems(text, 'phone-cn').join('\n')
    case 'extract-ip':
      return extractTextItems(text, 'ip').join('\n')
    case 'unicode-encode':
      return encodeUnicodeEscapes(text)
    case 'unicode-decode':
      return decodeUnicodeEscapes(text)
    case 'width-half':
      return convertFullHalfWidth(text, 'half')
    case 'width-full':
      return convertFullHalfWidth(text, 'full')
    case 'ending-lf':
      return convertLineEndings(text, 'lf')
    case 'ending-crlf':
      return convertLineEndings(text, 'crlf')
    case 'ending-cr':
      return convertLineEndings(text, 'cr')
    case 'tab-to-space':
      return convertTabsAndSpaces(text, 'tab-to-space', options.spaceSize)
    case 'space-to-tab':
      return convertTabsAndSpaces(text, 'space-to-tab', options.spaceSize)
    case 'template-replace':
      return replaceTemplateVariables(text, options.templateRows)
    default:
      return text
  }
}

export function TextToolboxPage(): JSX.Element {
  const [input, setInput] = useState('')
  const [activeOperationId, setActiveOperationId] = useState('case-upper')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [separator, setSeparator] = useState(',')
  const [spaceSize, setSpaceSize] = useState(2)
  const [message, setMessage] = useState('等待输入')
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>(() => [
    createTemplateRow('name', '噗噗'),
    createTemplateRow('day', '周二'),
    createTemplateRow('task', '整理文本')
  ])

  const activeOperation = findOperation(activeOperationId)
  const activeCategoryId = activeOperation.category
  const visibleOperations = operationItems.filter((item) => item.category === activeCategoryId)
  const inputStats = useMemo(() => formatTextStats(input), [input])
  const outputText = useMemo(() => getOutput(input, activeOperationId, {
    prefix,
    suffix,
    separator,
    spaceSize,
    templateRows
  }), [activeOperationId, input, prefix, separator, spaceSize, suffix, templateRows])
  const outputStats = useMemo(() => formatTextStats(outputText), [outputText])

  const setActiveCategory = (categoryId: CategoryId): void => {
    setActiveOperationId(getFirstOperationId(categoryId))
  }

  const pasteInput = async (): Promise<void> => {
    try {
      const text = await window.electronAPI.clipboard.readText()
      setInput(text)
      setMessage(text ? '已从剪贴板粘贴' : '剪贴板没有文本')
    } catch {
      setMessage('读取剪贴板失败')
    }
  }

  const copyOutput = async (): Promise<void> => {
    if (!outputText) return
    try {
      await window.electronAPI.clipboard.writeText(outputText)
      setMessage('输出已复制')
    } catch {
      setMessage('复制失败')
    }
  }

  const applyOutput = (): void => {
    setInput(outputText)
    setMessage('输出已应用到输入')
  }

  const clearAll = (): void => {
    setInput('')
    setMessage('已清空')
  }

  const fillExample = (): void => {
    setInput(getExample(activeOperationId))
    if (activeOperationId === 'line-affix') {
      setPrefix('- ')
      setSuffix('')
    }
    if (activeOperationId === 'template-replace') {
      setTemplateRows([
        createTemplateRow('name', '噗噗'),
        createTemplateRow('day', '周二'),
        createTemplateRow('task', '文本处理')
      ])
    }
    setMessage('已填充示例')
  }

  const updateTemplateRow = (rowId: string, field: 'key' | 'value', value: string): void => {
    setTemplateRows((rows) => rows.map((row) => row.id === rowId ? { ...row, [field]: value } : row))
  }

  const removeTemplateRow = (rowId: string): void => {
    setTemplateRows((rows) => rows.filter((row) => row.id !== rowId))
  }

  return (
    <div className="tool-page text-toolbox-page">
      <div className="toolbar-surface text-toolbox-toolbar">
        <div className="segmented-control segmented-scroll">
          {categoryItems.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                className={`segmented-item ${activeCategoryId === category.id ? 'segmented-item-active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
                title={category.label}
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </button>
            )
          })}
        </div>

        <div className="panel-actions">
          <button className="toolbar-button" onClick={pasteInput} title="从剪贴板粘贴">
            <Clipboard className="h-4 w-4" />
            粘贴
          </button>
          <button className="toolbar-button" onClick={fillExample} title="填充示例">
            <Dice5 className="h-4 w-4" />
            示例
          </button>
          <button className="toolbar-button" onClick={applyOutput} disabled={!outputText} title="将输出应用到输入">
            <FileInput className="h-4 w-4" />
            应用
          </button>
          <button className="toolbar-button" onClick={clearAll} title="清空输入">
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="text-toolbox-workbench">
        <aside className="editor-surface tool-panel text-toolbox-side-panel">
          <div className="panel-header">
            <span>操作</span>
            <span className="text-xs text-[color:var(--text-muted)]">{visibleOperations.length} 项</span>
          </div>

          <div className="text-toolbox-operation-list">
            {visibleOperations.map((operation) => {
              const Icon = operation.icon
              return (
                <button
                  key={operation.id}
                  className={`text-toolbox-operation ${activeOperationId === operation.id ? 'text-toolbox-operation-active' : ''}`}
                  onClick={() => setActiveOperationId(operation.id)}
                >
                  <span className="text-toolbox-operation-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-toolbox-operation-title">{operation.label}</span>
                    <span className="text-toolbox-operation-desc">{operation.description}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-toolbox-params">
            {activeOperationId === 'line-affix' && (
              <>
                <label className="text-toolbox-field">
                  前缀
                  <input value={prefix} onChange={(event) => setPrefix(event.target.value)} className="field-input" placeholder="例如 > " />
                </label>
                <label className="text-toolbox-field">
                  后缀
                  <input value={suffix} onChange={(event) => setSuffix(event.target.value)} className="field-input" placeholder="例如 ;" />
                </label>
              </>
            )}

            {activeCategoryId === 'separator' && (
              <label className="text-toolbox-field">
                分隔符
                <input value={separator} onChange={(event) => setSeparator(event.target.value)} className="field-input" placeholder="支持 \\n、\\r\\n、\\t" />
              </label>
            )}

            {(activeOperationId === 'tab-to-space' || activeOperationId === 'space-to-tab') && (
              <label className="text-toolbox-field">
                空格宽度
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={1}
                  value={spaceSize}
                  onChange={(event) => setSpaceSize(Number(event.target.value))}
                  className="field-input"
                />
              </label>
            )}

            {activeOperationId === 'template-replace' && (
              <div className="text-toolbox-template-panel">
                <div className="text-toolbox-param-heading">
                  <span>变量表</span>
                  <button className="icon-button h-7 w-7" onClick={() => setTemplateRows((rows) => [...rows, createTemplateRow()])} title="添加变量">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-toolbox-template-list">
                  {templateRows.map((row) => (
                    <div key={row.id} className="text-toolbox-template-row">
                      <input value={row.key} onChange={(event) => updateTemplateRow(row.id, 'key', event.target.value)} className="field-input" placeholder="变量名" />
                      <input value={row.value} onChange={(event) => updateTemplateRow(row.id, 'value', event.target.value)} className="field-input" placeholder="替换值" />
                      <button className="icon-button h-8 w-8" onClick={() => removeTemplateRow(row.id)} title="删除变量">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-toolbox-stat-grid">
            <StatCard label="输入字符" value={inputStats.characters.toLocaleString()} />
            <StatCard label="输入单词" value={inputStats.words.toLocaleString()} />
            <StatCard label="输入行数" value={inputStats.lines.toLocaleString()} />
            <StatCard label="输入大小" value={formatBytes(inputStats.bytes)} />
          </div>
        </aside>

        <section className="editor-surface tool-panel text-toolbox-editor-panel">
          <div className="panel-header">
            <span>输入</span>
            <span className="text-xs text-[color:var(--text-muted)]">{inputStats.characters.toLocaleString()} 字符</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="在此输入或粘贴需要处理的文本"
            className="editor-textarea text-toolbox-textarea"
            spellCheck={false}
          />
        </section>

        <section className="editor-surface tool-panel text-toolbox-editor-panel">
          <div className="panel-header">
            <div className="min-w-0">
              <span>输出</span>
              <span className="ml-2 text-xs text-[color:var(--text-muted)]">{activeOperation.label}</span>
            </div>
            <button className="toolbar-button min-h-7 px-2 py-1 text-xs" onClick={copyOutput} disabled={!outputText} title="复制输出">
              <Copy className="h-3.5 w-3.5" />
              复制
            </button>
          </div>
          <textarea
            value={outputText}
            readOnly
            placeholder="处理结果将显示在这里"
            className="editor-textarea text-toolbox-textarea"
            spellCheck={false}
          />
        </section>
      </div>

      <div className="status-strip text-toolbox-status-strip">
        <span className="text-[color:var(--text-secondary)]">{activeOperation.description}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span>输出 {outputStats.characters.toLocaleString()} 字符 · {outputStats.words.toLocaleString()} 词 · {outputStats.lines.toLocaleString()} 行 · {formatBytes(outputStats.bytes)}</span>
        <span className="text-[color:var(--text-muted)]">|</span>
        <span className="text-[color:var(--text-secondary)]">{message}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="text-toolbox-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
