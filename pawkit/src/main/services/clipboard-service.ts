import { app, BrowserWindow, clipboard, nativeImage, shell } from 'electron'
import type { NativeImage } from 'electron'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { basename, join } from 'path'
import { existsSync } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { nanoid } from 'nanoid'
import {
  ClipboardCopyResult,
  ClipboardActionResult,
  ClipboardFileEntry,
  ClipboardFileItem,
  ClipboardImageItem,
  ClipboardItem,
  ClipboardRemoveResult,
  ClipboardRichTextItem,
  ClipboardTextItem,
  ImageSaveResult
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting, setSetting } from '../store'
import { CLIPBOARD_CONFIG } from './clipboard-config'
import { logger } from '../logger'
import { showSaveDialogSafe } from '../dialog-utils'

type ClipboardSnapshot =
  | {
    type: 'text'
    content: string
    signature: string
    formats: string[]
  }
  | {
    type: 'image'
    content: string
    signature: string
    formats: string[]
    image: NativeImage
    pngBuffer: Buffer
    thumbnailDataUrl: string
    width: number
    height: number
    size: number
    originalSize: number
    originalTooLarge: boolean
  }
  | {
    type: 'file'
    content: string
    signature: string
    formats: string[]
    files: ClipboardFileEntry[]
  }
  | {
    type: 'richText'
    content: string
    signature: string
    formats: string[]
    html?: string
    rtf?: string
  }

// 轮询定时器
let timer: ReturnType<typeof setInterval> | null = null

// 防止异步轮询重入
let checkingClipboard = false

// 上次剪贴板签名
let lastClipboardSignature = ''

// 内部写入保护
let internalWritingSignature = ''
let internalWritingExpireAt = 0

// 存储路径
const STORE_KEY = 'clipboard.history'
const UNDO_EXPIRE_DURATION = 8000

interface RemovedClipboardItem {
  item: ClipboardItem
  index: number
  expiresAt: number
}

// 短期删除撤销记录
const removedClipboardItems = new Map<string, RemovedClipboardItem>()

// 获取剪贴板资源目录
function getClipboardAssetDir(): string {
  return join(app.getPath('userData'), 'clipboard-assets')
}

// 生成稳定签名
function createSignature(type: string, parts: string[]): string {
  const hash = createHash('sha256')
  hash.update(type)
  for (const part of parts) {
    hash.update('\u001f')
    hash.update(part)
  }
  return `${type}:${hash.digest('hex')}`
}

// 清理 HTML 为可读预览
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// 压缩过长预览
function limitPreview(content: string): string {
  if (content.length <= CLIPBOARD_CONFIG.maxPreviewLength) {
    return content
  }
  return `${content.slice(0, CLIPBOARD_CONFIG.maxPreviewLength)}...`
}

// 读取剪贴板 buffer，格式不存在时返回空 buffer
function readClipboardBuffer(format: string): Buffer {
  try {
    return clipboard.readBuffer(format)
  } catch {
    return Buffer.alloc(0)
  }
}

// 从双空结尾字符串解析路径
function parseNullSeparatedPaths(value: string): string[] {
  return value
    .replace(/\0+$/g, '')
    .split(/\0|\r?\n/)
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

// 获取剪贴板历史
export function getClipboardHistory(): ClipboardItem[] {
  return (getSetting<ClipboardItem[]>(STORE_KEY) ?? []) as ClipboardItem[]
}

// 保存剪贴板历史
function saveClipboardHistory(history: ClipboardItem[]): void {
  setSetting(STORE_KEY, history)
}

// 通知渲染层历史记录变化
function notifyClipboardHistoryChanged(history: ClipboardItem[]): void {
  const windows = BrowserWindow.getAllWindows()
  logger.debug('通知渲染层，窗口数:', windows.length, '历史记录数:', history.length)
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.CLIPBOARD_HISTORY_CHANGED, history)
    }
  })
}

// 判断是否是图片历史
function isImageItem(item: ClipboardItem): item is ClipboardImageItem {
  return item.type === 'image'
}

// 删除单个图片资源
async function removeImageAsset(item: ClipboardImageItem): Promise<void> {
  try {
    await unlink(item.imagePath)
  } catch {
    // 图片文件可能已经不存在，忽略即可
  }
}

