/// <reference types="vite/client" />

import { ElectronAPI } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

declare module '*.png' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.jpeg' {
  const value: string
  export default value
}

declare module '*.gif' {
  const value: string
  export default value
}

declare module '*.webp' {
  const value: string
  export default value
}

declare module '*.ico' {
  const value: string
  export default value
}

declare module 'qrcode' {
  const QRCode: {
    toDataURL: (text: string, options?: {
      width?: number
      margin?: number
      color?: { dark?: string; light?: string }
    }) => Promise<string>
  }
  export default QRCode
}
