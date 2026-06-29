import http from 'http'
import https from 'https'
import { Buffer } from 'buffer'
import type { RequestOptions } from 'https'
import type {
  HttpApiActionResult,
  HttpApiCookieItem,
  HttpApiFormDataItem,
  HttpApiKeyValueItem,
  HttpApiRedirectRecord,
  HttpApiRequestDraft,
  HttpApiResponse,
  HttpApiResponsePreviewKind,
  HttpApiSendRequest,
  HttpApiSendResult
} from '../../../shared/types'

interface PreparedRequest {
  url: URL
  headers: Record<string, string>
  body: Buffer | null
}

interface SingleResponse {
  response: HttpApiResponse
  redirectTo: string | null
  redirectRecord: HttpApiRedirectRecord | null
}

const activeControllers = new Map<string, AbortController>()
const redirectStatuses = new Set([301, 302, 303, 307, 308])
const textDecoder = new TextDecoder('utf-8')

export async function sendHttpApiRequest(payload: HttpApiSendRequest): Promise<HttpApiSendResult> {
  const validation = validateSendRequest(payload)
  if (!validation.success) {
    return {
      success: false,
      status: 'error',
      message: validation.message,
      requestId: payload?.requestId ?? ''
    }
  }

  const controller = new AbortController()
  const startedAt = performance.now()
  activeControllers.set(payload.requestId, controller)

  try {
    const result = await performRequest(payload.request, payload.requestId, controller, startedAt)
    return {
      success: true,
      status: 'completed',
      message: '请求已完成',
      requestId: payload.requestId,
      response: result
    }
  } catch (error) {
    const status = resolveErrorStatus(error)
    return {
      success: false,
      status,
      message: resolveErrorMessage(error, status),
      requestId: payload.requestId
    }
  } finally {
    activeControllers.delete(payload.requestId)
  }
}

export function cancelHttpApiRequest(requestId: string): HttpApiActionResult {
  const controller = activeControllers.get(requestId)
  if (!controller) {
    return { success: false, message: '没有找到正在执行的请求' }
  }

  controller.abort()
  activeControllers.delete(requestId)
  return { success: true, message: '已取消请求' }
}

async function performRequest(
  request: HttpApiRequestDraft,
  requestId: string,
  controller: AbortController,
  startedAt: number
): Promise<HttpApiResponse> {
  let currentUrl = prepareRequest(request).url.toString()
  const redirectChain: HttpApiRedirectRecord[] = []
  const maxRedirects = request.followRedirects ? Math.max(0, Math.min(10, request.maxRedirects)) : 0

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    const currentRequest: HttpApiRequestDraft = { ...request, url: currentUrl }
    const prepared = prepareRequest(currentRequest)
    const single = await sendSingleRequest(currentRequest, prepared, requestId, controller, startedAt, redirectChain)

    if (!single.redirectTo || !request.followRedirects || attempt >= maxRedirects) {
      return single.response
    }

    if (single.redirectRecord) redirectChain.push(single.redirectRecord)
    currentUrl = single.redirectTo
  }

  throw new Error('重定向次数超出限制')
}

function sendSingleRequest(
  request: HttpApiRequestDraft,
  prepared: PreparedRequest,
  requestId: string,
  controller: AbortController,
  startedAt: number,
  redirectChain: HttpApiRedirectRecord[]
): Promise<SingleResponse> {
  const hopStartedAt = performance.now()
  const isHttps = prepared.url.protocol === 'https:'
  const transport = isHttps ? https : http
  const options: RequestOptions = {
    method: request.method,
    protocol: prepared.url.protocol,
    hostname: prepared.url.hostname,
    port: prepared.url.port,
    path: `${prepared.url.pathname}${prepared.url.search}`,
    headers: prepared.headers,
    signal: controller.signal,
    rejectUnauthorized: request.sslVerify
  }

  return new Promise((resolve, reject) => {
    const timeoutMs = Math.max(1, request.timeoutMs || 30000)
    const clientRequest = transport.request(options, (incoming) => {
      const chunks: Buffer[] = []

      incoming.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk))
      })

      incoming.on('end', () => {
        const durationMs = Math.round(performance.now() - startedAt)
        const hopDurationMs = Math.round(performance.now() - hopStartedAt)
        const body = Buffer.concat(chunks)
        const statusCode = incoming.statusCode ?? 0
        const statusText = incoming.statusMessage ?? ''
        const headers = normalizeResponseHeaders(incoming.headers)
        const contentType = getHeaderValue(headers, 'content-type')
        const previewKind = detectPreviewKind(contentType, body)
        const location = getHeaderValue(headers, 'location')
        const redirectTo = redirectStatuses.has(statusCode) && location
          ? new URL(location, prepared.url).toString()
          : null
        const redirectRecord = redirectTo
          ? {
              statusCode,
              statusText,
              fromUrl: prepared.url.toString(),
              toUrl: redirectTo,
              durationMs: hopDurationMs
            }
          : null
        const response: HttpApiResponse = {
          url: prepared.url.toString(),
          statusCode,
          statusText,
          headers,
          durationMs,
          sizeBytes: body.byteLength,
          contentType,
          previewKind,
          bodyText: createBodyText(body, previewKind),
          bodyBase64: previewKind === 'image' ? body.toString('base64') : undefined,
          redirected: redirectChain.length > 0 || Boolean(redirectTo),
          redirectChain: redirectRecord ? [...redirectChain, redirectRecord] : [...redirectChain],
          completedAt: new Date().toISOString()
        }

        resolve({ response, redirectTo, redirectRecord })
      })
    })

    clientRequest.setTimeout(timeoutMs, () => {
      clientRequest.destroy(createRequestError('请求超时', 'ETIMEDOUT'))
    })

    clientRequest.on('error', reject)

    if (prepared.body) {
      clientRequest.write(prepared.body)
    }
    clientRequest.end()
  })
}