// 清理不再被历史引用的图片资源
function cleanupRemovedImageAssets(previous: ClipboardItem[], next: ClipboardItem[]): void {
  const nextImagePaths = new Set(
    next.filter(isImageItem).map((item) => item.imagePath)
  )

  previous.filter(isImageItem).forEach((item) => {
    if (!nextImagePaths.has(item.imagePath)) {
      void removeImageAsset(item)
    }
  })
}

// 限制历史记录数量（收藏项永不自动清理，普通项最多保留 maxHistoryCount 条）
function limitClipboardHistory(history: ClipboardItem[]): ClipboardItem[] {
  if (history.length <= CLIPBOARD_CONFIG.maxHistoryCount) {
    return history
  }

  const favoriteList = history.filter((item) => item.favorite)
  const normalList = history.filter((item) => !item.favorite)

  const maxNormalCount = Math.max(
    CLIPBOARD_CONFIG.maxHistoryCount - favoriteList.length,
    0
  )

  const limitedNormalList = normalList.slice(0, maxNormalCount)

  return [...favoriteList, ...limitedNormalList].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

// 持久化并通知历史变化
function persistClipboardHistory(
  previous: ClipboardItem[],
  next: ClipboardItem[],
  options = { cleanupAssets: true }
): ClipboardItem[] {
  const limitedHistory = limitClipboardHistory(next)
  saveClipboardHistory(limitedHistory)
  if (options.cleanupAssets) {
    cleanupRemovedImageAssets(previous, limitedHistory)
  }
  notifyClipboardHistoryChanged(limitedHistory)
  return limitedHistory
}

// 解析 Windows FileNameW 剪贴板格式
function parseWindowsFileNameW(): string[] {
  const buffer = readClipboardBuffer('FileNameW')
  if (buffer.length === 0) return []
  return parseNullSeparatedPaths(buffer.toString('utf16le'))
}

// 解析 Windows FileName 剪贴板格式
function parseWindowsFileName(): string[] {
  const buffer = readClipboardBuffer('FileName')
  if (buffer.length === 0) return []
  return parseNullSeparatedPaths(buffer.toString('utf8'))
}

// 判断文本是否像本地文件路径
function isLikelyFilePath(value: string): boolean {
  return /^[A-Za-z]:\\/.test(value) || /^\\\\/.test(value) || /^file:\/\/\//i.test(value)
}

// 从纯文本中识别复制为路径的文件列表
function parseFilePathsFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)

  if (lines.length === 0) return []
  if (!lines.every(isLikelyFilePath)) return []
  if (!lines.every((item) => existsSync(item.startsWith('file:///') ? decodeURIComponent(item.replace(/^file:\/+/, '')) : item))) {
    return []
  }

  return lines
}

// 从剪贴板读取文件路径
function readClipboardFiles(formats: string[]): ClipboardFileEntry[] {
  const fileFormats = ['FileNameW', 'FileName', 'text/uri-list']
  const hasFileFormat = fileFormats.some((format) => formats.includes(format))
  const text = clipboard.readText()

  const paths = [
    ...(hasFileFormat ? parseWindowsFileNameW() : []),
    ...(hasFileFormat ? parseWindowsFileName() : []),
    ...(formats.includes('text/uri-list') ? parseNullSeparatedPaths(clipboard.read('text/uri-list')) : []),
    ...parseFilePathsFromText(text)
  ]
    .map((value) => value.startsWith('file:///') ? decodeURIComponent(value.replace(/^file:\/+/, '')) : value)
    .filter((value, index, array) => array.indexOf(value) === index)

  return paths.map((path) => ({
    path,
    name: basename(path),
    exists: existsSync(path)
  }))
}

// 为历史保存生成可控尺寸图片
function createStoredImage(image: NativeImage, width: number, height: number, originalSize: number): { buffer: Buffer; tooLarge: boolean } {
  if (originalSize <= CLIPBOARD_CONFIG.maxImageBytes) {
    return {
      buffer: image.toPNG(),
      tooLarge: false
    }
  }

  const maxSize = CLIPBOARD_CONFIG.maxImageStorageSize
  const ratio = Math.min(maxSize / Math.max(width, height), 1)
  const resized = image.resize({
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    quality: 'good'
  })

  return {
    buffer: resized.toPNG(),
    tooLarge: true
  }
}

