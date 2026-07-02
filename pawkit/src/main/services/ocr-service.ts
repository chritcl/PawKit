import { app, BrowserWindow, clipboard, nativeImage } from 'electron'
import { randomUUID } from 'crypto'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { copyFile, mkdir, readFile, stat } from 'fs/promises'
import sharp from 'sharp'
import jsQR from 'jsqr'
import Tesseract from 'tesseract.js'
import type {
  ClipboardActionResult,
  ClipboardImageItem,
  OcrDetectedUrl,
  OcrImageSource,
  OcrMode,
  OcrOverlayResult,
  OcrQrResult,
  OcrQuickResult,
  OcrRecognizeRequest,
  OcrRecognizeResult,
  OcrSendRequest,
  OcrSourceRef,
  OcrTaskStatus,
  OcrTableResult,
  OcrTextRegion
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { logger } from '../logger'
import { getClipboardHistory } from './clipboard-service'
import { extractImagePalette, parseImageDataUrl } from './image-tool'

interface LoadedImageInput {
  buffer: Buffer
  source: OcrSourceRef
}

interface OcrWordLike {
  text: string
  bbox?: { x0: number; y0: number; x1: number; y1: number }
}

interface OcrLineLike {
  text: string
  bbox?: { x0: number; y0: number; x1: number; y1: number }
  words?: OcrWordLike[]
}

interface OcrParagraphLike {
  text: string
  lines?: OcrLineLike[]
}

interface OcrBlockLike {
  text: string
  paragraphs?: OcrParagraphLike[]
}

const require = createRequire(import.meta.url)
const OCR_LANGUAGES = 'eng+chi_sim'
const OCR_LANG_DIR_NAME = 'ocr-lang-data'
const OCR_CACHE_DIR_NAME = 'ocr-cache'
const supportedModes: OcrMode[] = ['auto', 'paragraph', 'code', 'table']

let workerPromise: Promise<Tesseract.Worker> | null = null

// 规范化 OCR 模式
export function normalizeOcrMode(mode: OcrMode | undefined): OcrMode {
  return mode && supportedModes.includes(mode) ? mode : 'auto'
}

// 从文本中提取 URL
export function extractDetectedUrls(text: string): OcrDetectedUrl[] {
  const matches = text.match(/https?:\/\/[^\s<>"'，。；、）)]+|(?<!@)\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s<>"'，。；、）)]*)?/gi) ?? []
  const seen = new Set<string>()
  return matches
    .map((item) => {
      const trimmed = item.replace(/[.,;:!?，。；：！？]+$/g, '')
      const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      return { text: trimmed, normalized }
    })
    .filter((item) => {
      try {
        const url = new URL(item.normalized)
        if (!['http:', 'https:'].includes(url.protocol)) return false
        const key = url.toString()
        if (seen.has(key)) return false
        seen.add(key)
        item.normalized = key
        return true
      } catch {
        return false
      }
    })
}

// 保留段落并清理多余空白
export function buildParagraphText(blocks: OcrBlockLike[] | null | undefined, fallbackText: string): string {
  const paragraphs = (blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])
    .map((paragraph) => normalizeTextLine(paragraph.text))
    .filter(Boolean)

  if (paragraphs.length > 0) return paragraphs.join('\n\n')

  return fallbackText
    .split(/\n{2,}/)
    .map((part) => part.split(/\r?\n/).map(normalizeTextLine).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n\n')
}

// 保留代码结构
export function buildCodeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()
}

// 从文本构建表格结果
export function buildTableResult(text: string): OcrTableResult | null {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitTableLine(line))
    .filter((cells) => cells.length >= 2)

  if (rows.length < 2) return null

  const columnCount = Math.max(...rows.map((row) => row.length))
  if (columnCount < 2) return null
  const normalizedRows = rows.map((row) => {
    const next = [...row]
    while (next.length < columnCount) next.push('')
    return next.slice(0, columnCount)
  })

  const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').trim()
  const markdown = [
    `| ${normalizedRows[0].map(escapeCell).join(' | ')} |`,
    `| ${normalizedRows[0].map(() => '---').join(' | ')} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.map(escapeCell).join(' | ')} |`)
  ].join('\n')
  const tsv = normalizedRows.map((row) => row.map((cell) => cell.trim()).join('\t')).join('\n')

  return { rows: normalizedRows, markdown, tsv }
}

