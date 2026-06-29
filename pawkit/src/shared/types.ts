import type { ToolId } from './constants'
import type { BBox, FeatureCollection } from 'geojson'

// 应用主题
export type AppTheme = 'light' | 'dark'

// 应用启动页策略
export type AppStartPage = 'home' | 'last' | ToolId

// 工具使用记录
export interface ToolUsageRecord {
  toolId: ToolId
  count: number
  lastUsedAt: string
}

// 剪贴板基础项
export interface ClipboardBaseItem {
  id: string
  type: 'text' | 'image' | 'file' | 'richText'
  content: string
  favorite: boolean
  createdAt: string
  updatedAt: string
  signature?: string
  formats?: string[]
}

// 文本剪贴板项
export interface ClipboardTextItem extends ClipboardBaseItem {
  type: 'text'
}

// 图片剪贴板项
export interface ClipboardImageItem extends ClipboardBaseItem {
  type: 'image'
  imagePath: string
  thumbnailDataUrl: string
  width: number
  height: number
  size: number
  originalSize?: number
  originalTooLarge?: boolean
}

// 文件剪贴板项
export interface ClipboardFileEntry {
  path: string
  name: string
  exists: boolean
}

// 文件剪贴板项
export interface ClipboardFileItem extends ClipboardBaseItem {
  type: 'file'
  files: ClipboardFileEntry[]
}

// 富文本剪贴板项
export interface ClipboardRichTextItem extends ClipboardBaseItem {
  type: 'richText'
  html?: string
  rtf?: string
}

// 剪贴板项
export type ClipboardItem =
  | ClipboardTextItem
  | ClipboardImageItem
  | ClipboardFileItem
  | ClipboardRichTextItem

// 剪贴板复制结果
export interface ClipboardCopyResult {
  success: boolean
  history: ClipboardItem[]
  fallback?: boolean
  message?: string
}

// 剪贴板删除结果
export interface ClipboardRemoveResult {
  success: boolean
  history: ClipboardItem[]
  undoToken?: string
  message: string
}

// 剪贴板安全动作结果
export interface ClipboardActionResult {
  success: boolean
  message: string
}

// 颜色 RGB
export interface RGB {
  r: number
  g: number
  b: number
}

// 颜色 HSL
export interface HSL {
  h: number
  s: number
  l: number
}

// 颜色记录
export interface ColorRecord {
  hex: string
  rgb: RGB
  hsl: HSL
  alpha?: number
  createdAt: string
  updatedAt?: string
  name?: string
  tags?: string[]
  source?: 'manual' | 'screen' | 'recent' | 'favorite'
}

// 管理配置
export interface ManagementSettings {
  toolOrder: ToolId[]
  favoriteTools: ToolId[]
  autoUpdate: boolean
  lastCheckUpdateTime: string | null
}

// 二维码模板类型
export type QrCodeTemplateType = 'text' | 'url' | 'wifi' | 'vcard'

// 二维码纠错级别
export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

// 二维码最近动作
export type QrCodeLastAction = 'copied' | 'saved' | 'edited'

// 二维码样式配置
export interface QrCodeStyleSettings {
  size: number
  margin: number
  darkColor: string
  lightColor: string
  errorCorrectionLevel: QrCodeErrorCorrectionLevel
  preset?: string
}

// 二维码历史项
export interface QrCodeHistoryItem {
  id: string
  template: QrCodeTemplateType
  title: string
  payload: string
  fields: Record<string, string>
  style: QrCodeStyleSettings
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastAction?: QrCodeLastAction
}

// 地理数据格式
export type GeoDataFormat =
  | 'geojson'
  | 'topojson'
  | 'csv'
  | 'kml'
  | 'svg'
  | 'shapefile'
  | 'flatgeobuf'

// 地理文件对话框过滤器
export interface GeoFileDialogFilter {
  name: string
  extensions: string[]
}

// 地理二进制数据
export type GeoBinaryData = ArrayBuffer | Uint8Array

// 地理文件读取结果
export interface GeoFilePayload {
  name: string
  path: string
  bytes: GeoBinaryData
  size: number
}