// 创建图片缩略图
function createImageThumbnail(image: NativeImage, width: number, height: number): string {
  const maxSize = CLIPBOARD_CONFIG.maxImageThumbnailSize
  const ratio = Math.min(maxSize / Math.max(width, height), 1)
  const thumbnail = image.resize({
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    quality: 'good'
  })
  return thumbnail.toDataURL()
}

// 读取当前系统剪贴板快照
async function readCurrentClipboardSnapshot(): Promise<ClipboardSnapshot | null> {
  const formats = clipboard.availableFormats()
  // logger.debug('剪贴板格式:', formats.join(', ') || '无')

  const files = readClipboardFiles(formats)
  if (files.length > 0) {
    const content = files.map((file) => file.path).join('\n')
    logger.debug('剪贴板判定为文件:', files.length)
    return {
      type: 'file',
      content,
      signature: createSignature('file', files.map((file) => file.path)),
      formats,
      files
    }
  }

  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const { width, height } = image.getSize()
    const originalPngBuffer = image.toPNG()
    const storedImage = createStoredImage(image, width, height, originalPngBuffer.length)
    logger.debug(
      '剪贴板判定为图片:',
      `${width}x${height}`,
      '原始大小:',
      originalPngBuffer.length,
      '保存大小:',
      storedImage.buffer.length,
      '压缩保存:',
      storedImage.tooLarge
    )

    return {
      type: 'image',
      content: `图片 ${width} × ${height}`,
      signature: createSignature('image', [createHash('sha256').update(originalPngBuffer).digest('hex')]),
      formats,
      image,
      pngBuffer: storedImage.buffer,
      thumbnailDataUrl: createImageThumbnail(image, width, height),
      width,
      height,
      size: storedImage.buffer.length,
      originalSize: originalPngBuffer.length,
      originalTooLarge: storedImage.tooLarge
    }
  }

  const html = clipboard.readHTML()
  const rtf = clipboard.readRTF()
  const text = clipboard.readText()
  if (html || rtf) {
    const content = limitPreview(text || stripHtml(html) || '富文本内容')
    logger.debug('剪贴板判定为富文本:', Boolean(html), Boolean(rtf))
    return {
      type: 'richText',
      content,
      signature: createSignature('richText', [text, html, rtf]),
      formats,
      html: html || undefined,
      rtf: rtf || undefined
    }
  }

  if (text.length === 0) {
    logger.debug('剪贴板为空或暂不支持的格式')
    return null
  }

  logger.debug('剪贴板判定为文本:', text.length)
  return {
    type: 'text',
    content: text,
    signature: createSignature('text', [text]),
    formats
  }
}

// 创建历史项
async function createClipboardItem(snapshot: ClipboardSnapshot): Promise<ClipboardItem | null> {
  const now = new Date().toISOString()
  const base = {
    id: nanoid(),
    content: snapshot.content,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    signature: snapshot.signature,
    formats: snapshot.formats
  }

  if (snapshot.type === 'text') {
    if (snapshot.content.length === 0 || snapshot.content.length > CLIPBOARD_CONFIG.maxTextLength) {
      return null
    }
    return {
      ...base,
      type: 'text'
    } satisfies ClipboardTextItem
  }

  if (snapshot.type === 'image') {
    const imageDir = getClipboardAssetDir()
    await mkdir(imageDir, { recursive: true })
    const imagePath = join(imageDir, `${base.id}.png`)
    await writeFile(imagePath, snapshot.pngBuffer)

    return {
      ...base,
      type: 'image',
      imagePath,
      thumbnailDataUrl: snapshot.thumbnailDataUrl,
      width: snapshot.width,
      height: snapshot.height,
      size: snapshot.size,
      originalSize: snapshot.originalSize,
      originalTooLarge: snapshot.originalTooLarge
    } satisfies ClipboardImageItem
  }

  if (snapshot.type === 'file') {
    return {
      ...base,
      type: 'file',
      files: snapshot.files
    } satisfies ClipboardFileItem
  }

  return {
    ...base,
    type: 'richText',
    html: snapshot.html,
    rtf: snapshot.rtf
  } satisfies ClipboardRichTextItem
}

