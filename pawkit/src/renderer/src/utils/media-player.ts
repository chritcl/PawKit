export type StreamProtocolType = 'http' | 'https' | 'ws' | 'wss' | 'rtsp'

export type StreamInputMode = 'auto' | 'hls' | 'direct' | 'ws' | 'wss' | 'rtsp'

export type ResolvedStreamType = 'hls' | 'direct' | 'ws' | 'wss' | 'rtsp'

export interface StreamValidationResult {
  valid: boolean
  url: string
  message: string
}

export interface DetectedStreamProtocol {
  protocol: StreamProtocolType
  streamType: ResolvedStreamType
  needsProxy: boolean
}

const SUPPORTED_NETWORK_PROTOCOLS: Record<string, StreamProtocolType> = {
  'http:': 'http',
  'https:': 'https',
  'ws:': 'ws',
  'wss:': 'wss',
  'rtsp:': 'rtsp'
}

function isProxyStreamType(streamType: ResolvedStreamType): boolean {
  return streamType === 'ws' || streamType === 'wss' || streamType === 'rtsp'
}

function isHlsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const path = decodeURIComponent(parsed.pathname).toLowerCase()
    return path.endsWith('.m3u8') || path.includes('.m3u8/')
  } catch {
    return url.toLowerCase().includes('.m3u8')
  }
}

export function validateNetworkMediaUrl(input: string): StreamValidationResult {
  const value = input.trim()
  if (!value) {
    return { valid: false, url: '', message: '请输入网络媒体地址' }
  }

  try {
    const url = new URL(value)
    if (!SUPPORTED_NETWORK_PROTOCOLS[url.protocol]) {
      return { valid: false, url: '', message: '仅支持 HTTP、HTTPS、WS、WSS 或 RTSP 地址' }
    }
    return { valid: true, url: url.href, message: '地址有效' }
  } catch {
    return { valid: false, url: '', message: '网络媒体地址格式无效' }
  }
}

export function detectStreamProtocol(url: string, mode: StreamInputMode = 'auto'): DetectedStreamProtocol {
  const parsed = new URL(url)
  const protocol = SUPPORTED_NETWORK_PROTOCOLS[parsed.protocol]
  if (!protocol) {
    throw new Error('不支持的网络媒体协议')
  }

  if (protocol === 'ws' || protocol === 'wss' || protocol === 'rtsp') {
    return { protocol, streamType: protocol, needsProxy: true }
  }

  if (mode !== 'auto') {
    return { protocol, streamType: mode, needsProxy: isProxyStreamType(mode) }
  }

  const streamType = isHlsUrl(url) ? 'hls' : 'direct'
  return { protocol, streamType, needsProxy: false }
}

export function inferStreamType(url: string, mode: StreamInputMode): ResolvedStreamType {
  if (mode !== 'auto') return mode

  try {
    return detectStreamProtocol(url, mode).streamType
  } catch {
    if (isHlsUrl(url)) return 'hls'
    return 'direct'
  }
}

export function createMediaTitle(source: string): string {
  const value = source.trim()
  if (!value) return '未命名媒体'

  if (/^[a-zA-Z]:[\\/]/.test(value) || value.includes('\\')) {
    const cleanPath = value.replace(/\\/g, '/')
    const name = cleanPath.split('/').filter(Boolean).at(-1)
    return name || '本地媒体'
  }

  try {
    const url = new URL(value)
    const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
    const lastSegment = segments.at(-1)
    return lastSegment || url.hostname || '网络媒体'
  } catch {
    const cleanPath = value.replace(/\\/g, '/')
    const name = cleanPath.split('/').filter(Boolean).at(-1)
    return name || '本地媒体'
  }
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'

  const total = Math.floor(seconds)
  const hour = Math.floor(total / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const second = total % 60

  if (hour > 0) {
    return [hour, minute, second].map((value) => String(value).padStart(2, '0')).join(':')
  }

  return [minute, second].map((value) => String(value).padStart(2, '0')).join(':')
}

export function formatMediaBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function clampMediaVolume(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}