// 地理文件保存请求
export interface GeoSaveFileRequest {
  suggestedName: string
  bytes: GeoBinaryData
  filters: GeoFileDialogFilter[]
}

// 地理文件保存结果
export interface GeoSaveFileResult {
  success: boolean
  status: 'saved' | 'cancelled' | 'error'
  path?: string
  message: string
}

// 地理压缩包条目
export interface GeoArchiveEntry {
  name: string
  bytes: GeoBinaryData
}

// 地理压缩包保存请求
export interface GeoSaveArchiveRequest {
  suggestedName: string
  entries: GeoArchiveEntry[]
}

// 地理图层
export interface GeoLayer {
  id: string
  name: string
  format: GeoDataFormat
  visible: boolean
  featureCount: number
  bbox?: BBox
  crs?: string
  collection: FeatureCollection
  warnings?: string[]
}

// 地理工作区
export interface GeoWorkspace {
  layers: GeoLayer[]
  activeLayerId: string | null
}

// 地理导入结果
export interface GeoImportResult {
  layers: GeoLayer[]
  warnings: string[]
}

// 地理导出请求
export interface GeoExportRequest {
  layerId: string
  format: GeoDataFormat
  fileName: string
}

// 地理操作类型
export type GeoOperationType =
  | 'simplify'
  | 'clip'
  | 'erase'
  | 'merge'
  | 'filter'
  | 'calculate'
  | 'rename-field'
  | 'drop-field'
  | 'sort'
  | 'project'
  | 'buffer'

// 地理操作请求
export interface GeoOperationRequest {
  type: GeoOperationType
  layer: GeoLayer
  clipLayer?: GeoLayer
  options: Record<string, unknown>
}

// 地理操作结果
export interface GeoOperationResult {
  success: boolean
  message: string
  layer?: GeoLayer
}

// 串流代理协议
export type StreamProxyProtocol = 'ws' | 'wss' | 'rtsp'

// 串流代理事件类型
export type StreamProxyEventType = 'connected' | 'reconnecting' | 'error' | 'stopped'

// 串流代理启动请求
export interface StreamProxyStartRequest {
  sourceUrl: string
  protocol: StreamProxyProtocol
  title?: string
}

// 串流代理启动响应
export interface StreamProxyStartResponse {
  success: boolean
  status: 'started' | 'error'
  message: string
  sessionId?: string
  localUrl?: string
}

// 串流代理操作响应
export interface StreamProxyActionResult {
  success: boolean
  message: string
}

// 串流代理事件
export interface StreamProxyEvent {
  sessionId: string
  type: StreamProxyEventType
  message: string
  sourceUrl?: string
  localUrl?: string
  retryCount?: number
  createdAt: string
}

// HTTP API 请求方法
export type HttpApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// HTTP API 键值项
export interface HttpApiKeyValueItem {
  id: string
  key: string
  value: string
  enabled: boolean
}

// HTTP API 表单数据项
export interface HttpApiFormDataItem extends HttpApiKeyValueItem {
  type: 'text' | 'file'
  fileName?: string
  fileType?: string
  fileSize?: number
  fileBytes?: ArrayBuffer
  needsReselect?: boolean
}

// HTTP API 文件请求体
export interface HttpApiFileBody {
  name: string
  type: string
  size: number
  bytes?: ArrayBuffer
  needsReselect?: boolean
}

// HTTP API 请求体类型
export type HttpApiBodyMode = 'none' | 'json' | 'form-data' | 'urlencoded' | 'text' | 'file'

// HTTP API 请求体
export interface HttpApiRequestBody {
  mode: HttpApiBodyMode
  text: string
  json: string
  urlencoded: HttpApiKeyValueItem[]
  formData: HttpApiFormDataItem[]
  file: HttpApiFileBody | null
}

// HTTP API 鉴权配置
export type HttpApiAuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }

// HTTP API Cookie 项
export interface HttpApiCookieItem extends HttpApiKeyValueItem {
  domain?: string
  path?: string
}

