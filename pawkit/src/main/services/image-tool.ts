import { BrowserWindow, clipboard, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, extname, join, parse } from 'path'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import type { OutputInfo } from 'sharp'
import type {
  ClipboardActionResult,
  ClipboardImageItem,
  ImagePaletteColor,
  ImageToolBatchItemResult,
  ImageToolBatchProgress,
  ImageToolBatchRequest,
  ImageToolBatchResponse,
  ImageToolFormat,
  ImageToolMetadata,
  ImageToolProcessOptions,
  ImageToolProcessRequest,
  ImageToolProcessResponse,
  ImageToolResultRef,
  ImageToolSaveResult,
  ImageToolSendRequest,
  ImageToolSourceKind,
  ImageToolSourceRef,
  RGB
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { logger } from '../logger'
import { showOpenDialogSafe, showSaveDialogSafe } from '../dialog-utils'
import { getClipboardHistory } from './clipboard-service'

interface StoredImageSource {
  ref: ImageToolSourceRef
  buffer: Buffer
  tempPath: string
}

interface StoredImageResult {
  ref: ImageToolResultRef
  buffer: Buffer
  tempPath: string
}

interface EncodedImage {
  buffer: Buffer
  info: OutputInfo
  format: ImageToolFormat
  mimeType: string
}

interface IconPngBuffer {
  size: number
  buffer: Buffer
}

const sourceRegistry = new Map<string, StoredImageSource>()
const resultRegistry = new Map<string, StoredImageResult>()
const tempRoot = join(tmpdir(), 'pawkit-image-tool')
const defaultIconSizes = [16, 24, 32, 48, 64, 128, 256, 512]
const imageFilters = [
  { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'tiff', 'tif', 'bmp', 'ico'] },
  { name: '所有文件', extensions: ['*'] }
]

const formatMimeMap: Record<ImageToolFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/vnd.microsoft.icon'
}

const formatExtensionMap: Record<ImageToolFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  ico: 'ico'
}

