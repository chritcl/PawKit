import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  FileUp,
  Globe2,
  History,
  Image,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCcw,
  Save,
  SendHorizontal,
  Shield,
  Star,
  StopCircle,
  Trash2,
  X
} from 'lucide-react'
import type {
  HttpApiBodyMode,
  HttpApiCookieItem,
  HttpApiCookieJar,
  HttpApiEnvironment,
  HttpApiFavoriteItem,
  HttpApiFormDataItem,
  HttpApiHistoryItem,
  HttpApiKeyValueItem,
  HttpApiMethod,
  HttpApiRequestDraft,
  HttpApiResponse,
  HttpApiResponsePreviewKind,
  HttpApiSendResult
} from '../../../../../shared/types'
import {
  HTTP_API_HISTORY_BODY_LIMIT,
  HTTP_API_FILE_LIMIT_BYTES,
  applyEnvironmentToRequest,
  cloneRequestForSave,
  createDefaultHttpApiDraft,
  createFormDataItem,
  createHttpApiHistoryItem,
  createHttpApiId,
  createKeyValueItem,
  exportRequestToCurl,
  generateRequestCode,
  getHttpApiMissingFileMessage,
  importCurlToRequest,
  parseSetCookieHeaders,
  sanitizeHttpApiRequestForStorage,
  trimHttpApiHistory
} from '../../../utils/http-api'
import { JsonTreeNode, buildJsonTree, parseJsonInput } from '../../../utils/json'

type LeftTab = 'history' | 'favorites' | 'environment' | 'cookies'
type RequestTab = 'query' | 'headers' | 'auth' | 'cookies' | 'body' | 'options'
type ResponseTab = 'body' | 'headers' | 'redirects' | 'code'
type CodeTarget = 'fetch' | 'axios' | 'java' | 'python'
type JsonPreviewMode = 'fields' | 'source'

interface StatusState {
  type: 'idle' | 'success' | 'error' | 'warning'
  message: string
}

const methods: HttpApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const bodyModes: HttpApiBodyMode[] = ['none', 'json', 'form-data', 'urlencoded', 'text', 'file']
const codeTargets: CodeTarget[] = ['fetch', 'axios', 'java', 'python']
const responseTabs: ResponseTab[] = ['body', 'headers', 'redirects', 'code']
const JSON_TEXT_COLLAPSE_LIMIT = 160

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
  '.cm-gutters': {
    backgroundColor: 'var(--glass-muted)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--glass-border)'
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getStatusTone(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'tone-success'
  if (statusCode >= 300 && statusCode < 400) return 'tone-info'
  if (statusCode >= 400) return 'tone-danger'
  return 'text-[color:var(--text-muted)]'
}

function getBodyModeLabel(mode: HttpApiBodyMode): string {
  const labels: Record<HttpApiBodyMode, string> = {
    none: '无',
    json: 'JSON',
    'form-data': 'Form Data',
    urlencoded: 'URL Encoded',
    text: '文本',
    file: '文件'
  }
  return labels[mode]
}

function getResponseTabLabel(tab: ResponseTab): string {
  const labels: Record<ResponseTab, string> = {
    body: '预览',
    headers: 'Headers',
    redirects: '重定向',
    code: '代码'
  }
  return labels[tab]
}

function getPreviewLabel(kind: HttpApiResponsePreviewKind): string {
  const labels: Record<HttpApiResponsePreviewKind, string> = {
    json: 'JSON',
    html: 'HTML',
    text: '文本',
    image: '图片',
    binary: '二进制'
  }
  return labels[kind]
}

function formatResponseTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function getResultStatusLabel(status: HttpApiSendResult['status'] | 'error' | null): string {
  const labels: Record<HttpApiSendResult['status'] | 'error', string> = {
    completed: '已完成',
    cancelled: '已取消',
    timeout: '已超时',
    error: '失败'
  }
  return status ? labels[status] : '-'
}

function hasLongJsonText(value: unknown): boolean {
  if (typeof value === 'string') return value.length > JSON_TEXT_COLLAPSE_LIMIT
  if (Array.isArray(value)) return value.some((item) => hasLongJsonText(item))
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some((item) => hasLongJsonText(item))
  return false
}

function collapseLongJsonText(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= JSON_TEXT_COLLAPSE_LIMIT) return value
    return `${value.slice(0, JSON_TEXT_COLLAPSE_LIMIT)}...（已折叠 ${value.length - JSON_TEXT_COLLAPSE_LIMIT} 字符）`
  }
  if (Array.isArray(value)) return value.map((item) => collapseLongJsonText(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, collapseLongJsonText(item)]))
  }
  return value
}

function createEnvironment(): HttpApiEnvironment {
  const now = new Date().toISOString()
  return {
    id: createHttpApiId('env'),
    name: '新环境',
    variables: [createKeyValueItem('baseUrl', 'https://api.example.com')],
    createdAt: now,
    updatedAt: now
  }
}

function createCookieJar(cookies: HttpApiKeyValueItem[]): HttpApiCookieJar {
  const now = new Date().toISOString()
  return {
    id: createHttpApiId('cookie'),
    name: 'Cookie 组',
    cookies: cookies.map((item) => ({ ...item })),
    createdAt: now,
    updatedAt: now
  }
}

function mergeCookies(current: HttpApiCookieItem[], incoming: HttpApiCookieItem[]): HttpApiCookieItem[] {
  const next = [...current]
  incoming.forEach((cookie) => {
    const index = next.findIndex((item) => (
      item.key === cookie.key &&
      (item.domain ?? '') === (cookie.domain ?? '') &&
      (item.path ?? '') === (cookie.path ?? '')
    ))
    if (index >= 0) {
      next[index] = { ...next[index], ...cookie, id: next[index].id }
      return
    }
    next.push(cookie)
  })
  return next
}

function getJsonTreeDisplayValue(node: JsonTreeNode, expanded: boolean): string {
  if (node.kind !== 'string') return node.valuePreview
  if (expanded || node.editableValue.length <= JSON_TEXT_COLLAPSE_LIMIT) return JSON.stringify(node.editableValue)
  return `${JSON.stringify(node.editableValue.slice(0, JSON_TEXT_COLLAPSE_LIMIT))}...（${node.editableValue.length - JSON_TEXT_COLLAPSE_LIMIT} 字符）`
}