// HTTP API 请求草稿
export interface HttpApiRequestDraft {
  id: string
  name: string
  method: HttpApiMethod
  url: string
  queryParams: HttpApiKeyValueItem[]
  headers: HttpApiKeyValueItem[]
  auth: HttpApiAuthConfig
  cookies: HttpApiCookieItem[]
  body: HttpApiRequestBody
  timeoutMs: number
  sslVerify: boolean
  followRedirects: boolean
  maxRedirects: number
  environmentId: string | null
  createdAt: string
  updatedAt: string
}

// HTTP API 发送请求
export interface HttpApiSendRequest {
  requestId: string
  request: HttpApiRequestDraft
}

// HTTP API 重定向记录
export interface HttpApiRedirectRecord {
  statusCode: number
  statusText: string
  fromUrl: string
  toUrl: string
  durationMs: number
}

// HTTP API 响应预览类型
export type HttpApiResponsePreviewKind = 'json' | 'html' | 'text' | 'image' | 'binary'

// HTTP API 响应
export interface HttpApiResponse {
  url: string
  statusCode: number
  statusText: string
  headers: HttpApiKeyValueItem[]
  durationMs: number
  sizeBytes: number
  contentType: string
  previewKind: HttpApiResponsePreviewKind
  bodyText: string
  bodyBase64?: string
  bodyTruncated?: boolean
  bodyUnavailable?: boolean
  bodyUnavailableReason?: string
  redirected: boolean
  redirectChain: HttpApiRedirectRecord[]
  completedAt: string
}

// HTTP API 发送结果
export interface HttpApiSendResult {
  success: boolean
  status: 'completed' | 'cancelled' | 'timeout' | 'error'
  message: string
  requestId: string
  response?: HttpApiResponse
}

// HTTP API 操作结果
export interface HttpApiActionResult {
  success: boolean
  message: string
}

// HTTP API 历史项
export interface HttpApiHistoryItem {
  id: string
  request: HttpApiRequestDraft
  sentRequest?: HttpApiRequestDraft
  response: HttpApiResponse | null
  success: boolean
  message: string
  createdAt: string
}

// HTTP API 收藏项
export interface HttpApiFavoriteItem {
  id: string
  name: string
  request: HttpApiRequestDraft
  createdAt: string
  updatedAt: string
}

// HTTP API 环境变量
export interface HttpApiEnvironment {
  id: string
  name: string
  variables: HttpApiKeyValueItem[]
  createdAt: string
  updatedAt: string
}

// HTTP API Cookie 管理
export interface HttpApiCookieJar {
  id: string
  name: string
  cookies: HttpApiCookieItem[]
  createdAt: string
  updatedAt: string
}

// 应用配置
export interface AppSettings {
  app: {
    theme: AppTheme
    shortcuts: Record<ShortcutKey, { accelerator: string; enabled: boolean }>
    windowBounds: { x: number; y: number; width: number; height: number } | null
    enabledTools: ToolId[]
    startPage: AppStartPage
    lastActiveTool: ToolId
    toolUsage: ToolUsageRecord[]
  }
  management: ManagementSettings
  clipboard: {
    history: ClipboardItem[]
  }
  color: {
    favorites: ColorRecord[]
    recent: ColorRecord[]
  }
  qrcode: {
    history: QrCodeHistoryItem[]
  }
  httpApi: {
    history: HttpApiHistoryItem[]
    favorites: HttpApiFavoriteItem[]
    environments: HttpApiEnvironment[]
    cookies: HttpApiCookieJar[]
  }
  screenshot: {
    preferences: ScreenshotPreferences
  }
  privacy: {
    qrcodeHistoryLimit: number
  }
}

// 窗口尺寸
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

// 截图默认设置
export interface ScreenshotPreferences {
  annotationColor: string
  strokeWidth: number
}

// 截图会话启动状态
export type ScreenCaptureStartStatus =
  | 'started'
  | 'busy'
  | 'no-source'
  | 'error'

// 截图会话启动响应
export interface ScreenCaptureStartResponse {
  status: ScreenCaptureStartStatus
  message: string
  sessionId?: string
}

