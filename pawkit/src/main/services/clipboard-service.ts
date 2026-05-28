import { clipboard, BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { ClipboardItem } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting, setSetting } from '../store'
import { CLIPBOARD_CONFIG } from './clipboard-config'
import { logger } from '../logger'

// 轮询定时器
let timer: ReturnType<typeof setInterval> | null = null

// 上次剪贴板文本
let lastClipboardText = ''

// 内部写入保护
let internalWritingText = ''
let internalWritingExpireAt = 0

// 存储路径
const STORE_KEY = 'clipboard.history'

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

// 添加剪贴板文本
export function addClipboardText(content: string): ClipboardItem[] {
  const text = content.trim()

  if (!text) {
    logger.debug('忽略空文本')
    return getClipboardHistory()
  }

  if (text.length > CLIPBOARD_CONFIG.maxTextLength) {
    logger.debug('文本过长，忽略:', text.length)
    return getClipboardHistory()
  }

  const history = getClipboardHistory()
  logger.debug('当前历史记录数:', history.length)
  const existingItem = history.find((item) => item.content === text)

  let nextHistory: ClipboardItem[]

  if (existingItem) {
    // 已存在则移动到顶部，更新时间
    nextHistory = [
      {
        ...existingItem,
        updatedAt: new Date().toISOString()
      },
      ...history.filter((item) => item.id !== existingItem.id)
    ]
  } else {
    // 创建新记录
    const newItem: ClipboardItem = {
      id: nanoid(),
      type: 'text',
      content: text,
      favorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    nextHistory = [newItem, ...history]
  }

  nextHistory = limitClipboardHistory(nextHistory)
  saveClipboardHistory(nextHistory)
  notifyClipboardHistoryChanged(nextHistory)

  return nextHistory
}

// 写入剪贴板文本
export function writeClipboardText(content: string): ClipboardItem[] {
  const text = content.trim()

  if (!text) {
    return getClipboardHistory()
  }

  // 设置内部写入保护
  internalWritingText = text
  internalWritingExpireAt = Date.now() + CLIPBOARD_CONFIG.internalWriteProtectDuration

  clipboard.writeText(text)
  lastClipboardText = text

  return addClipboardText(text)
}

// 删除单条记录
export function removeClipboardItem(id: string): ClipboardItem[] {
  const history = getClipboardHistory()
  const nextHistory = history.filter((item) => item.id !== id)

  saveClipboardHistory(nextHistory)
  notifyClipboardHistoryChanged(nextHistory)

  return nextHistory
}

// 清空历史记录
export function clearClipboardHistory(options = { keepFavorites: true }): ClipboardItem[] {
  const history = getClipboardHistory()

  const nextHistory = options.keepFavorites
    ? history.filter((item) => item.favorite)
    : []

  saveClipboardHistory(nextHistory)
  notifyClipboardHistoryChanged(nextHistory)

  return nextHistory
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

  saveClipboardHistory(nextHistory)
  notifyClipboardHistoryChanged(nextHistory)

  return nextHistory
}

// 检测剪贴板变化
function checkClipboardChange(): void {
  const currentText = clipboard.readText()

  if (!currentText) return
  if (currentText === lastClipboardText) return

  const now = Date.now()
  const isInternalWrite =
    currentText === internalWritingText &&
    now <= internalWritingExpireAt

  logger.debug('检测到剪贴板变化:', currentText.substring(0, 50), '内部写入:', isInternalWrite)

  lastClipboardText = currentText

  if (isInternalWrite) {
    return
  }

  addClipboardText(currentText)
}

// 启动剪贴板监听
export function startClipboardWatch(): void {
  if (timer) return

  const initialText = clipboard.readText() || ''
  lastClipboardText = initialText
  logger.debug('剪贴板监听已启动，初始内容:', lastClipboardText.substring(0, 50))

  addClipboardText(initialText)

  timer = setInterval(() => {
    checkClipboardChange()
  }, CLIPBOARD_CONFIG.pollInterval)
}

// 停止剪贴板监听
export function stopClipboardWatch(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
