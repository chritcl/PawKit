import { BrowserWindow, globalShortcut, dialog } from 'electron'
import { ShortcutKey, ShortcutStatusItem } from './types'
import { getMergedShortcutConfig, saveShortcutConfig, resetShortcutConfig, normalizeAccelerator, DEFAULT_SHORTCUTS } from './config'
import { handleShortcutAction, setMainWindowForShortcuts } from './actions'

// 快捷键状态列表
let shortcutStatusList: ShortcutStatusItem[] = []

// 获取快捷键状态列表
export function getShortcutStatusList(): ShortcutStatusItem[] {
  return [...shortcutStatusList]
}

// 设置快捷键状态列表
function setShortcutStatusList(list: ShortcutStatusItem[]): void {
  shortcutStatusList = list
}

// 注册所有快捷键
export function registerAllShortcuts(): ShortcutStatusItem[] {
  // 先注销所有已注册的快捷键
  globalShortcut.unregisterAll()

  const shortcutConfig = getMergedShortcutConfig()
  const statusList: ShortcutStatusItem[] = []
  const usedAccelerators = new Map<string, ShortcutKey>()

  for (const key of Object.keys(shortcutConfig) as ShortcutKey[]) {
    const item = shortcutConfig[key]

    // 检查是否禁用
    if (!item.enabled) {
      statusList.push({
        ...item,
        registered: false,
        status: 'disabled'
      })
      continue
    }

    // 检查快捷键是否为空
    if (!item.accelerator) {
      statusList.push({
        ...item,
        registered: false,
        status: 'invalid',
        errorMessage: '快捷键不能为空'
      })
      continue
    }

    // 标准化快捷键
    const normalizedAccelerator = normalizeAccelerator(item.accelerator)

    // 检查应用内冲突
    if (usedAccelerators.has(normalizedAccelerator)) {
      statusList.push({
        ...item,
        accelerator: normalizedAccelerator,
        registered: false,
        status: 'conflict',
        errorMessage: '该快捷键与应用内其他功能冲突'
      })
      continue
    }

    usedAccelerators.set(normalizedAccelerator, key)

    // 尝试注册
    try {
      const success = globalShortcut.register(normalizedAccelerator, () => {
        handleShortcutAction(key)
      })

      statusList.push({
        ...item,
        accelerator: normalizedAccelerator,
        registered: success,
        status: success ? 'registered' : 'failed',
        errorMessage: success ? undefined : '快捷键注册失败，可能已被其他应用占用'
      })
    } catch {
      statusList.push({
        ...item,
        accelerator: normalizedAccelerator,
        registered: false,
        status: 'failed',
        errorMessage: '快捷键注册异常，请修改快捷键'
      })
    }
  }

  setShortcutStatusList(statusList)

  // 提示注册失败的快捷键
  notifyShortcutRegisterFailed(statusList)

  return statusList
}

// 提示注册失败的快捷键
function notifyShortcutRegisterFailed(statusList: ShortcutStatusItem[]): void {
  const failedList = statusList.filter(
    (item) => item.status === 'failed' || item.status === 'conflict' || item.status === 'invalid'
  )

  if (failedList.length === 0) return

  const message = failedList
    .map((item) => `${item.accelerator}：${item.label}，${item.errorMessage}`)
    .join('\n')

  dialog.showMessageBox({
    type: 'warning',
    title: '快捷键注册失败',
    message: '以下快捷键未能成功注册，请前往管理中心修改：',
    detail: message,
    buttons: ['知道了']
  })
}

// 更新快捷键
export function updateShortcut(
  key: ShortcutKey,
  nextAccelerator: string,
  nextEnabled: boolean
): ShortcutStatusItem[] {
  const currentConfig = getMergedShortcutConfig()
  const currentItem = currentConfig[key]
  const oldAccelerator = currentItem.accelerator

  // 如果禁用
  if (!nextEnabled) {
    if (oldAccelerator) {
      try {
        globalShortcut.unregister(oldAccelerator)
      } catch {
        // 忽略注销错误
      }
    }

    saveShortcutConfig({
      ...currentConfig,
      [key]: { ...currentItem, enabled: false }
    })

    return registerAllShortcuts()
  }

  // 标准化新快捷键
  const normalizedNext = normalizeAccelerator(nextAccelerator)

  if (!normalizedNext) {
    throw new Error('快捷键不能为空')
  }

  // 检查应用内冲突
  const duplicated = Object.values(currentConfig).find(
    (item) =>
      item.key !== key &&
      item.enabled &&
      normalizeAccelerator(item.accelerator) === normalizedNext
  )

  if (duplicated) {
    throw new Error(`该快捷键已被「${duplicated.label}」使用`)
  }

  // 如果快捷键没变化，直接返回
  if (oldAccelerator === normalizedNext && currentItem.enabled) {
    return getShortcutStatusList()
  }

  // 尝试注册新快捷键
  const success = globalShortcut.register(normalizedNext, () => {
    handleShortcutAction(key)
  })

  if (!success) {
    throw new Error('快捷键注册失败，可能已被其他应用占用，请换一个快捷键')
  }

  // 注销旧快捷键
  if (oldAccelerator && oldAccelerator !== normalizedNext) {
    try {
      globalShortcut.unregister(oldAccelerator)
    } catch {
      // 忽略注销错误
    }
  }

  // 保存新配置
  saveShortcutConfig({
    ...currentConfig,
    [key]: { ...currentItem, accelerator: normalizedNext, enabled: true }
  })

  return registerAllShortcuts()
}

// 更新快捷键启用状态
export function updateShortcutEnabled(
  key: ShortcutKey,
  enabled: boolean
): ShortcutStatusItem[] {
  return updateShortcut(key, DEFAULT_SHORTCUTS[key].accelerator, enabled)
}

// 重置所有快捷键为默认值
export function resetAllShortcuts(): ShortcutStatusItem[] {
  resetShortcutConfig()
  return registerAllShortcuts()
}

// 初始化快捷键系统
export function initShortcuts(mainWindow: BrowserWindow): ShortcutStatusItem[] {
  setMainWindowForShortcuts(mainWindow)
  return registerAllShortcuts()
}

// 注销所有快捷键
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
  setShortcutStatusList([])
}

// 导出类型和配置
export type { ShortcutKey, ShortcutStatusItem, ShortcutConfigItem, ShortcutUpdatePayload, ShortcutSetEnabledPayload } from './types'
export { DEFAULT_SHORTCUTS } from './config'
