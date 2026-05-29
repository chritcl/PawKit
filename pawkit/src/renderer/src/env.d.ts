/// <reference types="vite/client" />

import { ElectronAPI } from '../../shared/types'
import type { JSX as ReactJSX } from 'react'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }

  namespace JSX {
    type Element = ReactJSX.Element
    type IntrinsicElements = ReactJSX.IntrinsicElements
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
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
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      color?: { dark?: string; light?: string }
    }) => Promise<string>
  }
  export default QRCode
}