// 本地识别 OCR
export async function recognizeOcr(request: OcrRecognizeRequest): Promise<OcrRecognizeResult> {
  const mode = normalizeOcrMode(request?.mode)
  const createdAt = new Date().toISOString()

  try {
    const input = await readOcrImageInput(request?.source)
    if (!input) return createEmptyRecognizeResult('no-image', '没有可识别的图片', mode, createdAt)

    const worker = await getOcrWorker()
    await worker.setParameters({
      tessedit_pageseg_mode: getPageSegMode(mode),
      preserve_interword_spaces: mode === 'code' || mode === 'table' ? '1' : '0'
    })
    const recognition = await worker.recognize(input.buffer, {}, { text: true, blocks: true, tsv: true })
    const text = (recognition.data.text ?? '').trim()
    const blocks = recognition.data.blocks as OcrBlockLike[] | null
    const paragraphText = buildParagraphText(blocks, text)
    const codeText = buildCodeText(text)
    const table = buildTableResult(mode === 'table' ? codeText : text)
    const qrCodes = await detectQrCodesFromBuffer(input.buffer)
    const colors = await extractImagePalette(input.buffer)
    const urls = extractDetectedUrls([text, ...qrCodes.map((item) => item.text)].join('\n'))
    const success = Boolean(text || qrCodes.length > 0 || colors.length > 0)

    return {
      success,
      status: success ? 'success' : 'empty',
      message: success ? '识别完成' : '未识别到文本内容',
      source: input.source,
      mode,
      text,
      paragraphText,
      codeText,
      table,
      urls,
      qrCodes,
      colors,
      confidence: Number(recognition.data.confidence ?? 0),
      createdAt
    }
  } catch (error) {
    logger.error('OCR 识别失败:', error)
    return createEmptyRecognizeResult('error', `OCR 识别失败: ${error instanceof Error ? error.message : '未知错误'}`, mode, createdAt)
  }
}

// 识别当前剪贴板图片
export async function recognizeClipboardImage(): Promise<OcrRecognizeResult> {
  return await recognizeOcr({ source: { kind: 'clipboard' }, mode: 'auto' })
}

// 截图覆盖层专用 OCR 识别（返回文字位置信息）
export async function recognizeOcrOverlay(request: OcrRecognizeRequest): Promise<OcrOverlayResult> {
  try {
    const input = await readOcrImageInput(request?.source)
    if (!input) {
      return { success: false, message: '没有可识别的图片', regions: [], fullText: '', confidence: 0, imageWidth: 0, imageHeight: 0 }
    }

    const worker = await getOcrWorker()
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      preserve_interword_spaces: '0'
    })
    const recognition = await worker.recognize(input.buffer, {}, { text: true, blocks: true })

    const blocks = recognition.data.blocks as OcrBlockLike[] | null
    const text = (recognition.data.text ?? '').trim()
    const confidence = Number(recognition.data.confidence ?? 0)

    // 从 blocks 中提取 line 级别的文字区域
    const regions: OcrTextRegion[] = []
    if (blocks) {
      for (const block of blocks) {
        for (const paragraph of block.paragraphs ?? []) {
          for (const line of paragraph.lines ?? []) {
            const lineRegion: OcrTextRegion = {
              text: line.text,
              bbox: line.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
              confidence,
              level: 'line',
              children: (line.words ?? []).map((word) => ({
                text: word.text,
                bbox: word.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
                confidence,
                level: 'word' as const
              }))
            }
            regions.push(lineRegion)
          }
        }
      }
    }

    const metadata = await sharp(input.buffer, { failOn: 'none' }).metadata()

    return {
      success: Boolean(text),
      message: text ? '识别完成' : '未识别到文本内容',
      regions,
      fullText: text,
      confidence,
      imageWidth: metadata.width ?? input.source.width,
      imageHeight: metadata.height ?? input.source.height
    }
  } catch (error) {
    logger.error('OCR 覆盖层识别失败:', error)
    return { success: false, message: `识别失败: ${error instanceof Error ? error.message : '未知错误'}`, regions: [], fullText: '', confidence: 0, imageWidth: 0, imageHeight: 0 }
  }
}

