// IPC 通道常量
export const IPC_CHANNELS = {
  // 应用相关
  APP_SHOW_WINDOW: 'app:show-window',
  APP_HIDE_WINDOW: 'app:hide-window',
  APP_MINIMIZE_WINDOW: 'app:minimize-window',
  APP_TOGGLE_MAXIMIZE_WINDOW: 'app:toggle-maximize-window',
  APP_TOGGLE_WINDOW: 'app:toggle-window',
  APP_QUIT: 'app:quit',

  // 设置相关
  SETTING_GET: 'setting:get',
  SETTING_SET: 'setting:set',
  SETTING_GET_ALL: 'setting:get-all',
  SETTING_RESET: 'setting:reset',
  SETTING_EXPORT_CONFIG: 'setting:export-config',

  // 剪贴板相关
  CLIPBOARD_READ_TEXT: 'clipboard:read-text',
  CLIPBOARD_WRITE_TEXT: 'clipboard:write-text',
  CLIPBOARD_GET_HISTORY: 'clipboard:get-history',
  CLIPBOARD_CLEAR_HISTORY: 'clipboard:clear-history',
  CLIPBOARD_REMOVE_ITEM: 'clipboard:remove-item',
  CLIPBOARD_RESTORE_ITEM: 'clipboard:restore-item',
  CLIPBOARD_TOGGLE_FAVORITE: 'clipboard:toggle-favorite',
  CLIPBOARD_COPY_ITEM: 'clipboard:copy-item',
  CLIPBOARD_COPY_ITEM_TEXT: 'clipboard:copy-item-text',
  CLIPBOARD_OPEN_LINK: 'clipboard:open-link',
  CLIPBOARD_SHOW_FILE: 'clipboard:show-file',
  CLIPBOARD_SAVE_IMAGE: 'clipboard:save-image',
  CLIPBOARD_GET_IMAGE_DATA: 'clipboard:get-image-data',
  CLIPBOARD_HISTORY_CHANGED: 'clipboard:history-changed',

  // 截图相关
  SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD: 'screenshot:copy-image-to-clipboard',
  SCREENSHOT_SAVE_IMAGE: 'screenshot:save-image',
  SCREENSHOT_PICK_SCREEN_COLOR: 'screenshot:pick-screen-color',
  SCREENSHOT_COLOR_PICKER_READY: 'screenshot:color-picker-ready',
  SCREENSHOT_COLOR_PICKER_DATA: 'screenshot:color-picker-data',
  SCREENSHOT_COLOR_PICKER_FINISH: 'screenshot:color-picker-finish',
  SCREENSHOT_COLOR_PICKER_CANCEL: 'screenshot:color-picker-cancel',

  // 全新截图会话相关
  SCREEN_CAPTURE_START: 'screen-capture:start',
  SCREEN_CAPTURE_OVERLAY_READY: 'screen-capture:overlay-ready',
  SCREEN_CAPTURE_CLAIM: 'screen-capture:claim',
  SCREEN_CAPTURE_ACTION: 'screen-capture:action',
  SCREEN_CAPTURE_CANCEL: 'screen-capture:cancel',
  SCREEN_CAPTURE_PAYLOAD: 'screen-capture:payload',
  SCREEN_CAPTURE_SESSION_STATE: 'screen-capture:session-state',

  // 快捷键相关
  SHORTCUT_GET_STATUS: 'shortcut:get-status',
  SHORTCUT_UPDATE: 'shortcut:update',
  SHORTCUT_RESET: 'shortcut:reset',
  SHORTCUT_SET_ENABLED: 'shortcut:set-enabled',
  SHORTCUT_NAVIGATE: 'shortcut:navigate'
} as const
