// 编码转换结果
export interface FormatResult {
  success: boolean
  result: string
  error?: string
}

// JWT 解码结果
export interface JwtDecodeResult {
  success: boolean
  header?: unknown
  payload?: unknown
  headerJson?: string
  payloadJson?: string
  signature?: string
  error?: string
}

// Data URL 解析结果
export interface DataUrlParseResult {
  success: boolean
  mediaType?: string
  isBase64?: boolean
  data?: string
  decodedPreview?: string
  error?: string
}

// 文本转 Base64
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

// Base64 转文本
function base64ToText(encoded: string): string {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

// 补齐 Base64 padding
export function normalizeBase64(input: string): string {
  const compact = input.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padding = compact.length % 4
  return padding === 0 ? compact : `${compact}${'='.repeat(4 - padding)}`
}

// Base64 编码
export function base64Encode(text: string): FormatResult {
  try {
    return { success: true, result: textToBase64(text) }
  } catch {
    return { success: false, result: '', error: '编码失败，输入可能包含无效字符' }
  }
}

// Base64 解码
export function base64Decode(encoded: string): FormatResult {
  try {
    return { success: true, result: base64ToText(normalizeBase64(encoded)) }
  } catch {
    return { success: false, result: '', error: '解码失败，请确保输入是有效的 Base64 字符串' }
  }
}

// URL-safe Base64 编码
export function base64UrlEncode(text: string): FormatResult {
  const result = base64Encode(text)
  if (!result.success) return result
  return {
    success: true,
    result: result.result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
}

// URL-safe Base64 解码
export function base64UrlDecode(encoded: string): FormatResult {
  return base64Decode(encoded)
}

// URL 编码
export function urlEncode(text: string): FormatResult {
  try {
    return { success: true, result: encodeURIComponent(text) }
  } catch {
    return { success: false, result: '', error: '编码失败' }
  }
}

// URL 解码
export function urlDecode(encoded: string): FormatResult {
  try {
    return { success: true, result: decodeURIComponent(encoded) }
  } catch {
    return { success: false, result: '', error: '解码失败，请确保输入是有效的 URL 编码字符串' }
  }
}

// 解码 JWT
export function decodeJwt(token: string): JwtDecodeResult {
  const parts = token.trim().split('.')
  if (parts.length < 2) {
    return { success: false, error: 'JWT 至少需要 header 和 payload 两段' }
  }

  const headerText = base64UrlDecode(parts[0])
  const payloadText = base64UrlDecode(parts[1])
  if (!headerText.success || !payloadText.success) {
    return { success: false, error: 'JWT 分段不是有效的 Base64URL' }
  }

  try {
    const header = JSON.parse(headerText.result)
    const payload = JSON.parse(payloadText.result)
    return {
      success: true,
      header,
      payload,
      headerJson: JSON.stringify(header, null, 2),
      payloadJson: JSON.stringify(payload, null, 2),
      signature: parts[2] ?? ''
    }
  } catch {
    return { success: false, error: 'JWT header 或 payload 不是有效 JSON' }
  }
}

// 解析 Data URL
export function parseDataUrl(input: string): DataUrlParseResult {
  const match = input.trim().match(/^data:([^;,]+)?((?:;[^,]*)?),([\s\S]*)$/)
  if (!match) {
    return { success: false, error: '不是有效的 Data URL' }
  }

  const mediaType = match[1] || 'text/plain'
  const flags = match[2] || ''
  const data = match[3] || ''
  const isBase64 = flags.includes(';base64')
  let decodedPreview = ''

  try {
    decodedPreview = isBase64
      ? base64ToText(normalizeBase64(data)).slice(0, 2000)
      : decodeURIComponent(data).slice(0, 2000)
  } catch {
    decodedPreview = '内容无法按文本预览'
  }

  return {
    success: true,
    mediaType,
    isBase64,
    data,
    decodedPreview
  }
}