// 刷新重复历史项
function refreshExistingItem(item: ClipboardItem, snapshot: ClipboardSnapshot): ClipboardItem {
  const updatedAt = new Date().toISOString()

  if (snapshot.type === 'file' && item.type === 'file') {
    return {
      ...item,
      content: snapshot.content || item.content,
      formats: snapshot.formats,
      signature: snapshot.signature,
      updatedAt,
      files: snapshot.files
    } satisfies ClipboardFileItem
  }

  if (snapshot.type === 'richText' && item.type === 'richText') {
    return {
      ...item,
      content: snapshot.content || item.content,
      formats: snapshot.formats,
      signature: snapshot.signature,
      updatedAt,
      html: snapshot.html,
      rtf: snapshot.rtf
    } satisfies ClipboardRichTextItem
  }

  return {
    ...item,
    content: snapshot.content || item.content,
    formats: snapshot.formats,
    signature: snapshot.signature,
    updatedAt
  }
}

// 添加剪贴板快照
async function addClipboardSnapshot(snapshot: ClipboardSnapshot): Promise<ClipboardItem[]> {
  if (snapshot.type === 'text' && snapshot.content.length === 0) {
    logger.debug('忽略空文本')
    return getClipboardHistory()
  }

  if (snapshot.type === 'text' && snapshot.content.length > CLIPBOARD_CONFIG.maxTextLength) {
    logger.debug('文本过长，忽略:', snapshot.content.length)
    return getClipboardHistory()
  }

  const history = getClipboardHistory()
  const existingItem = history.find((item) => item.signature === snapshot.signature)

  let nextHistory: ClipboardItem[]

  if (existingItem) {
    nextHistory = [
      refreshExistingItem(existingItem, snapshot),
      ...history.filter((item) => item.id !== existingItem.id)
    ]
  } else {
    const newItem = await createClipboardItem(snapshot)
    if (!newItem) {
      return history
    }
    nextHistory = [newItem, ...history]
  }

  return persistClipboardHistory(history, nextHistory)
}

// 添加剪贴板文本
export async function addClipboardText(content: string): Promise<ClipboardItem[]> {
  const text = content
  const snapshot: ClipboardSnapshot = {
    type: 'text',
    content: text,
    signature: createSignature('text', [text]),
    formats: ['text/plain']
  }
  return await addClipboardSnapshot(snapshot)
}

// 设置内部写入保护
function markInternalWrite(signature: string): void {
  internalWritingSignature = signature
  internalWritingExpireAt = Date.now() + CLIPBOARD_CONFIG.internalWriteProtectDuration
  lastClipboardSignature = signature
}

// 写入剪贴板文本
export async function writeClipboardText(content: string): Promise<ClipboardItem[]> {
  const text = content

  if (text.length === 0) {
    return getClipboardHistory()
  }

  const signature = createSignature('text', [text])
  markInternalWrite(signature)
  clipboard.writeText(text)

  return await addClipboardText(text)
}

// 用 PowerShell 写入 Windows 文件剪贴板
function writeWindowsFileClipboard(paths: string[]): Promise<boolean> {
  if (process.platform !== 'win32' || paths.length === 0) {
    return Promise.resolve(false)
  }

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$json = [Console]::In.ReadToEnd()',
    '$paths = ConvertFrom-Json $json',
    '$list = New-Object System.Collections.Specialized.StringCollection',
    'foreach ($path in $paths) { [void]$list.Add([string]$path) }',
    '[System.Windows.Forms.Clipboard]::SetFileDropList($list)'
  ].join('; ')

  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true }
    )
    let settled = false

    child.on('error', (error) => {
      if (settled) return
      settled = true
      logger.warn('写入文件剪贴板失败:', error)
      resolve(false)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      resolve(code === 0)
    })

    child.stdin.end(JSON.stringify(paths))
  })
}

// 触碰历史项并移动到顶部
function touchClipboardItem(id: string): ClipboardItem[] {
  const history = getClipboardHistory()
  const target = history.find((item) => item.id === id)
  if (!target) return history

  const nextHistory = [
    { ...target, updatedAt: new Date().toISOString() },
    ...history.filter((item) => item.id !== id)
  ]
  return persistClipboardHistory(history, nextHistory)
}

