import { ElectronAPI } from '../shared/types'

// 声明全局类型
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