// 单个显示器的截图覆盖层数据
export interface ScreenCaptureDisplayPayload {
  sessionId: string
  displayId: string
  dataUrl: string
  bounds: WindowBounds
  scaleFactor: number
  width: number
  height: number
  preferences: ScreenshotPreferences
}

// 截图覆盖层会话状态
export interface ScreenCaptureSessionState {
  sessionId: string
  displayId: string
  status: 'idle' | 'active' | 'locked' | 'closed'
  activeDisplayId: string | null
}

// 截图输出动作
export interface ScreenCaptureActionRequest {
  action: 'copy' | 'complete' | 'save'
  dataUrl: string
  width: number
  height: number
  displayId: string
}

// 截图输出动作响应
export interface ScreenCaptureActionResponse {
  status: 'copied' | 'saved' | 'cancelled' | 'error'
  message: string
  path?: string
}

// 置顶截图窗口数据
export interface PinnedWindowData {
  id: string
  dataUrl: string
  width: number
  height: number
  bounds: WindowBounds
  preferences: ScreenshotPreferences
  createdAt: string
}

// 创建置顶截图窗口请求
export interface PinnedWindowCreateRequest {
  dataUrl: string
  width: number
  height: number
  bounds: WindowBounds
  displayId?: string
}

// 创建置顶截图窗口响应
export interface PinnedWindowCreateResponse {
  status: 'pinned' | 'error'
  message: string
  id?: string
}

// 更新置顶截图窗口请求
export interface PinnedWindowUpdateRequest {
  pinnedId: string
  dataUrl: string
  width: number
  height: number
  bounds?: WindowBounds
}

// 更新置顶截图窗口响应
export interface PinnedWindowUpdateResponse {
  status: 'updated' | 'error'
  message: string
}

// 置顶窗口输出动作
export interface PinnedWindowActionRequest {
  pinnedId: string
  action: 'copy' | 'save'
  dataUrl: string
  width: number
  height: number
}

// 图片保存状态
export type ImageSaveStatus = 'saved' | 'cancelled' | 'error'

// 图片保存结果
export interface ImageSaveResult {
  success: boolean
  status: ImageSaveStatus
  path?: string
  message?: string
}

// 屏幕取色图片源
export interface ScreenColorPickerSource {
  displayId: string
  dataUrl: string
  bounds: WindowBounds
  scaleFactor: number
  width: number
  height: number
}

// 屏幕取色覆盖层数据
export interface ScreenColorPickerPayload {
  sources: ScreenColorPickerSource[]
  virtualBounds: WindowBounds
}

// 屏幕取色结果
export interface ScreenColorPickResult {
  hex: string
  rgb: RGB
  point: { x: number; y: number }
  displayId: string
  createdAt: string
}

// 屏幕取色状态
export type ScreenColorPickStatus =
  | 'picked'
  | 'cancelled'
  | 'no-source'
  | 'load-failed'
  | 'timeout'
  | 'busy'
  | 'error'

// 屏幕取色响应
export interface ScreenColorPickResponse {
  status: ScreenColorPickStatus
  message: string
  result?: ScreenColorPickResult
}

// 快捷键标识
export type ShortcutKey =
  | 'toggleWindow'
  | 'clipboard'
  | 'screenshot'
  | 'colorPicker'

// 快捷键注册状态
export type ShortcutRegisterStatus =
  | 'registered'
  | 'failed'
  | 'disabled'
  | 'conflict'
  | 'invalid'

// 快捷键状态项
export interface ShortcutStatusItem {
  key: ShortcutKey
  label: string
  accelerator: string
  enabled: boolean
  registered: boolean
  status: ShortcutRegisterStatus
  description: string
  errorMessage?: string
}

// 快捷键更新请求
export interface ShortcutUpdatePayload {
  key: ShortcutKey
  accelerator: string
  enabled: boolean
}

// 快捷键启用/禁用请求
export interface ShortcutSetEnabledPayload {
  key: ShortcutKey
  enabled: boolean
}