export function prepareRequest(request: HttpApiRequestDraft): PreparedRequest {
  const url = createRequestUrl(request.url, request.queryParams)
  const headers = buildRequestHeaders(request)
  const body = buildRequestBody(request, headers)

  if (body && !hasHeader(headers, 'content-length')) {
    headers['Content-Length'] = String(body.byteLength)
  }

  return { url, headers, body }
}

export function createRequestUrl(rawUrl: string, queryParams: HttpApiKeyValueItem[]): URL {
  const url = new URL(rawUrl)
  queryParams
    .filter((item) => item.enabled && item.key.trim())
    .forEach((item) => {
      url.searchParams.append(item.key.trim(), item.value)
    })
  return url
}

function buildRequestHeaders(request: HttpApiRequestDraft): Record<string, string> {
  const headers: Record<string, string> = {}

  request.headers
    .filter((item) => item.enabled && item.key.trim())
    .forEach((item) => {
      headers[item.key.trim()] = item.value
    })

  if (request.auth.type === 'bearer' && request.auth.token.trim() && !hasHeader(headers, 'authorization')) {
    headers.Authorization = `Bearer ${request.auth.token.trim()}`
  }

  if (request.auth.type === 'basic' && !hasHeader(headers, 'authorization')) {
    const token = Buffer.from(`${request.auth.username}:${request.auth.password}`, 'utf8').toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  const cookies = filterCookiesForUrl(request.cookies, request.url)
    .map((item) => `${item.key.trim()}=${item.value}`)
  if (cookies.length > 0 && !hasHeader(headers, 'cookie')) {
    headers.Cookie = cookies.join('; ')
  }

  return headers
}

function buildRequestBody(request: HttpApiRequestDraft, headers: Record<string, string>): Buffer | null {
  if (request.method === 'GET' || request.body.mode === 'none') return null

  if (request.body.mode === 'json') {
    if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json; charset=utf-8'
    return Buffer.from(request.body.json, 'utf8')
  }

  if (request.body.mode === 'text') {
    if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'text/plain; charset=utf-8'
    return Buffer.from(request.body.text, 'utf8')
  }

  if (request.body.mode === 'urlencoded') {
    if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'
    const params = new URLSearchParams()
    request.body.urlencoded
      .filter((item) => item.enabled && item.key.trim())
      .forEach((item) => params.append(item.key.trim(), item.value))
    return Buffer.from(params.toString(), 'utf8')
  }

  if (request.body.mode === 'form-data') {
    const boundary = `----PawKitForm${Date.now().toString(36)}`
    if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`
    return buildMultipartBody(boundary, request.body.formData)
  }

  if (request.body.mode === 'file' && request.body.file) {
    if (request.body.file.type && !hasHeader(headers, 'content-type')) headers['Content-Type'] = request.body.file.type
    return request.body.file.bytes ? toBuffer(request.body.file.bytes) : null
  }

  return null
}

function buildMultipartBody(boundary: string, fields: HttpApiFormDataItem[]): Buffer {
  const chunks: Buffer[] = []
  fields
    .filter((field) => field.enabled && field.key.trim())
    .forEach((field) => {
      chunks.push(Buffer.from(`--${boundary}\r\n`, 'utf8'))
      if (field.type === 'file') {
        const fileName = field.fileName || 'file'
        const fileType = field.fileType || 'application/octet-stream'
        chunks.push(Buffer.from(`Content-Disposition: form-data; name="${escapeMultipartName(field.key)}"; filename="${escapeMultipartName(fileName)}"\r\n`, 'utf8'))
        chunks.push(Buffer.from(`Content-Type: ${fileType}\r\n\r\n`, 'utf8'))
        chunks.push(field.fileBytes ? toBuffer(field.fileBytes) : Buffer.alloc(0))
        chunks.push(Buffer.from('\r\n', 'utf8'))
        return
      }

      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${escapeMultipartName(field.key)}"\r\n\r\n`, 'utf8'))
      chunks.push(Buffer.from(field.value, 'utf8'))
      chunks.push(Buffer.from('\r\n', 'utf8'))
    })
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))
  return Buffer.concat(chunks)
}