// 仅识别二维码
export async function detectQrFromImage(request: OcrRecognizeRequest): Promise<OcrQuickResult> {
  try {
    const input = await readOcrImageInput(request?.source)
    if (!input) return { success: false, status: 'no-image', message: '没有可识别的图片' }
    const qrCodes = await detectQrCodesFromBuffer(input.buffer)
    return {
      success: qrCodes.length > 0,
      status: qrCodes.length > 0 ? 'success' : 'empty',
      message: qrCodes.length > 0 ? '二维码识别完成' : '未识别到二维码',
      source: input.source,
      qrCodes
    }
  } catch (error) {
    logger.error('二维码识别失败:', error)
    return { success: false, status: 'error', message: '二维码识别失败' }
  }
}

// 仅提取颜色
export async function extractColorsFromImage(request: OcrRecognizeRequest): Promise<OcrQuickResult> {
  try {
    const input = await readOcrImageInput(request?.source)
    if (!input) return { success: false, status: 'no-image', message: '没有可提取颜色的图片' }
    const colors = await extractImagePalette(input.buffer)
    return {
      success: colors.length > 0,
      status: colors.length > 0 ? 'success' : 'empty',
      message: colors.length > 0 ? '颜色提取完成' : '未提取到颜色',
      source: input.source,
      colors
    }
  } catch (error) {
    logger.error('颜色提取失败:', error)
    return { success: false, status: 'error', message: '颜色提取失败' }
  }
}

// 复制 OCR 文本
export function copyOcrText(text: string): ClipboardActionResult {
  if (!text.trim()) return { success: false, message: '没有可复制的内容' }
  clipboard.writeText(text)
  return { success: true, message: '识别结果已复制' }
}

// 发送图片到 OCR 工具
export async function sendImageToOcrTool(request: OcrSendRequest): Promise<OcrSourceRef | null> {
  if (!request || typeof request.dataUrl !== 'string') return null
  try {
    const input = await readOcrImageInput({
      kind: request.sourceKind === 'screenshot' ? 'screenshot' : 'data-url',
      dataUrl: request.dataUrl,
      name: request.name
    })
    if (!input) return null
    const source = {
      ...input.source,
      kind: request.sourceKind ?? input.source.kind
    }
    broadcastOcrSource(source)
    return source
  } catch (error) {
    logger.warn('发送图片到 OCR 工具失败:', error)
    return null
  }
}

// 读取 OCR 图片输入
async function readOcrImageInput(source: OcrImageSource | undefined): Promise<LoadedImageInput | null> {
  if (!source) return null

  if (source.kind === 'clipboard') {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    return await createLoadedImage(image.toPNG(), 'clipboard', `clipboard-${Date.now()}.png`)
  }

  if (source.kind === 'clipboard-history') {
    const item = getClipboardHistory().find((entry): entry is ClipboardImageItem => entry.id === source.id && entry.type === 'image')
    if (!item || !existsSync(item.imagePath)) return null
    return await createLoadedImage(await readFile(item.imagePath), 'clipboard-history', `clipboard-${item.id}.png`)
  }

  const parsed = parseImageDataUrl(source.dataUrl)
  return await createLoadedImage(parsed.buffer, source.kind, source.name ?? `${source.kind}-${Date.now()}.png`)
}

