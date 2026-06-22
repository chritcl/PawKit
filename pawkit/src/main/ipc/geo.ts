import { BrowserWindow, ipcMain } from 'electron'
import { basename } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { zipSync } from 'fflate'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  GeoArchiveEntry,
  GeoBinaryData,
  GeoFileDialogFilter,
  GeoFilePayload,
  GeoSaveArchiveRequest,
  GeoSaveFileRequest,
  GeoSaveFileResult
} from '../../shared/types'
import { showOpenDialogSafe, showSaveDialogSafe } from '../dialog-utils'
import { logger } from '../logger'
import { validateSender } from './validate-sender'

const defaultGeoFilters: GeoFileDialogFilter[] = [
  {
    name: '地理空间数据',
    extensions: [
      'geojson',
      'json',
      'topojson',
      'csv',
      'tsv',
      'kml',
      'svg',
      'shp',
      'shx',
      'dbf',
      'prj',
      'cpg',
      'fgb',
      'gpkg',
      'parquet',
      'geoparquet',
      'tif',
      'tiff',
      'zip'
    ]
  },
  { name: '所有文件', extensions: ['*'] }
]

function normalizeFilters(filters?: GeoFileDialogFilter[]): GeoFileDialogFilter[] {
  if (!Array.isArray(filters) || filters.length === 0) return defaultGeoFilters
  return filters.filter((item) => item.name && Array.isArray(item.extensions) && item.extensions.length > 0)
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

function toUint8Array(bytes: GeoBinaryData): Uint8Array {
  if (isArrayBuffer(bytes)) return new Uint8Array(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  throw new Error('地理空间文件不是有效二进制数据')
}

function toTightArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function sanitizeArchiveEntryName(entry: GeoArchiveEntry, index: number): string {
  const rawName = entry.name || `file-${index + 1}.bin`
  return [...basename(rawName)]
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
}

async function openGeoFiles(
  ownerWindow?: BrowserWindow | null,
  filters?: GeoFileDialogFilter[]
): Promise<GeoFilePayload[]> {
  const result = await showOpenDialogSafe({
    title: '导入地理空间数据',
    properties: ['openFile', 'multiSelections'],
    filters: normalizeFilters(filters)
  }, ownerWindow)

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  return await Promise.all(result.filePaths.map(async (filePath) => {
    const bytes = await readFile(filePath)
    return {
      name: basename(filePath),
      path: filePath,
      bytes: toTightArrayBuffer(bytes),
      size: bytes.byteLength
    }
  }))
}

async function saveGeoFile(
  request: GeoSaveFileRequest,
  ownerWindow?: BrowserWindow | null
): Promise<GeoSaveFileResult> {
  const result = await showSaveDialogSafe({
    title: '导出地理空间数据',
    defaultPath: request.suggestedName,
    filters: normalizeFilters(request.filters)
  }, ownerWindow)

  if (result.canceled || !result.filePath) {
    return { success: false, status: 'cancelled', message: '导出已取消' }
  }

  try {
    await writeFile(result.filePath, toUint8Array(request.bytes))
    return { success: true, status: 'saved', path: result.filePath, message: '导出成功' }
  } catch (error) {
    logger.error('导出地理空间文件失败:', error)
    return {
      success: false,
      status: 'error',
      message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

async function saveGeoArchive(
  request: GeoSaveArchiveRequest,
  ownerWindow?: BrowserWindow | null
): Promise<GeoSaveFileResult> {
  const result = await showSaveDialogSafe({
    title: '导出地理空间压缩包',
    defaultPath: request.suggestedName,
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
  }, ownerWindow)

  if (result.canceled || !result.filePath) {
    return { success: false, status: 'cancelled', message: '导出已取消' }
  }

  try {
    const files: Record<string, Uint8Array> = {}
    request.entries.forEach((entry, index) => {
      files[sanitizeArchiveEntryName(entry, index)] = toUint8Array(entry.bytes)
    })
    await writeFile(result.filePath, zipSync(files))
    return { success: true, status: 'saved', path: result.filePath, message: '压缩包已导出' }
  } catch (error) {
    logger.error('导出地理空间压缩包失败:', error)
    return {
      success: false,
      status: 'error',
      message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

// 注册地理空间文件 IPC 处理器
export function registerGeoIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GEO_OPEN_FILES, async (event, filters?: GeoFileDialogFilter[]) => {
    if (!validateSender(event)) return []
    return await openGeoFiles(BrowserWindow.fromWebContents(event.sender), filters)
  })

  ipcMain.handle(IPC_CHANNELS.GEO_SAVE_FILE, async (event, request: GeoSaveFileRequest) => {
    if (!validateSender(event)) {
      return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    }
    return await saveGeoFile(request, BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(IPC_CHANNELS.GEO_SAVE_ARCHIVE, async (event, request: GeoSaveArchiveRequest) => {
    if (!validateSender(event)) {
      return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    }
    return await saveGeoArchive(request, BrowserWindow.fromWebContents(event.sender))
  })
}