// 复制历史项到系统剪贴板
export async function copyClipboardItem(id: string): Promise<ClipboardCopyResult> {
  const history = getClipboardHistory()
  const item = history.find((entry) => entry.id === id)
  if (!item) {
    return {
      success: false,
      history,
      message: '剪贴板记录不存在'
    }
  }

  const signature = item.signature ?? createSignature(item.type, [item.content])
  markInternalWrite(signature)
  let fallback = false
  let message = '已复制到剪贴板'

  if (item.type === 'text') {
    clipboard.writeText(item.content)
  } else if (item.type === 'image') {
    const image = nativeImage.createFromPath(item.imagePath)
    if (image.isEmpty()) {
      fallback = true
      message = '图片文件不可用，已复制图片说明'
      clipboard.writeText(item.content)
    } else {
      clipboard.writeImage(image)
      message = item.originalTooLarge ? '已复制压缩版图片' : '已复制图片'
    }
  } else if (item.type === 'file') {
    const paths = item.files.map((file) => file.path)
    const written = await writeWindowsFileClipboard(paths)
    if (!written) {
      const fallback = paths.join('\r\n')
      markInternalWrite(createSignature('text', [fallback]))
      clipboard.writeText(fallback)
      return {
        success: true,
        history: touchClipboardItem(id),
        fallback: true,
        message: '文件对象写回失败，已复制文件路径'
      }
    }
    message = '已复制文件，可在资源管理器粘贴'
  } else {
    clipboard.write({
      text: item.content,
      html: item.html,
      rtf: item.rtf
    })
    message = '已复制富文本'
  }

  return {
    success: true,
    history: touchClipboardItem(id),
    fallback,
    message
  }
}

// 以纯文本复制历史项
export async function copyClipboardItemAsText(id: string): Promise<ClipboardCopyResult> {
  const history = getClipboardHistory()
  const item = history.find((entry) => entry.id === id)
  if (!item) {
    return {
      success: false,
      history,
      message: '剪贴板记录不存在'
    }
  }

  const text = item.type === 'file'
    ? item.files.map((file) => file.path).join('\r\n')
    : item.content

  markInternalWrite(createSignature('text', [text]))
  clipboard.writeText(text)

  return {
    success: true,
    history: touchClipboardItem(id),
    message: item.type === 'file' ? '文件路径已复制' : '纯文本已复制'
  }
}

// 打开历史中的链接
export async function openClipboardLink(id: string): Promise<ClipboardActionResult> {
  const item = getClipboardHistory().find((entry) => entry.id === id)
  if (!item || item.type !== 'text') {
    return { success: false, message: '当前记录不是链接' }
  }

  try {
    const url = new URL(item.content.trim())
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { success: false, message: '仅支持打开 HTTP 或 HTTPS 链接' }
    }
    await shell.openExternal(url.toString())
    return { success: true, message: '已用默认浏览器打开链接' }
  } catch (error) {
    logger.warn('打开剪贴板链接失败:', error)
    return { success: false, message: '链接无效或无法打开' }
  }
}

// 在资源管理器中定位历史文件
export function showClipboardFile(id: string, path: string): ClipboardActionResult {
  const item = getClipboardHistory().find((entry) => entry.id === id)
  if (!item || item.type !== 'file') {
    return { success: false, message: '当前记录不是文件' }
  }

  const file = item.files.find((entry) => entry.path === path)
  if (!file || !existsSync(file.path)) {
    return { success: false, message: '文件已失效或不存在' }
  }

  shell.showItemInFolder(file.path)
  return { success: true, message: '已在资源管理器中定位文件' }
}

