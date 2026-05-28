// 剪贴板配置
export const CLIPBOARD_CONFIG = {
  // 轮询间隔（毫秒）
  pollInterval: 800,
  // 普通历史最多保留条数（收藏项不参与限制）
  maxHistoryCount: 200,
  // 单条文本最大长度（超过则不加入历史，但不影响系统剪贴板）
  maxTextLength: 20000,
  // 本应用写入剪贴板后的保护时间（毫秒，需大于 pollInterval）
  internalWriteProtectDuration: 1000
}