function normalizeResponseHeaders(headers: http.IncomingHttpHeaders): HttpApiKeyValueItem[] {
  return Object.entries(headers).map(([key, value], index) => ({
    id: `header-${index}-${key}`,
    key,
    value: Array.isArray(value) ? value.join(', ') : value ?? '',
    enabled: true
  }))
}

export function detectPreviewKind(contentType: string, body: Buffer): HttpApiResponsePreviewKind {
  const normalized = contentType.toLowerCase()
  if (normalized.includes('application/json') || normalized.includes('+json')) return 'json'
  if (normalized.includes('text/html')) return 'html'
  if (normalized.startsWith('text/') || normalized.includes('xml') || normalized.includes('javascript')) return 'text'
  if (normalized.startsWith('image/')) return 'image'

  const sample = body.subarray(0, 256).toString('utf8').trim()
  if ((sample.startsWith('{') && sample.endsWith('}')) || (sample.startsWith('[') && sample.endsWith(']'))) return 'json'
  return 'binary'
}

function createBodyText(body: Buffer, previewKind: HttpApiResponsePreviewKind): string {
  if (previewKind === 'image') return ''
  if (previewKind === 'binary') return `二进制响应，大小 ${body.byteLength} 字节`
  return textDecoder.decode(body)
}

function getHeaderValue(headers: HttpApiKeyValueItem[], key: string): string {
  return headers.find((item) => item.key.toLowerCase() === key.toLowerCase())?.value ?? ''
}

function hasHeader(headers: Record<string, string>, key: string): boolean {
  return Object.keys(headers).some((headerKey) => headerKey.toLowerCase() === key.toLowerCase())
}

function toBuffer(bytes: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(bytes))
}

function escapeMultipartName(value: string): string {
  return value.replaceAll('"', '%22').replaceAll('\r', '').replaceAll('\n', '')
}

function validateSendRequest(payload: HttpApiSendRequest | null | undefined): HttpApiActionResult {
  if (!payload?.requestId || !payload.request) {
    return { success: false, message: 'HTTP 请求参数不完整' }
  }

  try {
    const url = new URL(payload.request.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { success: false, message: '仅支持 HTTP 或 HTTPS 地址' }
    }
  } catch {
    return { success: false, message: '请求地址格式无效' }
  }

  const missingFileMessage = getMissingFileMessage(payload.request)
  if (missingFileMessage) {
    return { success: false, message: missingFileMessage }
  }

  return { success: true, message: '请求参数有效' }
}

function filterCookiesForUrl(cookies: HttpApiCookieItem[], rawUrl: string): HttpApiCookieItem[] {
  const url = new URL(rawUrl)
  return cookies.filter((cookie) => {
    if (!cookie.enabled || !cookie.key.trim()) return false
    if (cookie.domain && !matchesCookieDomain(url.hostname, cookie.domain)) return false
    if (cookie.path && !matchesCookiePath(url.pathname, cookie.path)) return false
    return true
  })
}

function matchesCookieDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  const normalizedDomain = domain.trim().replace(/^\./, '').toLowerCase()
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`)
}

function matchesCookiePath(pathname: string, path: string): boolean {
  const normalizedPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`
  if (normalizedPath === '/') return true
  return pathname === normalizedPath || pathname.startsWith(normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`)
}

function getMissingFileMessage(request: HttpApiRequestDraft): string | null {
  if (request.method === 'GET' || request.body.mode === 'none') return null

  if (request.body.mode === 'file') {
    if (!request.body.file) return '请选择文件请求体'
    if (request.body.file.needsReselect || !request.body.file.bytes) return '文件请求体需要重新选择'
  }

  if (request.body.mode === 'form-data') {
    const missingFile = request.body.formData.find((item) => (
      item.enabled &&
      item.type === 'file' &&
      item.key.trim() &&
      (item.needsReselect || !item.fileBytes)
    ))
    if (missingFile) return `Form Data 文件「${missingFile.key.trim()}」需要重新选择`
  }

  return null
}

function createRequestError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

function resolveErrorStatus(error: unknown): HttpApiSendResult['status'] {
  if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return 'cancelled'
  if (typeof error === 'object' && error && 'code' in error && error.code === 'ETIMEDOUT') return 'timeout'
  return 'error'
}

function resolveErrorMessage(error: unknown, status: HttpApiSendResult['status']): string {
  if (status === 'cancelled') return '请求已取消'
  if (status === 'timeout') return '请求超时'
  if (error instanceof Error) return error.message
  return '请求失败'
}