// Electron API 接口
export interface ElectronAPI {
  app: {
    showWindow: () => Promise<void>
    hideWindow: () => Promise<void>
    minimizeWindow: () => Promise<void>
    toggleMaximizeWindow: () => Promise<void>
    toggleWindow: () => Promise<void>
    quit: () => Promise<void>
  }
  setting: {
    get: <T = unknown>(key: string) => Promise<T | null>
    set: (key: string, value: unknown) => Promise<boolean>
    getAll: () => Promise<AppSettings>
    reset: () => Promise<boolean>
    exportConfig: () => Promise<{ success: boolean; path?: string; message: string }>
  }
  geo: {
    openFiles: (filters: GeoFileDialogFilter[]) => Promise<GeoFilePayload[]>
    saveFile: (request: GeoSaveFileRequest) => Promise<GeoSaveFileResult>
    saveArchive: (request: GeoSaveArchiveRequest) => Promise<GeoSaveFileResult>
  }
  streamProxy: {
    start: (request: StreamProxyStartRequest) => Promise<StreamProxyStartResponse>
    stop: (sessionId: string) => Promise<StreamProxyActionResult>
    retry: (sessionId: string) => Promise<StreamProxyActionResult>
    onEvent: (callback: (event: StreamProxyEvent) => void) => () => void
  }
  httpApi: {
    send: (request: HttpApiSendRequest) => Promise<HttpApiSendResult>
    cancel: (requestId: string) => Promise<HttpApiActionResult>
  }
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<ClipboardItem[]>
    getHistory: () => Promise<ClipboardItem[]>
    clearHistory: (keepFavorites?: boolean) => Promise<ClipboardItem[]>
    removeItem: (id: string) => Promise<ClipboardRemoveResult>
    restoreItem: (undoToken: string) => Promise<ClipboardRemoveResult>
    toggleFavorite: (id: string) => Promise<ClipboardItem[]>
    copyItem: (id: string) => Promise<ClipboardCopyResult>
    copyItemText: (id: string) => Promise<ClipboardCopyResult>
    openLink: (id: string) => Promise<ClipboardActionResult>
    showFile: (id: string, path: string) => Promise<ClipboardActionResult>
    saveImage: (id: string) => Promise<ImageSaveResult>
    getImageData: (id: string) => Promise<string | null>
    onHistoryChanged: (callback: (history: ClipboardItem[]) => void) => () => void
  }
  screenshot: {
    copyImageToClipboard: (dataUrl: string) => Promise<boolean>
    saveImage: (dataUrl: string) => Promise<ImageSaveResult>
    pickScreenColor: () => Promise<ScreenColorPickResponse>
    colorPickerReady: () => void
    finishColorPick: (result: ScreenColorPickResult) => void
    cancelColorPick: () => void
    onColorPickerData: (callback: (payload: ScreenColorPickerPayload) => void) => () => void
  }
  screenCapture: {
    start: () => Promise<ScreenCaptureStartResponse>
    overlayReady: () => void
    claim: () => void
    performAction: (request: ScreenCaptureActionRequest) => Promise<ScreenCaptureActionResponse>
    cancel: () => void
    onPayload: (callback: (payload: ScreenCaptureDisplayPayload) => void) => () => void
    onSessionState: (callback: (state: ScreenCaptureSessionState) => void) => () => void
  }
  pinned: {
    create: (request: PinnedWindowCreateRequest) => Promise<PinnedWindowCreateResponse>
    overlayReady: () => void
    update: (request: PinnedWindowUpdateRequest) => Promise<PinnedWindowUpdateResponse>
    performAction: (request: PinnedWindowActionRequest) => Promise<ScreenCaptureActionResponse>
    close: () => void
    onData: (callback: (data: PinnedWindowData) => void) => () => void
  }
  shortcut: {
    getStatus: () => Promise<ShortcutStatusItem[]>
    update: (payload: ShortcutUpdatePayload) => Promise<ShortcutStatusItem[]>
    reset: () => Promise<ShortcutStatusItem[]>
    setEnabled: (payload: ShortcutSetEnabledPayload) => Promise<ShortcutStatusItem[]>
    onNavigate: (callback: (data: { page: string }) => void) => () => void
  }
}