// 将数值限制在范围内
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// 转换 RGB 到 HEX
function rgbToHex(rgb: RGB): string {
  const part = (value: number): string => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`
}

// 转换 RGB 到 HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: Math.round(lightness * 100) }

  const difference = max - min
  const saturation = lightness > 0.5 ? difference / (2 - max - min) : difference / (max + min)
  let hue = 0
  if (max === rn) hue = ((gn - bn) / difference + (gn < bn ? 6 : 0)) / 6
  if (max === gn) hue = ((bn - rn) / difference + 2) / 6
  if (max === bn) hue = ((rn - gn) / difference + 4) / 6

  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  }
}

// 判断是否是有效 HEX 颜色
function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

// 转义 SVG 文本
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 生成时间戳文件名
function formatTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds())
  ].join('')
}

// 获取扩展名对应格式
function normalizeFormat(format?: string): ImageToolFormat {
  const value = (format ?? '').toLowerCase().replace('jpg', 'jpeg')
  if (value === 'png' || value === 'jpeg' || value === 'webp' || value === 'avif' || value === 'ico') return value
  return 'png'
}

// 获取格式 MIME
function getMimeType(format: ImageToolFormat): string {
  return formatMimeMap[format]
}

// 生成安全文件名
function sanitizeFileName(name: string): string {
  return [...name]
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .trim() || 'image'
}

// 将 Buffer 转为独立 ArrayBuffer
function toTightArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  return arrayBuffer
}

// 写入临时图片文件
async function writeTempBuffer(buffer: Buffer, extension: string): Promise<string> {
  await mkdir(tempRoot, { recursive: true })
  const tempPath = join(tempRoot, `${Date.now()}-${nanoid()}.${extension}`)
  await writeFile(tempPath, buffer)
  return tempPath
}

// 解析 Data URL 图片
export function parseImageDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
  if (!match) {
    throw new Error('不是有效的图片 Data URL')
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  }
}

// 规范化图片处理参数
export function normalizeImageToolOptions(options: ImageToolProcessOptions): ImageToolProcessOptions {
  const format = normalizeFormat(options.format)
  const quality = clamp(Math.round(Number.isFinite(options.quality) ? options.quality : 82), 1, 100)
  const metadataStrategy = options.metadataStrategy === 'keep' ? 'keep' : 'strip'
  const rotate = Number.isFinite(options.rotate ?? 0) ? Math.round(options.rotate ?? 0) : 0
  const resize = options.resize?.enabled ? {
    enabled: true,
    width: options.resize.width && options.resize.width > 0 ? Math.round(options.resize.width) : undefined,
    height: options.resize.height && options.resize.height > 0 ? Math.round(options.resize.height) : undefined,
    mode: options.resize.mode,
    withoutEnlargement: options.resize.withoutEnlargement !== false
  } : { enabled: false, mode: 'inside' as const, withoutEnlargement: true }

  return {
    format,
    quality,
    metadataStrategy,
    crop: options.crop?.enabled ? {
      enabled: true,
      left: Math.max(0, Math.round(options.crop.left)),
      top: Math.max(0, Math.round(options.crop.top)),
      width: Math.max(1, Math.round(options.crop.width)),
      height: Math.max(1, Math.round(options.crop.height))
    } : { enabled: false, left: 0, top: 0, width: 1, height: 1 },
    resize,
    rotate,
    flip: options.flip === true,
    flop: options.flop === true,
    background: options.background?.enabled && isValidHexColor(options.background.color)
      ? { enabled: true, color: options.background.color }
      : { enabled: false, color: '#ffffff' },
    roundedCorners: options.roundedCorners?.enabled
      ? { enabled: true, radius: clamp(Math.round(options.roundedCorners.radius), 1, 4096) }
      : { enabled: false, radius: 0 },
    watermark: options.watermark?.enabled && options.watermark.text.trim()
      ? {
        enabled: true,
        text: options.watermark.text.slice(0, 120),
        position: options.watermark.position,
        opacity: clamp(options.watermark.opacity, 0.05, 1),
        fontSize: clamp(Math.round(options.watermark.fontSize), 8, 240),
        color: isValidHexColor(options.watermark.color) ? options.watermark.color : '#ffffff'
      }
      : { enabled: false, text: '', position: 'bottom-right', opacity: 0.6, fontSize: 28, color: '#ffffff' },
    icon: {
      sizes: normalizeIconSizes(options.icon?.sizes),
      exportPngSet: options.icon?.exportPngSet === true
    }
  }
}

// 规范化图标尺寸
function normalizeIconSizes(sizes?: number[]): number[] {
  const normalized = (Array.isArray(sizes) && sizes.length > 0 ? sizes : defaultIconSizes)
    .map((size) => Math.round(size))
    .filter((size) => size >= 16 && size <= 512)
  return [...new Set(normalized)].sort((left, right) => left - right)
}

// 创建图片元信息
async function createImageMetadata(buffer: Buffer, size: number, fallbackFormat?: ImageToolFormat): Promise<ImageToolMetadata> {
  const metadata = await sharp(buffer, { failOn: 'none' }).metadata()
  const format = normalizeFormat(metadata.format ?? fallbackFormat)
  return {
    format,
    mimeType: getMimeType(format),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    size,
    density: metadata.density,
    colorSpace: metadata.space,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
    createdAt: new Date().toISOString()
  }
}

// 生成图片预览 Data URL
async function createPreviewDataUrl(buffer: Buffer): Promise<string> {
  const preview = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 720, height: 480, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  return `data:image/png;base64,${preview.toString('base64')}`
}

// 提取图片色板
export async function extractImagePalette(buffer: Buffer, maxColors = 8): Promise<ImagePaletteColor[]> {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buckets = new Map<string, { rgb: RGB; count: number }>()
  let total = 0

  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3] ?? 255
    if (alpha < 24) continue
    const rgb = {
      r: Math.round(data[index] / 24) * 24,
      g: Math.round(data[index + 1] / 24) * 24,
      b: Math.round(data[index + 2] / 24) * 24
    }
    const key = `${rgb.r}-${rgb.g}-${rgb.b}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count += 1
    } else {
      buckets.set(key, { rgb, count: 1 })
    }
    total += 1
  }

  return [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, maxColors)
    .map((item) => ({
      hex: rgbToHex(item.rgb),
      rgb: item.rgb,
      hsl: rgbToHsl(item.rgb.r, item.rgb.g, item.rgb.b),
      ratio: total > 0 ? Number((item.count / total).toFixed(4)) : 0,
      count: item.count
    }))
}

