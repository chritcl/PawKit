// 剪贴板配置
export const CLIPBOARD_CONFIG = {
  // 轮询间隔（毫秒）
  pollInterval: 800,
  // 普通历史最多保留条数（收藏项不参与限制）
  maxHistoryCount: 200,
  // 单条文本最大长度（超过则不加入历史，但不影响系统剪贴板）
  maxTextLength: 20000,
  // 富文本和文件预览最大长度
  maxPreviewLength: 2000,
  // 单张图片原始字节数阈值（超过则保存压缩版，但仍加入历史）
  maxImageBytes: 10 * 1024 * 1024,
  // 图片历史保存版最大边长
  maxImageStorageSize: 1600,
  // 图片历史缩略图最大边长
  maxImageThumbnailSize: 220,
  // 本应用写入剪贴板后的保护时间（毫秒，需大于 pollInterval）
  internalWriteProtectDuration: 1000
}