// 保存历史中的图片
export async function saveClipboardImage(id: string): Promise<ImageSaveResult> {
  const item = getClipboardHistory().find((entry) => entry.id === id)
  if (!item || item.type !== 'image') {
    return { success: false, status: 'error', message: '当前记录不是图片' }
  }

  try {
    if (!existsSync(item.imagePath)) {
      return { success: false, status: 'error', message: '图片文件已失效' }
    }

    const result = await showSaveDialogSafe({
      title: '保存剪贴板图片',
      defaultPath: `clipboard-${Date.now()}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, status: 'cancelled', message: '保存已取消' }
    }

    const buffer = await readFile(item.imagePath)
    await writeFile(result.filePath, buffer)
    return { success: true, status: 'saved', path: result.filePath, message: '图片保存成功' }
  } catch (error) {
    logger.error('保存剪贴板图片失败:', error)
    return { success: false, status: 'error', message: '图片保存失败' }
  }
}

// 读取历史图片用于详情预览
export function getClipboardImageData(id: string): string | null {
  const item = getClipboardHistory().find((entry) => entry.id === id)
  if (!item || item.type !== 'image' || !existsSync(item.imagePath)) {
    return null
  }

  const image = nativeImage.createFromPath(item.imagePath)
  return image.isEmpty() ? null : image.toDataURL()
}

// 删除单条记录
export function removeClipboardItem(id: string): ClipboardRemoveResult {
  const history = getClipboardHistory()
  const index = history.findIndex((item) => item.id === id)
  if (index < 0) {
    return {
      success: false,
      history,
      message: '剪贴板记录不存在'
    }
  }

  const item = history[index]
  const nextHistory = history.filter((item) => item.id !== id)
  const undoToken = nanoid()
  removedClipboardItems.set(undoToken, {
    item,
    index,
    expiresAt: Date.now() + UNDO_EXPIRE_DURATION
  })

  const persisted = persistClipboardHistory(history, nextHistory, { cleanupAssets: false })
  setTimeout(() => {
    const removed = removedClipboardItems.get(undoToken)
    if (!removed) return
    removedClipboardItems.delete(undoToken)
    if (removed.item.type === 'image') {
      void removeImageAsset(removed.item)
    }
  }, UNDO_EXPIRE_DURATION)

  return {
    success: true,
    history: persisted,
    undoToken,
    message: '已删除剪贴板记录'
  }
}

// 撤销删除单条记录
export function restoreClipboardItem(undoToken: string): ClipboardRemoveResult {
  const history = getClipboardHistory()
  const removed = removedClipboardItems.get(undoToken)
  if (!removed || removed.expiresAt < Date.now()) {
    removedClipboardItems.delete(undoToken)
    return {
      success: false,
      history,
      message: '撤销时间已过'
    }
  }

  removedClipboardItems.delete(undoToken)
  if (history.some((item) => item.id === removed.item.id)) {
    return {
      success: false,
      history,
      message: '剪贴板记录已存在'
    }
  }

  const nextHistory = [...history]
  nextHistory.splice(Math.min(removed.index, nextHistory.length), 0, removed.item)
  return {
    success: true,
    history: persistClipboardHistory(history, nextHistory),
    message: '已撤销删除'
  }
}

// 清空历史记录
export function clearClipboardHistory(options = { keepFavorites: true }): ClipboardItem[] {
  const history = getClipboardHistory()

  const nextHistory = options.keepFavorites
    ? history.filter((item) => item.favorite)
    : []

  return persistClipboardHistory(history, nextHistory)
}

// 切换收藏状态
export function toggleClipboardFavorite(id: string): ClipboardItem[] {
  const history = getClipboardHistory()

  const nextHistory = history.map((item) => {
    if (item.id !== id) return item
    return {
      ...item,
      favorite: !item.favorite,
      updatedAt: new Date().toISOString()
    }
  })

  return persistClipboardHistory(history, nextHistory)
}

// 检测剪贴板变化
async function checkClipboardChange(): Promise<void> {
  if (checkingClipboard) return
  checkingClipboard = true

  try {
    const snapshot = await readCurrentClipboardSnapshot()
    if (!snapshot) return

    if (snapshot.signature === lastClipboardSignature) return

    const now = Date.now()
    const isInternalWrite =
      snapshot.signature === internalWritingSignature &&
      now <= internalWritingExpireAt

    logger.debug('检测到剪贴板变化:', snapshot.type, '内部写入:', isInternalWrite)

    lastClipboardSignature = snapshot.signature

    if (isInternalWrite) {
      return
    }

    await addClipboardSnapshot(snapshot)
  } catch (error) {
    logger.warn('检测剪贴板变化失败:', error)
  } finally {
    checkingClipboard = false
  }
}

// 启动剪贴板监听
export function startClipboardWatch(): void {
  if (timer) return

  void readCurrentClipboardSnapshot().then((snapshot) => {
    if (!snapshot) return
    lastClipboardSignature = snapshot.signature
    void addClipboardSnapshot(snapshot)
  }).catch((error) => {
    logger.warn('初始化剪贴板监听失败:', error)
  })

  logger.debug('剪贴板监听已启动')

  timer = setInterval(() => {
    void checkClipboardChange()
  }, CLIPBOARD_CONFIG.pollInterval)
}

// 停止剪贴板监听
export function stopClipboardWatch(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