// 创建图片源引用
async function createImageSourceRef(
  buffer: Buffer,
  name: string,
  kind: ImageToolSourceKind,
  path?: string
): Promise<ImageToolSourceRef> {
  const metadata = await createImageMetadata(buffer, buffer.byteLength)
  if (!metadata.width || !metadata.height) {
    throw new Error('图片尺寸无效')
  }
  const palette = await extractImagePalette(buffer)
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    name: sanitizeFileName(name),
    kind,
    format: metadata.format,
    mimeType: metadata.mimeType,
    width: metadata.width,
    height: metadata.height,
    size: buffer.byteLength,
    previewDataUrl: await createPreviewDataUrl(buffer),
    path,
    metadata,
    dominantColor: palette[0],
    palette,
    createdAt: now
  }
}

// 创建图片结果引用
async function createImageResultRef(
  sourceId: string,
  buffer: Buffer,
  name: string,
  format: ImageToolFormat
): Promise<ImageToolResultRef> {
  const metadata = format === 'ico'
    ? await createIconMetadata(buffer, format)
    : await createImageMetadata(buffer, buffer.byteLength, format)
  const palette = format === 'ico' ? [] : await extractImagePalette(buffer)
  const previewDataUrl = format === 'ico'
    ? await createPreviewDataUrl(readFirstPngFromIco(buffer) ?? buffer)
    : `data:${metadata.mimeType};base64,${buffer.toString('base64')}`

  return {
    id: nanoid(),
    sourceId,
    name: sanitizeFileName(name),
    format,
    mimeType: metadata.mimeType,
    width: metadata.width,
    height: metadata.height,
    size: buffer.byteLength,
    previewDataUrl,
    metadata,
    dominantColor: palette[0],
    palette,
    createdAt: new Date().toISOString()
  }
}

// 创建 ICO 元信息
async function createIconMetadata(buffer: Buffer, format: ImageToolFormat): Promise<ImageToolMetadata> {
  const firstPng = readFirstPngFromIco(buffer)
  const metadata = firstPng
    ? await createImageMetadata(firstPng, buffer.byteLength, 'png')
    : {
      format,
      mimeType: getMimeType(format),
      width: 0,
      height: 0,
      size: buffer.byteLength,
      createdAt: new Date().toISOString()
    }
  return {
    ...metadata,
    format,
    mimeType: getMimeType(format),
    size: buffer.byteLength
  }
}

// 注册图片源
async function registerSource(buffer: Buffer, name: string, kind: ImageToolSourceKind, path?: string): Promise<ImageToolSourceRef> {
  const ref = await createImageSourceRef(buffer, name, kind, path)
  const extension = normalizeFormat(ref.format) === 'jpeg' ? 'jpg' : normalizeFormat(ref.format)
  const tempPath = await writeTempBuffer(buffer, extension)
  sourceRegistry.set(ref.id, { ref, buffer, tempPath })
  return ref
}

// 注册图片处理结果
async function registerResult(sourceId: string, buffer: Buffer, name: string, format: ImageToolFormat): Promise<ImageToolResultRef> {
  const ref = await createImageResultRef(sourceId, buffer, name, format)
  const tempPath = await writeTempBuffer(buffer, formatExtensionMap[format])
  resultRegistry.set(ref.id, { ref, buffer, tempPath })
  return ref
}

// 打开本地图片文件
export async function openImageFiles(ownerWindow?: BrowserWindow | null): Promise<ImageToolSourceRef[]> {
  const result = await showOpenDialogSafe({
    title: '导入图片',
    properties: ['openFile', 'multiSelections'],
    filters: imageFilters
  }, ownerWindow)

  if (result.canceled || result.filePaths.length === 0) return []

  const sources: ImageToolSourceRef[] = []
  for (const filePath of result.filePaths) {
    try {
      sources.push(await registerSource(await readFile(filePath), basename(filePath), 'file', filePath))
    } catch (error) {
      logger.warn('导入图片失败:', filePath, error)
    }
  }
  return sources
}

// 导入当前剪贴板图片
export async function importClipboardImage(): Promise<ImageToolSourceRef | null> {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  const buffer = image.toPNG()
  return await registerSource(buffer, `clipboard-${formatTimestamp()}.png`, 'clipboard')
}

