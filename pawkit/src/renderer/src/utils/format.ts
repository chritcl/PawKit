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
  dataLength?: number
  decodedByteLength?: number
  textPreviewable?: boolean
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function validateBase64(input: string): string {
  const compact = input.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const content = compact.replace(/=+$/g, '')
  const paddingLength = compact.length - content.length
  if (paddingLength > 2 || /[^A-Za-z0-9+/=]/.test(compact) || /=/.test(content)) {
    throw new Error('解码失败：Base64 包含非法字符或 padding 位置不正确')
  }
  if (paddingLength > 0 && ![2, 3].includes(content.length % 4)) {
    throw new Error('解码失败：Base64 padding 数量不匹配')
  }
  if (content.length % 4 === 1) {
    throw new Error('解码失败：Base64 长度不合法，请检查 padding 和输入内容')
  }
  return content
}

function base64ToBytes(encoded: string): Uint8Array {
  const content = validateBase64(encoded)
  const padding = content.length % 4
  const normalized = padding === 0 ? content : `${content}${'='.repeat(4 - padding)}`
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

// Base64 转文本
function base64ToText(encoded: string): string {
  const bytes = base64ToBytes(encoded)
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
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
    return { success: true, result: base64ToText(encoded) }
  } catch (error) {
    const message = getErrorMessage(error)
    if (message.startsWith('解码失败')) {
      return { success: false, result: '', error: message }
    }
    return { success: false, result: '', error: '解码失败：内容不是有效的 UTF-8 文本' }
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
    return { success: false, result: '', error: '解码失败：存在不完整的 % 转义或非法编码片段' }
  }
}

// 解码 JWT
export function decodeJwt(token: string): JwtDecodeResult {
  const parts = token.trim().split('.')
  if (parts.length < 2) {
    return { success: false, error: 'JWT 至少需要 header 和 payload 两段' }
  }
  if (parts.length > 3 || parts.some((part, index) => index < 2 && !part)) {
    return { success: false, error: 'JWT 分段数量或内容不正确，应包含 header、payload 和可选 signature' }
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

function isTextMediaType(mediaType: string): boolean {
  const normalized = mediaType.toLowerCase()
  return normalized.startsWith('text/') ||
    normalized === 'application/json' ||
    normalized === 'application/xml' ||
    normalized === 'application/javascript' ||
    normalized === 'application/x-www-form-urlencoded' ||
    normalized === 'image/svg+xml' ||
    normalized.endsWith('+json') ||
    normalized.endsWith('+xml')
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
  const textPreviewable = isTextMediaType(mediaType)
  let decodedPreview = textPreviewable ? '' : '无法按文本预览'
  let decodedByteLength = data.length

  try {
    if (isBase64) {
      const bytes = base64ToBytes(data)
      decodedByteLength = bytes.byteLength
      if (textPreviewable) {
        decodedPreview = new TextDecoder('utf-8', { fatal: true }).decode(bytes).slice(0, 2000)
      }
    } else {
      const decodedText = decodeURIComponent(data)
      decodedByteLength = new TextEncoder().encode(decodedText).byteLength
      if (textPreviewable) {
        decodedPreview = decodedText.slice(0, 2000)
      }
    }
  } catch {
    return {
      success: false,
      error: isBase64 ? 'Data URL 中的 Base64 数据不合法' : 'Data URL 的 URL 编码数据不合法'
    }
  }

  return {
    success: true,
    mediaType,
    isBase64,
    data,
    dataLength: data.length,
    decodedByteLength,
    textPreviewable,
    decodedPreview
  }
}
