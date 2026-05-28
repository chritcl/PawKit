import { is } from '@electron-toolkit/utils'

// 统一日志工具（仅开发环境输出 debug）
export const logger = {
  debug: (...args: unknown[]): void => {
    if (is.dev) console.log('[PawKit]', ...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn('[PawKit]', ...args)
  },
  error: (...args: unknown[]): void => {
    console.error('[PawKit]', ...args)
  }
}