// 导入剪贴板历史图片
export async function importClipboardHistoryImage(id: string): Promise<ImageToolSourceRef | null> {
  const item = getClipboardHistory().find((entry): entry is ClipboardImageItem => entry.id === id && entry.type === 'image')
  if (!item || !existsSync(item.imagePath)) return null
  return await registerSource(await readFile(item.imagePath), `clipboard-${id}.png`, 'clipboard-history', item.imagePath)
}

// 导入 Data URL 图片
export async function importImageDataUrl(dataUrl: string, name = `data-url-${formatTimestamp()}.png`): Promise<ImageToolSourceRef | null> {
  try {
    const { buffer } = parseImageDataUrl(dataUrl)
    return await registerSource(buffer, name, 'data-url')
  } catch (error) {
    logger.warn('导入 Data URL 图片失败:', error)
    return null
  }
}

// 从其他工具发送图片到图片处理工作台
export async function sendImageToTool(request: ImageToolSendRequest): Promise<ImageToolSourceRef | null> {
  const source = await importImageDataUrl(
    request.dataUrl,
    request.name || `${request.sourceKind ?? 'image'}-${formatTimestamp()}.png`
  )
  if (!source) return null
  const nextSource = { ...source, kind: request.sourceKind ?? source.kind }
  const stored = sourceRegistry.get(source.id)
  if (stored) {
    stored.ref = nextSource
    sourceRegistry.set(source.id, stored)
  }
  broadcastImageToolSource(nextSource)
  return nextSource
}

// 广播跨工具打开图片源
function broadcastImageToolSource(source: ImageToolSourceRef): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.IMAGE_TOOL_OPEN_SOURCE, source)
    }
  })
}

// 发送批量处理进度
function sendBatchProgress(ownerWindow: BrowserWindow | null | undefined, progress: ImageToolBatchProgress): void {
  const targets = ownerWindow && !ownerWindow.isDestroyed() ? [ownerWindow] : BrowserWindow.getAllWindows()
  targets.forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.IMAGE_TOOL_BATCH_PROGRESS, progress)
    }
  })
}

// 应用基础图片变换
async function applyBaseOperations(buffer: Buffer, options: ImageToolProcessOptions): Promise<{ buffer: Buffer; info: OutputInfo }> {
  const normalized = normalizeImageToolOptions(options)
  let pipeline = sharp(buffer, { failOn: 'none' }).rotate()

  const sourceMetadata = await sharp(buffer, { failOn: 'none' }).rotate().metadata()
  const sourceWidth = sourceMetadata.width ?? 0
  const sourceHeight = sourceMetadata.height ?? 0

  if (normalized.crop?.enabled && sourceWidth > 0 && sourceHeight > 0) {
    const left = clamp(normalized.crop.left, 0, sourceWidth - 1)
    const top = clamp(normalized.crop.top, 0, sourceHeight - 1)
    const width = clamp(normalized.crop.width, 1, sourceWidth - left)
    const height = clamp(normalized.crop.height, 1, sourceHeight - top)
    pipeline = pipeline.extract({ left, top, width, height })
  }

  if (normalized.rotate) pipeline = pipeline.rotate(normalized.rotate)
  if (normalized.flip) pipeline = pipeline.flip()
  if (normalized.flop) pipeline = pipeline.flop()

  if (normalized.resize?.enabled && (normalized.resize.width || normalized.resize.height)) {
    pipeline = pipeline.resize({
      width: normalized.resize.width,
      height: normalized.resize.height,
      fit: normalized.resize.mode,
      withoutEnlargement: normalized.resize.withoutEnlargement,
      background: normalized.background?.enabled ? normalized.background.color : '#ffffff'
    })
  }

  if (normalized.background?.enabled) {
    pipeline = pipeline.flatten({ background: normalized.background.color })
  }

  let output = await pipeline.png().toBuffer({ resolveWithObject: true })

  if (normalized.roundedCorners?.enabled) {
    output = await applyRoundedCorners(output.data, output.info, normalized.roundedCorners.radius)
  }

  if (normalized.watermark?.enabled) {
    output = await applyTextWatermark(output.data, output.info, normalized.watermark)
  }

  return { buffer: output.data, info: output.info }
}