function JsonTreeView({
  node,
  showFullValues,
  onCopy
}: {
  node: JsonTreeNode
  showFullValues: boolean
  onCopy: (node: JsonTreeNode) => void
}): JSX.Element {
  const [open, setOpen] = useState(node.depth < 2)
  const [valueExpanded, setValueExpanded] = useState(false)
  const expandable = node.expandable && node.children.length > 0
  const canToggleValue = !showFullValues && node.kind === 'string' && node.editableValue.length > JSON_TEXT_COLLAPSE_LIMIT
  const displayFullValue = showFullValues || valueExpanded
  const displayValue = getJsonTreeDisplayValue(node, displayFullValue)

  return (
    <div>
      <div className="http-json-tree-row" style={{ paddingLeft: 8 + node.depth * 14 }}>
        <button disabled={!expandable} onClick={() => setOpen((value) => !value)} title={open ? '收起' : '展开'}>
          {expandable ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : null}
        </button>
        <code title={node.pathText}>{node.depth === 0 ? '$' : node.key}</code>
        <span>{node.kind}</span>
        <strong title={displayFullValue ? displayValue : node.valuePreview}>{displayValue}</strong>
        <div className="http-json-row-actions">
          {canToggleValue && (
            <button className="icon-button" onClick={() => setValueExpanded((value) => !value)} title={displayFullValue ? '折叠此字段' : '显示此字段全部'}>
              {displayFullValue ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button className="icon-button" onClick={() => onCopy(node)} title="复制此值">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expandable && open && node.children.map((child) => <JsonTreeView key={child.id} node={child} showFullValues={showFullValues} onCopy={onCopy} />)}
    </div>
  )
}

function KeyValueEditor({
  items,
  onChange,
  valuePlaceholder = '值'
}: {
  items: HttpApiKeyValueItem[]
  onChange: (items: HttpApiKeyValueItem[]) => void
  valuePlaceholder?: string
}): JSX.Element {
  const updateItem = (id: string, patch: Partial<HttpApiKeyValueItem>): void => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removeItem = (id: string): void => {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="http-kv-editor">
      {items.map((item) => (
        <div key={item.id} className="http-kv-row">
          <input className="field-checkbox" type="checkbox" checked={item.enabled} onChange={(event) => updateItem(item.id, { enabled: event.target.checked })} title="启用" />
          <input className="field-input" value={item.key} onChange={(event) => updateItem(item.id, { key: event.target.value })} placeholder="名称" />
          <input className="field-input" value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} placeholder={valuePlaceholder} />
          <button className="icon-button icon-button-danger" onClick={() => removeItem(item.id)} title="删除"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button className="toolbar-button" onClick={() => onChange([...items, createKeyValueItem()])}><Plus className="h-4 w-4" />新增</button>
    </div>
  )
}

function CookieEditor({
  items,
  onChange
}: {
  items: HttpApiCookieItem[]
  onChange: (items: HttpApiCookieItem[]) => void
}): JSX.Element {
  const updateItem = (id: string, patch: Partial<HttpApiCookieItem>): void => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removeItem = (id: string): void => {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="http-kv-editor">
      {items.map((item) => (
        <div key={item.id} className="http-cookie-row">
          <input className="field-checkbox" type="checkbox" checked={item.enabled} onChange={(event) => updateItem(item.id, { enabled: event.target.checked })} title="启用" />
          <input className="field-input" value={item.key} onChange={(event) => updateItem(item.id, { key: event.target.value })} placeholder="名称" />
          <input className="field-input" value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} placeholder="值" />
          <input className="field-input" value={item.domain ?? ''} onChange={(event) => updateItem(item.id, { domain: event.target.value || undefined })} placeholder="Domain" />
          <input className="field-input" value={item.path ?? ''} onChange={(event) => updateItem(item.id, { path: event.target.value || undefined })} placeholder="Path" />
          <button className="icon-button icon-button-danger" onClick={() => removeItem(item.id)} title="删除"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button className="toolbar-button" onClick={() => onChange([...items, { ...createKeyValueItem(), id: createHttpApiId('cookie') }])}><Plus className="h-4 w-4" />新增</button>
    </div>
  )
}

function FormDataEditor({
  items,
  onChange,
  onStatus
}: {
  items: HttpApiFormDataItem[]
  onChange: (items: HttpApiFormDataItem[]) => void
  onStatus: (status: StatusState) => void
}): JSX.Element {
  const updateItem = (id: string, patch: Partial<HttpApiFormDataItem>): void => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const selectFile = async (id: string, file: File | null): Promise<void> => {
    if (!file) return
    if (file.size > HTTP_API_FILE_LIMIT_BYTES) {
      onStatus({ type: 'error', message: '文件超过 25 MB 限制' })
      return
    }
    updateItem(id, {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileBytes: await file.arrayBuffer(),
      needsReselect: false
    })
  }

  return (
    <div className="http-kv-editor">
      {items.map((item) => (
        <div key={item.id} className="http-form-row">
          <input className="field-checkbox" type="checkbox" checked={item.enabled} onChange={(event) => updateItem(item.id, { enabled: event.target.checked })} title="启用" />
          <input className="field-input" value={item.key} onChange={(event) => updateItem(item.id, { key: event.target.value })} placeholder="名称" />
          <select className="field-select" value={item.type} onChange={(event) => updateItem(item.id, { type: event.target.value as 'text' | 'file' })}>
            <option value="text">文本</option>
            <option value="file">文件</option>
          </select>
          {item.type === 'file' ? (
            <label className="toolbar-button http-file-picker">
              <FileUp className="h-4 w-4" />
              <span>{item.needsReselect ? `${item.fileName || '文件'}（需重选）` : item.fileName || '选择文件'}</span>
              <input type="file" onChange={(event) => void selectFile(item.id, event.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <input className="field-input" value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} placeholder="值" />
          )}
          <button className="icon-button icon-button-danger" onClick={() => onChange(items.filter((next) => next.id !== item.id))} title="删除"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button className="toolbar-button" onClick={() => onChange([...items, createFormDataItem()])}><Plus className="h-4 w-4" />新增</button>
    </div>
  )
}

export function HttpApiToolPage(): JSX.Element {
  const [request, setRequest] = useState<HttpApiRequestDraft>(() => createDefaultHttpApiDraft())
  const [history, setHistory] = useState<HttpApiHistoryItem[]>([])
  const [favorites, setFavorites] = useState<HttpApiFavoriteItem[]>([])
  const [environments, setEnvironments] = useState<HttpApiEnvironment[]>([])
  const [cookieJars, setCookieJars] = useState<HttpApiCookieJar[]>([])
  const [leftTab, setLeftTab] = useState<LeftTab>('history')
  const [requestTab, setRequestTab] = useState<RequestTab>('query')
  const [responseTab, setResponseTab] = useState<ResponseTab>('body')
  const [codeTarget, setCodeTarget] = useState<CodeTarget>('fetch')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [mobileResourceOpen, setMobileResourceOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'request' | 'response'>('request')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [response, setResponse] = useState<HttpApiResponse | null>(null)
  const [lastResult, setLastResult] = useState<HttpApiSendResult | null>(null)
  const [sending, setSending] = useState(false)
  const [showFullJson, setShowFullJson] = useState(false)
  const [jsonPreviewMode, setJsonPreviewMode] = useState<JsonPreviewMode>('fields')
  const [curlImportOpen, setCurlImportOpen] = useState(false)
  const [curlImportText, setCurlImportText] = useState('')
  const [status, setStatus] = useState<StatusState>({ type: 'idle', message: '就绪' })
  const activeRequestIdRef = useRef<string | null>(null)

  const activeEnvironment = useMemo(
    () => environments.find((item) => item.id === request.environmentId) ?? null,
    [environments, request.environmentId]
  )
  const resolvedRequest = useMemo(() => applyEnvironmentToRequest(request, activeEnvironment), [activeEnvironment, request])
  const generatedCode = useMemo(() => {
    try {
      return generateRequestCode(resolvedRequest, codeTarget)
    } catch (error) {
      return error instanceof Error ? error.message : '代码生成失败'
    }
  }, [codeTarget, resolvedRequest])
  const curlImportResult = useMemo(() => {
    if (!curlImportText.trim()) return null
    return importCurlToRequest(curlImportText)
  }, [curlImportText])
  const selectedHistoryItem = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId]
  )
  const activeResponse = selectedHistoryItem ? selectedHistoryItem.response : response
  const activeResultMessage = selectedHistoryItem?.message ?? lastResult?.message ?? ''
  const activeResultStatus = selectedHistoryItem
    ? selectedHistoryItem.success
      ? 'completed'
      : 'error'
    : lastResult?.status ?? null
  const responseCookies = useMemo(() => activeResponse ? parseSetCookieHeaders(activeResponse.headers) : [], [activeResponse])
  const parsedJsonValue = useMemo<unknown | undefined>(() => {
    if (!activeResponse || activeResponse.previewKind !== 'json' || !activeResponse.bodyText) return undefined
    const parsed = parseJsonInput(activeResponse.bodyText, 'jsonc')
    return parsed.success ? parsed.value : undefined
  }, [activeResponse])
  const formattedJsonText = useMemo(() => {
    if (!activeResponse || activeResponse.previewKind !== 'json' || !activeResponse.bodyText) return ''
    return parsedJsonValue !== undefined ? JSON.stringify(parsedJsonValue, null, 2) : activeResponse.bodyText
  }, [activeResponse, parsedJsonValue])
  const hasCollapsedJsonText = useMemo(() => parsedJsonValue !== undefined && hasLongJsonText(parsedJsonValue), [parsedJsonValue])
  const previewJsonText = useMemo(() => {
    if (!hasCollapsedJsonText || showFullJson || parsedJsonValue === undefined) return formattedJsonText
    return JSON.stringify(collapseLongJsonText(parsedJsonValue), null, 2)
  }, [formattedJsonText, hasCollapsedJsonText, parsedJsonValue, showFullJson])

  const jsonTree = useMemo(() => {
    if (!activeResponse || activeResponse.previewKind !== 'json' || !activeResponse.bodyText || parsedJsonValue === undefined) return null
    return buildJsonTree(parsedJsonValue)
  }, [activeResponse, parsedJsonValue])
  const responseViewKey = useMemo(() => {
    if (!activeResponse) return selectedHistoryId ? `history-empty:${selectedHistoryId}` : 'empty'
    return [
      selectedHistoryId ?? 'live',
      activeResponse.completedAt,
      activeResponse.url,
      activeResponse.statusCode,
      activeResponse.sizeBytes,
      activeResponse.bodyText.length
    ].join(':')
  }, [activeResponse, selectedHistoryId])

  useEffect(() => {
    window.electronAPI?.setting?.get<HttpApiHistoryItem[]>('httpApi.history').then((value) => setHistory(Array.isArray(value) ? value : [])).catch(() => {})
    window.electronAPI?.setting?.get<HttpApiFavoriteItem[]>('httpApi.favorites').then((value) => setFavorites(Array.isArray(value) ? value : [])).catch(() => {})
    window.electronAPI?.setting?.get<HttpApiEnvironment[]>('httpApi.environments').then((value) => setEnvironments(Array.isArray(value) ? value : [])).catch(() => {})
    window.electronAPI?.setting?.get<HttpApiCookieJar[]>('httpApi.cookies').then((value) => setCookieJars(Array.isArray(value) ? value : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (status.type === 'idle') return
    const timer = window.setTimeout(() => setStatus({ type: 'idle', message: '就绪' }), 2800)
    return () => window.clearTimeout(timer)
  }, [status])

  const persist = (key: string, value: unknown): void => {
    window.electronAPI?.setting?.set(key, value).catch(() => {})
  }

  const resetResponseViewState = (): void => {
    setShowFullJson(false)
    setJsonPreviewMode('fields')
  }

  const clearActiveResult = (): void => {
    setSelectedHistoryId(null)
    setResponse(null)
    setLastResult(null)
    resetResponseViewState()
  }

  const detachHistoryResponse = (): void => {
    if (!selectedHistoryId) return
    clearActiveResult()
  }

  const updateRequest = (patch: Partial<HttpApiRequestDraft>, options: { detachHistory?: boolean } = {}): void => {
    if (options.detachHistory !== false) detachHistoryResponse()
    setRequest((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }))
  }

  const updateBody = (patch: Partial<HttpApiRequestDraft['body']>, options: { detachHistory?: boolean } = {}): void => {
    if (options.detachHistory !== false) detachHistoryResponse()
    setRequest((current) => ({
      ...current,
      body: { ...current.body, ...patch },
      updatedAt: new Date().toISOString()
    }))
  }

  const saveHistory = (item: HttpApiHistoryItem): void => {
    const nextHistory = trimHttpApiHistory([item, ...history])
    setHistory(nextHistory)
    persist('httpApi.history', nextHistory)
  }

  const handleSend = async (draft: HttpApiRequestDraft = request): Promise<void> => {
    if (sending) {
      setStatus({ type: 'warning', message: '已有请求正在发送' })
      return
    }

    if (!window.electronAPI?.httpApi?.send) {
      setStatus({ type: 'error', message: 'HTTP API 调试能力不可用' })
      return
    }

    const missingFileMessage = getHttpApiMissingFileMessage(draft)
    if (missingFileMessage) {
      setRequestTab('body')
      setStatus({ type: 'error', message: missingFileMessage })
      return
    }

    const requestId = createHttpApiId('send')
    activeRequestIdRef.current = requestId
    setSelectedHistoryId(null)
    setResponse(null)
    setSending(true)
    setStatus({ type: 'warning', message: '请求发送中' })
    setLastResult(null)
    resetResponseViewState()

    const environmentForSend = environments.find((item) => item.id === draft.environmentId) ?? null
    const requestForSend = applyEnvironmentToRequest(draft, environmentForSend)
    const sentRequest = { ...requestForSend, environmentId: null }
    let result: HttpApiSendResult
    try {
      result = await window.electronAPI.httpApi.send({ requestId, request: sentRequest })
    } catch (error) {
      result = {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : '请求失败',
        requestId
      }
    }
    setSending(false)
    activeRequestIdRef.current = null
    setLastResult(result)

    if (result.response) setResponse(result.response)
    setStatus({ type: result.success ? 'success' : 'error', message: result.message })

    saveHistory(createHttpApiHistoryItem(draft, sentRequest, result))
  }

  const handleCancel = async (): Promise<void> => {
    const requestId = activeRequestIdRef.current
    if (!requestId) return
    const result = await window.electronAPI.httpApi.cancel(requestId)
    setStatus({ type: result.success ? 'warning' : 'error', message: result.message })
  }

  const handleCopy = async (text: string, message: string): Promise<void> => {
    await window.electronAPI?.clipboard?.writeText(text)
    setStatus({ type: 'success', message })
  }

  const saveFavorite = (): void => {
    const now = new Date().toISOString()
    const favorite: HttpApiFavoriteItem = {
      id: createHttpApiId('favorite'),
      name: request.name || `${request.method} ${request.url}`,
      request: sanitizeHttpApiRequestForStorage(cloneRequestForSave(request)),
      createdAt: now,
      updatedAt: now
    }
    const nextFavorites = [favorite, ...favorites]
    setFavorites(nextFavorites)
    persist('httpApi.favorites', nextFavorites)
    setStatus({ type: 'success', message: '请求已收藏' })
  }

  const renameFavorite = (favorite: HttpApiFavoriteItem): void => {
    const name = window.prompt('输入新的收藏名称', favorite.name)
    if (!name) return
    const nextFavorites = favorites.map((item) => item.id === favorite.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)
    setFavorites(nextFavorites)
    persist('httpApi.favorites', nextFavorites)
    setStatus({ type: 'success', message: '收藏已重命名' })
  }

  const deleteFavorite = (id: string): void => {
    const nextFavorites = favorites.filter((item) => item.id !== id)
    setFavorites(nextFavorites)
    persist('httpApi.favorites', nextFavorites)
    setStatus({ type: 'success', message: '收藏已删除' })
  }

  const overwriteFavorite = (id: string): void => {
    const now = new Date().toISOString()
    const nextFavorites = favorites.map((item) => item.id === id ? {
      ...item,
      name: request.name || item.name,
      request: sanitizeHttpApiRequestForStorage(cloneRequestForSave(request)),
      updatedAt: now
    } : item)
    setFavorites(nextFavorites)
    persist('httpApi.favorites', nextFavorites)
    setStatus({ type: 'success', message: '收藏已更新' })
  }

  const saveCookieJar = (): void => {
    const jar = createCookieJar(request.cookies)
    const nextJars = [jar, ...cookieJars]
    setCookieJars(nextJars)
    persist('httpApi.cookies', nextJars)
    setStatus({ type: 'success', message: 'Cookie 组已保存' })
  }

  const renameCookieJar = (jar: HttpApiCookieJar): void => {
    const name = window.prompt('输入新的 Cookie 组名称', jar.name)
    if (!name) return
    const nextJars = cookieJars.map((item) => item.id === jar.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)
    setCookieJars(nextJars)
    persist('httpApi.cookies', nextJars)
    setStatus({ type: 'success', message: 'Cookie 组已重命名' })
  }

  const deleteCookieJar = (id: string): void => {
    const nextJars = cookieJars.filter((item) => item.id !== id)
    setCookieJars(nextJars)
    persist('httpApi.cookies', nextJars)
    setStatus({ type: 'success', message: 'Cookie 组已删除' })
  }

  const addEnvironment = (): void => {
    const nextEnvironments = [createEnvironment(), ...environments]
    setEnvironments(nextEnvironments)
    persist('httpApi.environments', nextEnvironments)
  }

  const updateEnvironment = (environment: HttpApiEnvironment): void => {
    const nextEnvironments = environments.map((item) => item.id === environment.id ? { ...environment, updatedAt: new Date().toISOString() } : item)
    setEnvironments(nextEnvironments)
    persist('httpApi.environments', nextEnvironments)
  }

  const deleteEnvironment = (id: string): void => {
    const nextEnvironments = environments.filter((item) => item.id !== id)
    setEnvironments(nextEnvironments)
    persist('httpApi.environments', nextEnvironments)
    if (request.environmentId === id) updateRequest({ environmentId: null })
    setStatus({ type: 'success', message: '环境已删除' })
  }

  const deleteHistoryItem = (id: string): void => {
    const nextHistory = history.filter((item) => item.id !== id)
    setHistory(nextHistory)
    persist('httpApi.history', nextHistory)
    if (selectedHistoryId === id) setSelectedHistoryId(null)
    setStatus({ type: 'success', message: '历史记录已删除' })
  }

  const clearHistory = (): void => {
    if (!window.confirm('确定清空全部请求历史吗？')) return
    setHistory([])
    persist('httpApi.history', [])
    setSelectedHistoryId(null)
    setStatus({ type: 'success', message: '历史记录已清空' })
  }

  const resendHistoryItem = (item: HttpApiHistoryItem): void => {
    const replayRequest = item.sentRequest ?? item.request
    setRequest(replayRequest)
    clearActiveResult()
    void handleSend(replayRequest)
  }

  const saveResponseCookies = (): void => {
    if (responseCookies.length === 0) return
    const nextCookies = mergeCookies(request.cookies, responseCookies)
    updateRequest({ cookies: nextCookies }, { detachHistory: false })
    setStatus({ type: 'success', message: `已合并 ${responseCookies.length} 个响应 Cookie 到当前请求` })
  }

  const saveResponseCookieJar = (): void => {
    if (responseCookies.length === 0) return
    const jar = createCookieJar(responseCookies)
    const nextJars = [jar, ...cookieJars]
    setCookieJars(nextJars)
    persist('httpApi.cookies', nextJars)
    setStatus({ type: 'success', message: `已保存 ${responseCookies.length} 个响应 Cookie 到 Cookie 组` })
  }

  const openCurlImport = (): void => {
    if (sending) {
      setStatus({ type: 'warning', message: '请求发送中，暂不能导入' })
      return
    }
    setCurlImportText('')
    setCurlImportOpen(true)
  }

  const closeCurlImport = (): void => {
    setCurlImportOpen(false)
    setCurlImportText('')
  }

  const applyCurlImport = (): void => {
    const result = curlImportResult
    if (!result) {
      setStatus({ type: 'warning', message: '请先粘贴 cURL 命令' })
      return
    }
    if (!result.success) {
      setStatus({ type: 'error', message: result.error })
      return
    }
    clearActiveResult()
    setRequest(result.request)
    closeCurlImport()
    setStatus({ type: 'success', message: 'cURL 已导入' })
  }

  const exportCurl = (): void => {
    try {
      void handleCopy(exportRequestToCurl(resolvedRequest), 'cURL 已复制')
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'cURL 导出失败' })
    }
  }

  const openGeneratedCode = (): void => {
    setResponseTab('code')
    setMobilePane('response')
  }

  const loadHistoryItem = (item: HttpApiHistoryItem): void => {
    setRequest(item.request)
    setSelectedHistoryId(item.id)
    setResponse(null)
    setLastResult(null)
    setResponseTab('body')
    resetResponseViewState()
    setMobilePane('response')
    setMobileResourceOpen(false)
    setStatus({ type: item.success ? 'success' : 'error', message: item.message })
  }

  const selectBodyFile = async (file: File | null): Promise<void> => {
    if (!file) return
    if (file.size > HTTP_API_FILE_LIMIT_BYTES) {
      setStatus({ type: 'error', message: '文件超过 25 MB 限制' })
      return
    }
    updateBody({
      mode: 'file',
      file: {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        bytes: await file.arrayBuffer()
      }
    })
  }

  const renderCurlImportDialog = (): JSX.Element | null => {
    if (!curlImportOpen) return null
    const previewRequest = curlImportResult?.success ? curlImportResult.request : null

    return (
      <div className="http-modal-layer">
        <button className="modal-backdrop http-modal-backdrop" onClick={closeCurlImport} aria-label="关闭 cURL 导入" />
        <section className="modal-surface http-curl-modal" role="dialog" aria-modal="true" aria-labelledby="http-curl-title">
          <div className="http-modal-heading">
            <div>
              <strong id="http-curl-title">导入 cURL</strong>
              <span>{previewRequest ? `${previewRequest.method} · ${previewRequest.url}` : '等待解析'}</span>
            </div>
            <button className="icon-button" onClick={closeCurlImport} title="关闭"><X className="h-4 w-4" /></button>
          </div>
          <textarea
            className="field-textarea http-curl-textarea"
            value={curlImportText}
            onChange={(event) => setCurlImportText(event.target.value)}
            placeholder="curl 'https://api.example.com'"
          />
          {curlImportResult && !curlImportResult.success && (
            <div className="http-inline-alert http-inline-alert-danger">{curlImportResult.error}</div>
          )}
          {previewRequest && (
            <div className="http-curl-preview">
              <div><span>方法</span><strong>{previewRequest.method}</strong></div>
              <div><span>地址</span><strong title={previewRequest.url}>{previewRequest.url}</strong></div>
              <div><span>Query</span><strong>{previewRequest.queryParams.filter((item) => item.key.trim()).length}</strong></div>
              <div><span>Headers</span><strong>{previewRequest.headers.length}</strong></div>
              <div><span>Body</span><strong>{getBodyModeLabel(previewRequest.body.mode)}</strong></div>
            </div>
          )}
          <div className="http-modal-actions">
            <button className="toolbar-button" onClick={closeCurlImport}>取消</button>
            <button className="toolbar-button-primary" disabled={!previewRequest} onClick={applyCurlImport}>导入请求</button>
          </div>
        </section>
      </div>
    )
  }

  const renderLeftPanel = (): JSX.Element => (
    <section className={`editor-surface http-side-panel ${leftCollapsed ? 'http-side-panel-collapsed' : ''}`}>
      <div className="http-side-header">
        {!leftCollapsed && <strong>资源</strong>}
        <button
          className="icon-button"
          onClick={() => setLeftCollapsed((value) => !value)}
          title={leftCollapsed ? '展开资源栏' : '折叠资源栏'}
        >
          {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <div className="http-left-tabs">
        {([
          ['history', History, '历史'],
          ['favorites', Star, '收藏'],
          ['environment', Globe2, '环境'],
          ['cookies', Shield, 'Cookie']
        ] as const).map(([tab, Icon, label]) => (
          <button
            key={tab}
            className={leftTab === tab ? 'http-left-tab-active' : ''}
            onClick={() => {
              setLeftTab(tab)
              setMobileResourceOpen(true)
            }}
            title={label}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="http-side-body">
        <div className="http-sensitive-note">敏感信息仅保存到本机配置。</div>
        {leftTab === 'history' && (
          <div className="http-list-stack">
            {history.length > 0 && <button className="toolbar-button" disabled={sending} onClick={clearHistory}><Trash2 className="h-4 w-4" />清空历史</button>}
            {history.map((item) => (
              <div key={item.id} className="http-list-row">
                <button className="http-list-main" disabled={sending} onClick={() => loadHistoryItem(item)}>
                  <span className={item.response ? getStatusTone(item.response.statusCode) : 'tone-danger'}>{item.response?.statusCode ?? 'ERR'}</span>
                  <strong>{item.request.name || item.request.url}</strong>
                  <small>{item.request.method} · {item.response ? `${item.response.durationMs} ms` : item.message} · {new Date(item.createdAt).toLocaleString()}</small>
                </button>
                <div className="http-list-actions">
                  <button className="toolbar-button" disabled={sending} onClick={() => resendHistoryItem(item)}><SendHorizontal className="h-4 w-4" />重发</button>
                  <button className="icon-button icon-button-danger" disabled={sending} onClick={() => deleteHistoryItem(item.id)} title="删除"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {history.length === 0 && <div className="http-empty">暂无历史</div>}
          </div>
        )}

        {leftTab === 'favorites' && (
          <div className="http-list-stack">
            <button className="toolbar-button-primary" disabled={sending} onClick={saveFavorite}><Star className="h-4 w-4" />收藏当前请求</button>
            {favorites.map((item) => (
              <div key={item.id} className="http-list-row">
                <button className="http-list-main" disabled={sending} onClick={() => {
                  clearActiveResult()
                  setRequest(item.request)
                  setMobileResourceOpen(false)
                }}>
                  <strong>{item.name}</strong>
                  <small>{item.request.method} · {item.request.url}</small>
                </button>
                <div className="http-list-actions">
                  <button className="toolbar-button" onClick={() => renameFavorite(item)}>重命名</button>
                  <button className="toolbar-button" disabled={sending} onClick={() => overwriteFavorite(item.id)}>覆盖</button>
                  <button className="icon-button icon-button-danger" disabled={sending} onClick={() => deleteFavorite(item.id)} title="删除"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {leftTab === 'environment' && (
          <div className="http-list-stack">
            <button className="toolbar-button-primary" disabled={sending} onClick={addEnvironment}><Plus className="h-4 w-4" />新增环境</button>
            <select className="field-select" disabled={sending} value={request.environmentId ?? ''} onChange={(event) => updateRequest({ environmentId: event.target.value || null })}>
              <option value="">不使用环境</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {environments.map((environment) => (
              <div key={environment.id} className="http-env-card">
                <div className="http-resource-heading">
                  <input className="field-input" value={environment.name} onChange={(event) => updateEnvironment({ ...environment, name: event.target.value })} />
                  <button className="icon-button icon-button-danger" disabled={sending} onClick={() => deleteEnvironment(environment.id)} title="删除环境"><Trash2 className="h-4 w-4" /></button>
                </div>
                <KeyValueEditor items={environment.variables} onChange={(variables) => updateEnvironment({ ...environment, variables })} />
              </div>
            ))}
          </div>
        )}

        {leftTab === 'cookies' && (
          <div className="http-list-stack">
            <button className="toolbar-button-primary" disabled={sending} onClick={saveCookieJar}><Save className="h-4 w-4" />保存当前 Cookie</button>
            {cookieJars.map((jar) => (
              <div key={jar.id} className="http-list-row">
                <button className="http-list-main" disabled={sending} onClick={() => {
                  updateRequest({ cookies: jar.cookies })
                  setMobileResourceOpen(false)
                }}>
                  <strong>{jar.name}</strong>
                  <small>{jar.cookies.length} 项 Cookie</small>
                </button>
                <div className="http-list-actions">
                  <button className="toolbar-button" onClick={() => renameCookieJar(jar)}>重命名</button>
                  <button className="icon-button icon-button-danger" disabled={sending} onClick={() => deleteCookieJar(jar.id)} title="删除"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )

  const renderRequestBody = (): JSX.Element => (
    <div className="http-body-editor">
      <div className="segmented-control http-body-tabs">
        {bodyModes.map((mode) => (
          <button key={mode} className={`segmented-item ${request.body.mode === mode ? 'segmented-item-active' : ''}`} onClick={() => updateBody({ mode })}>
            {getBodyModeLabel(mode)}
          </button>
        ))}
      </div>

      {request.body.mode === 'none' && <div className="http-empty">当前请求不发送 Body</div>}
      {request.body.mode === 'json' && (
        <CodeMirror value={request.body.json} height="100%" className="code-editor-light" extensions={[json(), editorTheme]} onChange={(value) => updateBody({ json: value })} />
      )}
      {request.body.mode === 'text' && (
        <textarea className="field-textarea http-plain-textarea" value={request.body.text} onChange={(event) => updateBody({ text: event.target.value })} />
      )}
      {request.body.mode === 'urlencoded' && <KeyValueEditor items={request.body.urlencoded} onChange={(urlencoded) => updateBody({ urlencoded })} />}
      {request.body.mode === 'form-data' && <FormDataEditor items={request.body.formData} onChange={(formData) => updateBody({ formData })} onStatus={setStatus} />}
      {request.body.mode === 'file' && (
        <div className="http-file-body">
          <label className="toolbar-button-primary">
            <FileUp className="h-4 w-4" />
            <span>{request.body.file ? request.body.file.needsReselect ? `${request.body.file.name}（需重选）` : request.body.file.name : '选择文件'}</span>
            <input type="file" onChange={(event) => void selectBodyFile(event.target.files?.[0] ?? null)} />
          </label>
          {request.body.file && <span>{request.body.file.needsReselect ? '需要重新选择文件' : `${formatBytes(request.body.file.size)} · ${request.body.file.type}`}</span>}
        </div>
      )}
    </div>
  )

  const renderRequestPanel = (): JSX.Element => (
    <section className="editor-surface http-request-panel">
      <div className="http-request-top">
        <select className="field-select http-method-select" disabled={sending} value={request.method} onChange={(event) => updateRequest({ method: event.target.value as HttpApiMethod })}>
          {methods.map((method) => <option key={method} value={method}>{method}</option>)}
        </select>
        <input className="field-input http-url-input" disabled={sending} value={request.url} onChange={(event) => updateRequest({ url: event.target.value })} placeholder="https://api.example.com/resource" />
        {sending ? (
          <button className="toolbar-button-danger" onClick={() => void handleCancel()}><StopCircle className="h-4 w-4" />取消</button>
        ) : (
          <button className="toolbar-button-primary" onClick={() => void handleSend()}><SendHorizontal className="h-4 w-4" />发送</button>
        )}
      </div>

      <div className="http-request-meta">
        <input className="field-input" disabled={sending} value={request.name} onChange={(event) => updateRequest({ name: event.target.value })} placeholder="请求名称" />
        <span>{resolvedRequest.environmentId ? '已应用环境变量' : '未使用环境变量'}</span>
      </div>

      <div className="segmented-control http-request-tabs">
        {([
          ['query', 'Query'],
          ['headers', 'Headers'],
          ['auth', 'Auth'],
          ['cookies', 'Cookies'],
          ['body', 'Body'],
          ['options', 'Options']
        ] as const).map(([tab, label]) => (
          <button key={tab} className={`segmented-item ${requestTab === tab ? 'segmented-item-active' : ''}`} onClick={() => setRequestTab(tab)}>
            {label}
          </button>
        ))}
      </div>

      <div className="http-request-tab-body">
        {requestTab === 'query' && <KeyValueEditor items={request.queryParams} onChange={(queryParams) => updateRequest({ queryParams })} />}
        {requestTab === 'headers' && <KeyValueEditor items={request.headers} onChange={(headers) => updateRequest({ headers })} />}
        {requestTab === 'cookies' && <CookieEditor items={request.cookies} onChange={(cookies) => updateRequest({ cookies })} />}
        {requestTab === 'auth' && (
          <div className="http-auth-grid">
            <select className="field-select" value={request.auth.type} onChange={(event) => {
              const type = event.target.value
              updateRequest({
                auth: type === 'bearer'
                  ? { type: 'bearer', token: '' }
                  : type === 'basic'
                    ? { type: 'basic', username: '', password: '' }
                    : { type: 'none' }
              })
            }}>
              <option value="none">无鉴权</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
            </select>
            {request.auth.type === 'bearer' && (
              <input className="field-input" value={request.auth.token} onChange={(event) => updateRequest({ auth: { type: 'bearer', token: event.target.value } })} placeholder="Token" />
            )}
            {request.auth.type === 'basic' && (
              <>
                <input className="field-input" value={request.auth.username} onChange={(event) => updateRequest({ auth: { type: 'basic', username: event.target.value, password: request.auth.type === 'basic' ? request.auth.password : '' } })} placeholder="用户名" />
                <input className="field-input" type="password" value={request.auth.password} onChange={(event) => updateRequest({ auth: { type: 'basic', username: request.auth.type === 'basic' ? request.auth.username : '', password: event.target.value } })} placeholder="密码" />
              </>
            )}
          </div>
        )}
        {requestTab === 'body' && renderRequestBody()}
        {requestTab === 'options' && (
          <div className="http-options-grid">
            <label><span>超时</span><input className="field-input" type="number" min={100} value={request.timeoutMs} onChange={(event) => updateRequest({ timeoutMs: Number(event.target.value) })} /></label>
            <label><span>最大重定向</span><input className="field-input" type="number" min={0} max={10} value={request.maxRedirects} onChange={(event) => updateRequest({ maxRedirects: Number(event.target.value) })} /></label>
            <label className="http-check-row"><input className="field-checkbox" type="checkbox" checked={request.sslVerify} onChange={(event) => updateRequest({ sslVerify: event.target.checked })} />SSL 校验</label>
            <label className="http-check-row"><input className="field-checkbox" type="checkbox" checked={request.followRedirects} onChange={(event) => updateRequest({ followRedirects: event.target.checked })} />跟随重定向</label>
          </div>
        )}
      </div>
      {sending && (
        <div className="http-request-edit-lock">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>请求发送中，编辑已锁定</span>
        </div>
      )}
    </section>
  )

  const renderResponseBody = (): JSX.Element => {
    if (!activeResponse) {
      return (
        <div className="http-empty http-response-error-state">
          <strong>{getResultStatusLabel(activeResultStatus)}</strong>
          <span>{activeResultMessage || '暂无响应'}</span>
        </div>
      )
    }
    if (activeResponse.bodyUnavailable) {
      return (
        <div className="http-empty http-response-warning-state">
          <strong>响应内容不可预览</strong>
          <span>{activeResponse.bodyUnavailableReason || '历史中未保存此响应正文，请重新发送请求查看'}</span>
        </div>
      )
    }
    if (activeResponse.previewKind === 'image' && activeResponse.bodyBase64) {
      return <div className="http-image-preview"><img src={`data:${activeResponse.contentType};base64,${activeResponse.bodyBase64}`} alt="响应图片预览" /></div>
    }
    if (activeResponse.previewKind === 'html') {
      return <iframe className="http-html-preview" srcDoc={activeResponse.bodyText} title="HTML 响应预览" sandbox="" />
    }
    if (activeResponse.previewKind === 'json' && jsonTree) {
      return (
        <div className="http-json-view-stack">
          <div className="http-response-actions">
            <button className="toolbar-button" onClick={() => void handleCopy(activeResponse.bodyText, 'JSON 原文已复制')}><Copy className="h-4 w-4" />原文</button>
            <button className="toolbar-button" onClick={() => void handleCopy(formattedJsonText, '格式化 JSON 已复制')}><Copy className="h-4 w-4" />格式化</button>
            {hasCollapsedJsonText && (
              <button className="toolbar-button" onClick={() => setShowFullJson((value) => !value)}>
                {showFullJson ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {showFullJson ? '全部折叠' : '全部显示'}
              </button>
            )}
            {responseCookies.length > 0 && (
              <>
                <button className="toolbar-button" onClick={saveResponseCookies}><Save className="h-4 w-4" />合并到请求</button>
                <button className="toolbar-button" onClick={saveResponseCookieJar}><Save className="h-4 w-4" />保存为组</button>
              </>
            )}
          </div>
          <div className="http-json-preview">
            <div className="segmented-control http-json-preview-tabs">
              <button className={`segmented-item ${jsonPreviewMode === 'fields' ? 'segmented-item-active' : ''}`} onClick={() => setJsonPreviewMode('fields')}>字段</button>
              <button className={`segmented-item ${jsonPreviewMode === 'source' ? 'segmented-item-active' : ''}`} onClick={() => setJsonPreviewMode('source')}>源码</button>
            </div>

            {jsonPreviewMode === 'fields' && (
              <div className="http-json-tree-panel">
                <div className="http-json-tree">
                  <JsonTreeView
                    node={jsonTree}
                    showFullValues={showFullJson}
                    onCopy={(node) => void handleCopy(node.editableValue, `${node.pathText} 已复制`)}
                  />
                </div>
              </div>
            )}

            {jsonPreviewMode === 'source' && (
              <div className="http-json-source-panel">
                <CodeMirror value={previewJsonText || activeResponse.bodyText} height="100%" className="code-editor-light http-json-code-editor" extensions={[json(), editorTheme, EditorView.lineWrapping]} editable={false} />
              </div>
            )}
          </div>
        </div>
      )
    }
    return <CodeMirror value={activeResponse.bodyText} height="100%" className="code-editor-light" extensions={[editorTheme]} editable={false} />
  }

  const renderResponsePanel = (): JSX.Element => (
    <section className="editor-surface http-response-panel">
      {selectedHistoryItem && (
        <div className="http-response-notice">
          历史响应预览 · {new Date(selectedHistoryItem.createdAt).toLocaleString()}
        </div>
      )}
      {activeResponse?.bodyTruncated && (
        <div className="http-response-notice http-response-notice-warning">
          历史响应正文已截断，仅显示前 {formatBytes(HTTP_API_HISTORY_BODY_LIMIT)}
        </div>
      )}
      <div className="http-response-summary">
        <div><span>状态</span><strong className={activeResponse ? getStatusTone(activeResponse.statusCode) : activeResultStatus && activeResultStatus !== 'completed' ? 'tone-danger' : ''}>{activeResponse ? `${activeResponse.statusCode} ${activeResponse.statusText}` : getResultStatusLabel(activeResultStatus)}</strong></div>
        <div><span>耗时</span><strong>{activeResponse ? `${activeResponse.durationMs} ms` : '-'}</strong></div>
        <div><span>大小</span><strong>{activeResponse ? formatBytes(activeResponse.sizeBytes) : '-'}</strong></div>
        <div><span>类型</span><strong>{activeResponse ? getPreviewLabel(activeResponse.previewKind) : '-'}</strong></div>
        <div className="http-response-summary-wide"><span>{activeResponse ? '地址' : '结果'}</span><strong title={activeResponse?.url ?? activeResultMessage}>{activeResponse?.url ?? (activeResultMessage || '-')}</strong></div>
        <div><span>Content-Type</span><strong title={activeResponse?.contentType}>{activeResponse?.contentType || '-'}</strong></div>
        <div><span>完成时间</span><strong>{activeResponse ? formatResponseTime(activeResponse.completedAt) : '-'}</strong></div>
        <div><span>重定向</span><strong>{activeResponse ? activeResponse.redirectChain.length : '-'}</strong></div>
      </div>

      <div className="http-response-tabs">
        {responseTabs.map((tab) => (
          <button key={tab} className={responseTab === tab ? 'http-response-tab-active' : ''} onClick={() => setResponseTab(tab)}>
            {getResponseTabLabel(tab)}
          </button>
        ))}
      </div>

      <div key={`${responseViewKey}:${responseTab}`} className="http-response-body">
        {responseTab === 'body' && renderResponseBody()}
        {responseTab === 'headers' && (
          <div className="http-header-list">
            {responseCookies.length > 0 && (
              <div className="http-header-actions">
                <button className="toolbar-button" onClick={saveResponseCookies}><Save className="h-4 w-4" />合并 {responseCookies.length} 个到请求</button>
                <button className="toolbar-button" onClick={saveResponseCookieJar}><Save className="h-4 w-4" />保存为 Cookie 组</button>
              </div>
            )}
            {activeResponse?.headers.map((header) => (
              <div key={header.id}><code>{header.key}</code><span>{header.value}</span></div>
            )) ?? <div className="http-empty">暂无 Headers</div>}
          </div>
        )}
        {responseTab === 'redirects' && (
          <div className="http-header-list">
            {activeResponse && activeResponse.redirectChain.length > 0 ? activeResponse.redirectChain.map((record, index) => (
              <div key={`${record.fromUrl}-${index}`}><code>{record.statusCode}</code><span>{record.fromUrl} → {record.toUrl}</span></div>
            )) : <div className="http-empty">暂无重定向</div>}
          </div>
        )}
        {responseTab === 'code' && (
          <div className="http-code-panel">
            <div className="segmented-control http-code-tabs">
              {codeTargets.map((target) => (
                <button key={target} className={`segmented-item ${codeTarget === target ? 'segmented-item-active' : ''}`} onClick={() => setCodeTarget(target)}>{target}</button>
              ))}
            </div>
            <CodeMirror value={generatedCode} height="100%" className="code-editor-light" extensions={[editorTheme]} editable={false} />
            <button className="toolbar-button" onClick={() => void handleCopy(generatedCode, '代码已复制')}><Copy className="h-4 w-4" />复制代码</button>
          </div>
        )}
      </div>
    </section>
  )

  const statusClassName = status.type === 'success'
    ? 'tone-success'
    : status.type === 'error'
      ? 'tone-danger'
      : status.type === 'warning'
        ? 'tone-warning'
        : 'text-[color:var(--text-muted)]'

  return (
    <div className="tool-page http-api-tool-page">
      <div className="toolbar-surface http-api-toolbar">
        <div className="http-toolbar-title">
          <button className="icon-button http-mobile-resource-button" onClick={() => setMobileResourceOpen(true)} title="打开资源栏"><Menu className="h-4 w-4" /></button>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : activeResponse?.previewKind === 'image' ? <Image className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
          <span className={statusClassName}>{status.message}</span>
        </div>
        <div className="http-toolbar-actions">
          <div className="http-toolbar-meta">
            <span><Clock className="h-3.5 w-3.5" />{activeResponse ? `${activeResponse.durationMs} ms` : '未发送'}</span>
            <span><Check className="h-3.5 w-3.5" />{activeEnvironment?.name ?? '无环境'}</span>
          </div>
          <button className="toolbar-button" onClick={() => {
            clearActiveResult()
            setRequest(createDefaultHttpApiDraft())
          }} disabled={sending}><RefreshCcw className="h-4 w-4" />新建</button>
          <button className="toolbar-button" disabled={sending} onClick={openCurlImport}><FileUp className="h-4 w-4" />导入</button>
          <button className="toolbar-button" onClick={exportCurl}><Copy className="h-4 w-4" />导出</button>
          <button className="toolbar-button" disabled={sending} onClick={saveFavorite}><Star className="h-4 w-4" />收藏</button>
          <button className="toolbar-button" onClick={openGeneratedCode}><Code2 className="h-4 w-4" />代码</button>
          <button className="icon-button" onClick={clearActiveResult} title="清空响应"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="segmented-control http-mobile-pane-tabs">
        <button className={`segmented-item ${mobilePane === 'request' ? 'segmented-item-active' : ''}`} onClick={() => setMobilePane('request')}>请求</button>
        <button className={`segmented-item ${mobilePane === 'response' ? 'segmented-item-active' : ''}`} onClick={() => setMobilePane('response')}>响应</button>
      </div>

      <div className={`http-api-workbench ${leftCollapsed ? 'http-api-workbench-collapsed' : ''} ${mobileResourceOpen ? 'http-resource-open' : ''} http-mobile-pane-${mobilePane}`}>
        <button className="http-mobile-backdrop" onClick={() => setMobileResourceOpen(false)} aria-label="关闭资源栏" />
        {renderLeftPanel()}
        {renderRequestPanel()}
        {renderResponsePanel()}
      </div>
      {renderCurlImportDialog()}
    </div>
  )
}
