// IPC 通道常量
export const IPC_CHANNELS = {
  // 应用相关
  APP_SHOW_WINDOW: 'app:show-window',
  APP_HIDE_WINDOW: 'app:hide-window',
  APP_TOGGLE_WINDOW: 'app:toggle-window',
  APP_QUIT: 'app:quit',

  // 设置相关
  SETTING_GET: 'setting:get',
  SETTING_SET: 'setting:set',
  SETTING_GET_ALL: 'setting:get-all',
  SETTING_RESET: 'setting:reset',

  // 剪贴板相关
  CLIPBOARD_READ_TEXT: 'clipboard:read-text',
  CLIPBOARD_WRITE_TEXT: 'clipboard:write-text',
  CLIPBOARD_GET_HISTORY: 'clipboard:get-history',
  CLIPBOARD_CLEAR_HISTORY: 'clipboard:clear-history',
  CLIPBOARD_REMOVE_ITEM: 'clipboard:remove-item',
  CLIPBOARD_TOGGLE_FAVORITE: 'clipboard:toggle-favorite',
  CLIPBOARD_HISTORY_CHANGED: 'clipboard:history-changed',

  // 截图相关
  SCREENSHOT_CAPTURE_FULL_SCREEN: 'screenshot:capture-full-screen',
  SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD: 'screenshot:copy-image-to-clipboard',
  SCREENSHOT_SAVE_IMAGE: 'screenshot:save-image',

  // 快捷键相关
  SHORTCUT_GET_STATUS: 'shortcut:get-status',
  SHORTCUT_UPDATE: 'shortcut:update',
  SHORTCUT_RESET: 'shortcut:reset',
  SHORTCUT_SET_ENABLED: 'shortcut:set-enabled'
} as const

// IPC 通道类型
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