// 应用圆角蒙版
async function applyRoundedCorners(buffer: Buffer, info: OutputInfo, radius: number): Promise<{ data: Buffer; info: OutputInfo }> {
  const roundedRadius = clamp(radius, 1, Math.floor(Math.min(info.width, info.height) / 2))
  const svg = Buffer.from(`
    <svg width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}">
      <rect x="0" y="0" width="${info.width}" height="${info.height}" rx="${roundedRadius}" ry="${roundedRadius}" fill="#fff"/>
    </svg>
  `)
  return await sharp(buffer, { failOn: 'none' })
    .composite([{ input: svg, blend: 'dest-in' }])
    .png()
    .toBuffer({ resolveWithObject: true })
}

// 应用文字水印
async function applyTextWatermark(
  buffer: Buffer,
  info: OutputInfo,
  watermark: NonNullable<ImageToolProcessOptions['watermark']>
): Promise<{ data: Buffer; info: OutputInfo }> {
  const padding = Math.max(12, Math.round(watermark.fontSize * 0.8))
  const anchor = watermark.position.includes('right') ? 'end' : watermark.position === 'center' ? 'middle' : 'start'
  const x = watermark.position.includes('right')
    ? info.width - padding
    : watermark.position === 'center'
      ? Math.round(info.width / 2)
      : padding
  const y = watermark.position.includes('top')
    ? padding + watermark.fontSize
    : watermark.position === 'center'
      ? Math.round(info.height / 2)
      : info.height - padding
  const svg = Buffer.from(`
    <svg width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}">
      <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
        font-family="Arial, Microsoft YaHei, sans-serif" font-size="${watermark.fontSize}"
        fill="${watermark.color}" fill-opacity="${watermark.opacity}">${escapeXml(watermark.text)}</text>
    </svg>
  `)
  return await sharp(buffer, { failOn: 'none' })
    .composite([{ input: svg }])
    .png()
    .toBuffer({ resolveWithObject: true })
}

// 编码为目标格式
async function encodeImage(buffer: Buffer, options: ImageToolProcessOptions): Promise<EncodedImage> {
  const normalized = normalizeImageToolOptions(options)
  if (normalized.format === 'ico') {
    const iconBuffers = await createIconPngBuffers(buffer, normalized.icon?.sizes ?? defaultIconSizes)
    return {
      buffer: createIcoBuffer(iconBuffers),
      info: { format: 'ico', width: iconBuffers.at(-1)?.size ?? 0, height: iconBuffers.at(-1)?.size ?? 0, channels: 4, size: 0, premultiplied: false } as OutputInfo,
      format: 'ico',
      mimeType: getMimeType('ico')
    }
  }

  let pipeline = sharp(buffer, { failOn: 'none' })
  if (normalized.metadataStrategy === 'keep') pipeline = pipeline.withMetadata()

  if (normalized.format === 'jpeg') {
    pipeline = pipeline.flatten({ background: normalized.background?.enabled ? normalized.background.color : '#ffffff' }).jpeg({ quality: normalized.quality, mozjpeg: true })
  } else if (normalized.format === 'webp') {
    pipeline = pipeline.webp({ quality: normalized.quality })
  } else if (normalized.format === 'avif') {
    pipeline = pipeline.avif({ quality: normalized.quality })
  } else {
    const compressionLevel = clamp(Math.round((100 - normalized.quality) / 100 * 9), 0, 9)
    pipeline = pipeline.png({ compressionLevel })
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true })
  return {
    buffer: output.data,
    info: output.info,
    format: normalized.format,
    mimeType: getMimeType(normalized.format)
  }
}

// 处理图片 Buffer
export async function processImageBuffer(buffer: Buffer, options: ImageToolProcessOptions): Promise<EncodedImage> {
  const base = await applyBaseOperations(buffer, options)
  return await encodeImage(base.buffer, options)
}

// 创建 ICO 内的 PNG 尺寸
async function createIconPngBuffers(buffer: Buffer, sizes: number[]): Promise<IconPngBuffer[]> {
  const normalizedSizes = normalizeIconSizes(sizes)
  return await Promise.all(normalizedSizes.map(async (size) => ({
    size,
    buffer: await sharp(buffer, { failOn: 'none' })
      .resize({ width: size, height: size, fit: 'cover' })
      .png()
      .toBuffer()
  })))
}