// 创建已加载图片输入
async function createLoadedImage(buffer: Buffer, kind: OcrSourceRef['kind'], name: string): Promise<LoadedImageInput> {
  const png = await sharp(buffer, { failOn: 'none' }).rotate().png().toBuffer()
  const metadata = await sharp(png, { failOn: 'none' }).metadata()
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`
  return {
    buffer: png,
    source: {
      id: randomUUID(),
      name,
      kind,
      dataUrl,
      width: metadata.width ?? nativeImage.createFromBuffer(png).getSize().width,
      height: metadata.height ?? nativeImage.createFromBuffer(png).getSize().height,
      createdAt: new Date().toISOString()
    }
  }
}

// 获取常驻 OCR worker
async function getOcrWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker()
  }
  return await workerPromise
}

// 创建 OCR worker
async function createOcrWorker(): Promise<Tesseract.Worker> {
  const langPath = await prepareLanguageData()
  return await Tesseract.createWorker(OCR_LANGUAGES, Tesseract.OEM.LSTM_ONLY, {
    langPath,
    workerPath: resolveUnpackedPath(require.resolve('tesseract.js/src/worker-script/node/index.js')),
    cachePath: join(app.getPath('userData'), OCR_CACHE_DIR_NAME),
    cacheMethod: 'none',
    gzip: true,
    workerBlobURL: false,
    logger: (message) => {
      if (message.status) logger.debug('OCR 进度:', message.status, message.progress)
    }
  })
}

// 准备本地语言数据目录
async function prepareLanguageData(): Promise<string> {
  const targetDir = join(app.getPath('userData'), OCR_LANG_DIR_NAME)
  await mkdir(targetDir, { recursive: true })
  await copyLanguageFile('@tesseract.js-data/eng', 'eng.traineddata.gz', targetDir)
  await copyLanguageFile('@tesseract.js-data/chi_sim', 'chi_sim.traineddata.gz', targetDir)
  return targetDir
}

// 复制语言数据文件
async function copyLanguageFile(packageName: string, fileName: string, targetDir: string): Promise<void> {
  const source = resolveUnpackedPath(join(dirname(require.resolve(packageName)), '4.0.0_best_int', fileName))
  const target = join(targetDir, fileName)
  const [sourceStat, targetStat] = await Promise.all([
    stat(source),
    existsSync(target) ? stat(target) : Promise.resolve(null)
  ])
  if (!targetStat || targetStat.size !== sourceStat.size) {
    await copyFile(source, target)
  }
}

// 兼容 asarUnpack 后的真实文件路径
function resolveUnpackedPath(filePath: string): string {
  if (!app.isPackaged) return filePath
  return filePath.replace('app.asar', 'app.asar.unpacked')
}

// 根据模式选择分割策略
function getPageSegMode(mode: OcrMode): Tesseract.PSM {
  if (mode === 'code' || mode === 'table') return Tesseract.PSM.SPARSE_TEXT
  if (mode === 'paragraph') return Tesseract.PSM.AUTO
  return Tesseract.PSM.AUTO
}

// 本地识别二维码
async function detectQrCodesFromBuffer(buffer: Buffer): Promise<OcrQrResult[]> {
  const image = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const code = jsQR(
    new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    image.info.width,
    image.info.height,
    { inversionAttempts: 'attemptBoth' }
  )
  if (!code?.data) return []
  const urls = extractDetectedUrls(code.data)
  return [{
    text: code.data,
    isUrl: urls.length > 0,
    normalizedUrl: urls[0]?.normalized
  }]
}

// 广播 OCR 图片源
function broadcastOcrSource(source: OcrSourceRef): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.OCR_OPEN_SOURCE, source)
    }
  })
}

// 创建空 OCR 结果
function createEmptyRecognizeResult(
  status: OcrTaskStatus,
  message: string,
  mode: OcrMode,
  createdAt: string
): OcrRecognizeResult {
  return {
    success: false,
    status,
    message,
    mode,
    text: '',
    paragraphText: '',
    codeText: '',
    table: null,
    urls: [],
    qrCodes: [],
    colors: [],
    confidence: 0,
    createdAt
  }
}

// 清理单行文本
function normalizeTextLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

// 拆分可能的表格行
function splitTableLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim()).filter(Boolean)
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean)
  if (line.includes('|')) return line.split('|').map((cell) => cell.trim()).filter(Boolean)
  return []
}