// 创建 ICO 文件 Buffer
export function createIcoBuffer(images: IconPngBuffer[]): Buffer {
  if (images.length === 0) throw new Error('ICO 至少需要一个尺寸')
  const headerSize = 6
  const entrySize = 16
  const directorySize = headerSize + images.length * entrySize
  const totalSize = directorySize + images.reduce((sum, image) => sum + image.buffer.byteLength, 0)
  const output = Buffer.alloc(totalSize)

  output.writeUInt16LE(0, 0)
  output.writeUInt16LE(1, 2)
  output.writeUInt16LE(images.length, 4)

  let offset = directorySize
  images.forEach((image, index) => {
    const entryOffset = headerSize + index * entrySize
    output.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset)
    output.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset + 1)
    output.writeUInt8(0, entryOffset + 2)
    output.writeUInt8(0, entryOffset + 3)
    output.writeUInt16LE(1, entryOffset + 4)
    output.writeUInt16LE(32, entryOffset + 6)
    output.writeUInt32LE(image.buffer.byteLength, entryOffset + 8)
    output.writeUInt32LE(offset, entryOffset + 12)
    image.buffer.copy(output, offset)
    offset += image.buffer.byteLength
  })

  return output
}

// 从 ICO 读取第一张 PNG
function readFirstPngFromIco(buffer: Buffer): Buffer | null {
  if (buffer.byteLength < 22 || buffer.readUInt16LE(2) !== 1) return null
  const count = buffer.readUInt16LE(4)
  if (count < 1) return null
  const bytes = buffer.readUInt32LE(14)
  const offset = buffer.readUInt32LE(18)
  if (offset <= 0 || bytes <= 0 || offset + bytes > buffer.byteLength) return null
  return buffer.subarray(offset, offset + bytes)
}

// 处理单张图片
export async function processImage(request: ImageToolProcessRequest): Promise<ImageToolProcessResponse> {
  const source = sourceRegistry.get(request.sourceId)
  if (!source) {
    return { success: false, status: 'error', message: '图片源不存在，请重新导入' }
  }

  try {
    const options = normalizeImageToolOptions(request.options)
    const encoded = await processImageBuffer(source.buffer, options)
    const baseName = parse(source.ref.name).name || 'image'
    const resultName = `${baseName}-pawkit.${formatExtensionMap[encoded.format]}`
    const result = await registerResult(source.ref.id, encoded.buffer, resultName, encoded.format)
    return { success: true, status: 'success', message: '图片处理完成', result }
  } catch (error) {
    logger.error('处理图片失败:', error)
    return { success: false, status: 'error', message: `图片处理失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

// 创建批量输出路径
export function createBatchOutputPath(outputDir: string, sourceName: string, format: ImageToolFormat, usedPaths = new Set<string>()): string {
  const parsed = parse(sourceName)
  const safeBase = sanitizeFileName(parsed.name || 'image')
  const extension = formatExtensionMap[format]
  let index = 0
  let candidate = join(outputDir, `${safeBase}-pawkit.${extension}`)
  while (usedPaths.has(candidate.toLowerCase()) || existsSync(candidate)) {
    index += 1
    candidate = join(outputDir, `${safeBase}-pawkit-${index}.${extension}`)
  }
  usedPaths.add(candidate.toLowerCase())
  return candidate
}

// 批量处理图片
export async function processImageBatch(
  request: ImageToolBatchRequest,
  ownerWindow?: BrowserWindow | null
): Promise<ImageToolBatchResponse> {
  const sources = request.sourceIds
    .map((id) => sourceRegistry.get(id))
    .filter((source): source is StoredImageSource => Boolean(source))

  if (sources.length === 0) {
    return { success: false, status: 'error', message: '没有可处理的图片源', items: [] }
  }

  const outputDialog = await showOpenDialogSafe({
    title: '选择批量输出目录',
    properties: ['openDirectory', 'createDirectory']
  }, ownerWindow)

  if (outputDialog.canceled || outputDialog.filePaths.length === 0) {
    return { success: false, status: 'cancelled', message: '批量处理已取消', items: [] }
  }

  const outputDir = outputDialog.filePaths[0]
  const options = normalizeImageToolOptions(request.options)
  const usedPaths = new Set<string>()
  const items: ImageToolBatchItemResult[] = []

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    sendBatchProgress(ownerWindow, { total: sources.length, completed: index, currentName: source.ref.name })
    try {
      const encoded = await processImageBuffer(source.buffer, options)
      const outputPath = createBatchOutputPath(outputDir, source.ref.name, encoded.format, usedPaths)
      await writeFile(outputPath, encoded.buffer)
      items.push({ sourceId: source.ref.id, sourceName: source.ref.name, success: true, path: outputPath, message: '处理成功' })

      if (options.icon?.exportPngSet) {
        await writeIconPngSet(source.buffer, outputDir, source.ref.name, options.icon.sizes)
      }
    } catch (error) {
      items.push({
        sourceId: source.ref.id,
        sourceName: source.ref.name,
        success: false,
        message: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  sendBatchProgress(ownerWindow, { total: sources.length, completed: sources.length })
  const successCount = items.filter((item) => item.success).length
  return {
    success: successCount > 0,
    status: successCount > 0 ? 'success' : 'error',
    outputDir,
    items,
    message: `批量处理完成，成功 ${successCount} / ${items.length} 张`
  }
}

// 导出多尺寸 PNG 图标集
async function writeIconPngSet(buffer: Buffer, outputDir: string, sourceName: string, sizes: number[]): Promise<void> {
  const folderName = `${sanitizeFileName(parse(sourceName).name || 'image')}-icons`
  const iconDir = join(outputDir, folderName)
  await mkdir(iconDir, { recursive: true })
  const icons = await createIconPngBuffers(buffer, sizes)
  await Promise.all(icons.map((icon) => writeFile(join(iconDir, `${icon.size}x${icon.size}.png`), icon.buffer)))
}

// 复制处理结果到剪贴板
export async function copyImageResult(resultId: string): Promise<ClipboardActionResult> {
  const result = resultRegistry.get(resultId)
  if (!result) return { success: false, message: '处理结果不存在' }

  try {
    if (result.ref.format === 'ico') {
      clipboard.writeText(`data:${result.ref.mimeType};base64,${result.buffer.toString('base64')}`)
      return { success: true, message: 'ICO 已作为 Data URL 文本复制' }
    }

    const png = await sharp(result.buffer, { failOn: 'none' }).png().toBuffer()
    const image = nativeImage.createFromBuffer(png)
    if (image.isEmpty()) return { success: false, message: '处理结果无法复制' }
    clipboard.writeImage(image)
    return { success: true, message: '图片结果已复制到剪贴板' }
  } catch (error) {
    logger.error('复制图片处理结果失败:', error)
    return { success: false, message: '复制图片结果失败' }
  }
}

// 保存处理结果
export async function saveImageResult(resultId: string, ownerWindow?: BrowserWindow | null): Promise<ImageToolSaveResult> {
  const result = resultRegistry.get(resultId)
  if (!result) return { success: false, status: 'error', message: '处理结果不存在' }

  const extension = formatExtensionMap[result.ref.format]
  const dialog = await showSaveDialogSafe({
    title: '保存图片处理结果',
    defaultPath: result.ref.name,
    filters: [{ name: `${result.ref.format.toUpperCase()} 文件`, extensions: [extension] }]
  }, ownerWindow)

  if (dialog.canceled || !dialog.filePath) {
    return { success: false, status: 'cancelled', message: '保存已取消' }
  }

  try {
    await writeFile(dialog.filePath, result.buffer)
    return { success: true, status: 'success', path: dialog.filePath, message: '图片结果已保存' }
  } catch (error) {
    logger.error('保存图片处理结果失败:', error)
    return { success: false, status: 'error', message: '保存图片结果失败' }
  }
}

// 导出处理结果为 Data URL
export function exportImageResultDataUrl(resultId: string): string | null {
  const result = resultRegistry.get(resultId)
  if (!result) return null
  return `data:${result.ref.mimeType};base64,${result.buffer.toString('base64')}`
}

// 获取结果二进制，供测试或内部使用
export function getImageResultBuffer(resultId: string): Buffer | null {
  return resultRegistry.get(resultId)?.buffer ?? null
}
