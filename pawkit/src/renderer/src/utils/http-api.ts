import type {
  HttpApiAuthConfig,
  HttpApiBodyMode,
  HttpApiCookieItem,
  HttpApiEnvironment,
  HttpApiFormDataItem,
  HttpApiHistoryItem,
  HttpApiKeyValueItem,
  HttpApiMethod,
  HttpApiRequestBody,
  HttpApiRequestDraft,
  HttpApiResponse,
  HttpApiResponsePreviewKind,
  HttpApiSendResult
} from '../../../shared/types'

export const HTTP_API_HISTORY_LIMIT = 100
export const HTTP_API_HISTORY_BODY_LIMIT = 20000
export const HTTP_API_FILE_LIMIT_BYTES = 25 * 1024 * 1024

const methods: HttpApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function createHttpApiId(prefix = 'http'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function createKeyValueItem(key = '', value = '', enabled = true): HttpApiKeyValueItem {
  return { id: createHttpApiId('kv'), key, value, enabled }
}

export function createCookieItem(key = '', value = '', enabled = true, domain?: string, path?: string): HttpApiCookieItem {
  return { id: createHttpApiId('cookie'), key, value, enabled, domain, path }
}

export function createDefaultBody(mode: HttpApiBodyMode = 'none'): HttpApiRequestBody {
  return {
    mode,
    text: '',
    json: '{\n  \n}',
    urlencoded: [createKeyValueItem()],
    formData: [createFormDataItem()],
    file: null
  }
}

export function createFormDataItem(key = '', value = '', type: 'text' | 'file' = 'text'): HttpApiFormDataItem {
  return {
    ...createKeyValueItem(key, value),
    type
  }
}

export function createDefaultHttpApiDraft(): HttpApiRequestDraft {
  const now = new Date().toISOString()
  return {
    id: createHttpApiId('request'),
    name: '未命名请求',
    method: 'GET',
    url: 'https://httpbin.org/get',
    queryParams: [createKeyValueItem()],
    headers: [createKeyValueItem()],
    auth: { type: 'none' },
    cookies: [createKeyValueItem()],
    body: createDefaultBody(),
    timeoutMs: 30000,
    sslVerify: true,
    followRedirects: true,
    maxRedirects: 5,
    environmentId: null,
    createdAt: now,
    updatedAt: now
  }
}

export function cloneRequestForSave(request: HttpApiRequestDraft): HttpApiRequestDraft {
  const now = new Date().toISOString()
  return {
    ...request,
    id: createHttpApiId('request'),
    name: request.name || `${request.method} ${request.url}`,
    createdAt: now,
    updatedAt: now
  }
}

export function trimHttpApiHistory<T>(history: T[], limit = HTTP_API_HISTORY_LIMIT): T[] {
  return history.slice(0, Math.max(0, limit))
}

export function sanitizeHttpApiRequestForStorage(request: HttpApiRequestDraft): HttpApiRequestDraft {
  return {
    ...request,
    body: {
      ...request.body,
      formData: request.body.formData.map((item) => ({
        ...item,
        fileBytes: undefined,
        needsReselect: item.type === 'file' ? Boolean(item.fileName || item.fileBytes || item.needsReselect) : undefined
      })),
      file: request.body.file
        ? {
            name: request.body.file.name,
            type: request.body.file.type,
            size: request.body.file.size,
            needsReselect: true
          }
        : null
    }
  }
}

export function sanitizeHttpApiResponseForHistory(response: HttpApiResponse | undefined): HttpApiResponse | null {
  if (!response) return null
  const bodyTruncated = response.bodyText.length > HTTP_API_HISTORY_BODY_LIMIT
  const imageBodyUnavailable = response.previewKind === 'image' && Boolean(response.bodyBase64)
  return {
    ...response,
    bodyText: response.bodyText.slice(0, HTTP_API_HISTORY_BODY_LIMIT),
    bodyBase64: undefined,
    bodyTruncated: response.bodyTruncated || bodyTruncated || undefined,
    bodyUnavailable: response.bodyUnavailable || imageBodyUnavailable || undefined,
    bodyUnavailableReason: imageBodyUnavailable
      ? '图片响应未保存到历史，请重新发送请求查看预览'
      : response.bodyUnavailableReason
  }
}

export function createHttpApiHistoryItem(
  draft: HttpApiRequestDraft,
  sentRequest: HttpApiRequestDraft,
  result: HttpApiSendResult,
  createdAt = new Date().toISOString()
): HttpApiHistoryItem {
  return {
    id: createHttpApiId('history'),
    request: sanitizeHttpApiRequestForStorage(draft),
    sentRequest: sanitizeHttpApiRequestForStorage(sentRequest),
    response: sanitizeHttpApiResponseForHistory(result.response),
    success: result.success,
    message: result.message,
    createdAt
  }
}

export function resolveEnvironmentVariables(text: string, environment: HttpApiEnvironment | null): string {
  if (!environment) return text
  const variables = new Map(
    environment.variables
      .filter((item) => item.enabled && item.key.trim())
      .map((item) => [item.key.trim(), item.value])
  )

  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => variables.get(key) ?? match)
}

export function applyEnvironmentToRequest(
  request: HttpApiRequestDraft,
  environment: HttpApiEnvironment | null
): HttpApiRequestDraft {
  const resolve = (value: string): string => resolveEnvironmentVariables(value, environment)
  const mapItems = <T extends HttpApiKeyValueItem>(items: T[]): T[] => items.map((item) => ({
    ...item,
    key: resolve(item.key),
    value: resolve(item.value)
  }))

  return {
    ...request,
    url: resolve(request.url),
    queryParams: mapItems(request.queryParams),
    headers: mapItems(request.headers),
    cookies: mapItems(request.cookies),
    auth: resolveAuth(request.auth, resolve),
    body: {
      ...request.body,
      text: resolve(request.body.text),
      json: resolve(request.body.json),
      urlencoded: mapItems(request.body.urlencoded),
      formData: request.body.formData.map((item) => ({
        ...item,
        key: resolve(item.key),
        value: resolve(item.value)
      }))
    }
  }
}

export function buildHttpApiUrl(rawUrl: string, queryParams: HttpApiKeyValueItem[]): string {
  const url = new URL(rawUrl)
  queryParams
    .filter((item) => item.enabled && item.key.trim())
    .forEach((item) => url.searchParams.append(item.key.trim(), item.value))
  return url.toString()
}

export function filterCookiesForUrl(cookies: HttpApiCookieItem[], rawUrl: string): HttpApiCookieItem[] {
  const url = new URL(rawUrl)
  return cookies.filter((cookie) => {
    if (!cookie.enabled || !cookie.key.trim()) return false
    if (cookie.domain && !matchesCookieDomain(url.hostname, cookie.domain)) return false
    if (cookie.path && !matchesCookiePath(url.pathname, cookie.path)) return false
    return true
  })
}

export function getHttpApiMissingFileMessage(request: HttpApiRequestDraft): string | null {
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

export function collectEffectiveHeaders(request: HttpApiRequestDraft): HttpApiKeyValueItem[] {
  const headers = request.headers
    .filter((item) => item.enabled && item.key.trim())
    .map((item) => ({ ...item, key: item.key.trim() }))

  if (request.auth.type === 'bearer' && request.auth.token.trim() && !hasHeader(headers, 'authorization')) {
    headers.push(createKeyValueItem('Authorization', `Bearer ${request.auth.token.trim()}`))
  }

  if (request.auth.type === 'basic' && !hasHeader(headers, 'authorization')) {
    const token = btoaUtf8(`${request.auth.username}:${request.auth.password}`)
    headers.push(createKeyValueItem('Authorization', `Basic ${token}`))
  }

  const cookies = filterCookiesForUrl(request.cookies, request.url)
    .map((item) => `${item.key.trim()}=${item.value}`)
  if (cookies.length > 0 && !hasHeader(headers, 'cookie')) {
    headers.push(createKeyValueItem('Cookie', cookies.join('; ')))
  }

  const contentType = getBodyContentType(request.body)
  if (contentType && !hasHeader(headers, 'content-type')) {
    headers.push(createKeyValueItem('Content-Type', contentType))
  }

  return headers
}

export function exportRequestToCurl(request: HttpApiRequestDraft): string {
  const parts = ['curl']
  parts.push('-X', quoteShell(request.method))
  parts.push(quoteShell(buildHttpApiUrl(request.url, request.queryParams)))

  collectEffectiveHeaders(request).forEach((header) => {
    parts.push('-H', quoteShell(`${header.key}: ${header.value}`))
  })

  if (request.method !== 'GET' && request.body.mode === 'form-data') {
    request.body.formData
      .filter((item) => item.enabled && item.key.trim())
      .forEach((item) => {
        const value = item.type === 'file' ? `@${item.fileName ?? 'file'}` : item.value
        parts.push('-F', quoteShell(`${item.key}=${value}`))
      })
  } else if (request.method !== 'GET' && request.body.mode === 'urlencoded') {
    request.body.urlencoded
      .filter((item) => item.enabled && item.key.trim())
      .forEach((item) => {
        parts.push('--data-urlencode', quoteShell(`${item.key.trim()}=${item.value}`))
      })
  } else if (request.method !== 'GET' && request.body.mode === 'file' && request.body.file) {
    parts.push('--data-binary', quoteShell(`@${request.body.file.name}`))
  } else {
    const body = getSerializableBody(request)
    if (body) parts.push('--data-raw', quoteShell(body))
  }

  if (request.followRedirects) parts.push('--location')
  if (!request.sslVerify) parts.push('--insecure')
  return parts.join(' ')
}

export function importCurlToRequest(curl: string): { success: true; request: HttpApiRequestDraft } | { success: false; error: string } {
  const tokens = tokenizeCurl(curl)
  if (tokens.length === 0 || tokens[0] !== 'curl') return { success: false, error: '请输入以 curl 开头的命令' }

  const request = createDefaultHttpApiDraft()
  request.headers = []
  request.queryParams = []
  request.cookies = []
  request.body = createDefaultBody('none')
  let nextUrl = ''

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]

    if ((token === '-X' || token === '--request') && next) {
      const method = next.toUpperCase()
      if (!methods.includes(method as HttpApiMethod)) return { success: false, error: `不支持的请求方法：${next}` }
      request.method = method as HttpApiMethod
      index += 1
      continue
    }

    if (token === '--url' && next) {
      nextUrl = next
      index += 1
      continue
    }

    if ((token === '-H' || token === '--header') && next) {
      const separatorIndex = next.indexOf(':')
      if (separatorIndex < 0) return { success: false, error: `Header 格式无效：${next}` }
      const key = next.slice(0, separatorIndex).trim()
      const value = next.slice(separatorIndex + 1).trim()
      if (key.toLowerCase() === 'cookie') {
        request.cookies.push(...parseCookieHeader(value))
      } else {
        request.headers.push(createKeyValueItem(key, value))
      }
      index += 1
      continue
    }

    if (['-d', '--data', '--data-raw', '--data-binary'].includes(token) && next) {
      if (token === '--data-binary' && next.startsWith('@')) {
        request.body.mode = 'file'
        request.body.file = {
          name: next.slice(1) || 'file',
          type: 'application/octet-stream',
          size: 0,
          needsReselect: true
        }
      } else {
        request.body.mode = 'text'
        request.body.text = next
      }
      if (request.method === 'GET') request.method = 'POST'
      index += 1
      continue
    }

    if ((token === '--data-urlencode' || token === '--url-query') && next) {
      const splitIndex = next.indexOf('=')
      const key = splitIndex >= 0 ? next.slice(0, splitIndex) : next
      const value = splitIndex >= 0 ? next.slice(splitIndex + 1) : ''
      request.body.mode = 'urlencoded'
      request.body.urlencoded = request.body.urlencoded.filter((item) => item.key.trim())
      request.body.urlencoded.push(createKeyValueItem(key, value))
      if (request.method === 'GET') request.method = 'POST'
      index += 1
      continue
    }

    if ((token === '-F' || token === '--form' || token === '--form-string') && next) {
      request.body.mode = 'form-data'
      const splitIndex = next.indexOf('=')
      if (splitIndex < 0) return { success: false, error: `Form Data 格式无效：${next}` }
      const value = next.slice(splitIndex + 1)
      const item = createFormDataItem(next.slice(0, splitIndex), value.startsWith('@') && token !== '--form-string' ? '' : value, value.startsWith('@') && token !== '--form-string' ? 'file' : 'text')
      if (item.type === 'file') {
        item.fileName = value.slice(1)
        item.needsReselect = true
      }
      request.body.formData = request.body.formData.filter((field) => field.key.trim())
      request.body.formData.push(item)
      if (request.method === 'GET') request.method = 'POST'
      index += 1
      continue
    }

    if ((token === '-b' || token === '--cookie' || token === '--cookie-jar') && next) {
      request.cookies.push(...parseCookieHeader(next))
      index += 1
      continue
    }

    if ((token === '-u' || token === '--user') && next) {
      const [username, ...passwordParts] = next.split(':')
      request.auth = { type: 'basic', username, password: passwordParts.join(':') }
      index += 1
      continue
    }

    if (token === '-L' || token === '--location') {
      request.followRedirects = true
      continue
    }

    if (token === '-k' || token === '--insecure') {
      request.sslVerify = false
      continue
    }

    if (['--compressed', '-s', '--silent', '-v', '--verbose', '-i', '--include'].includes(token)) {
      continue
    }

    if (!token.startsWith('-')) {
      nextUrl = token
      continue
    }

    return { success: false, error: `不支持的 cURL 片段：${token}` }
  }

  if (!nextUrl) return { success: false, error: 'cURL 中缺少请求地址' }
  try {
    const urlResult = splitUrlQueryParams(nextUrl)
    request.url = urlResult.url
    request.queryParams = [...urlResult.queryParams, ...request.queryParams]
    request.name = `${request.method} ${nextUrl}`
    return { success: true, request }
  } catch {
    return { success: false, error: 'cURL 中的请求地址格式无效' }
  }
}

export function generateRequestCode(request: HttpApiRequestDraft, target: 'fetch' | 'axios' | 'java' | 'python'): string {
  const url = buildHttpApiUrl(request.url, request.queryParams)
  const headers = collectEffectiveHeaders(request)

  if (target === 'fetch') return generateFetchCode(request, url, headers)
  if (target === 'axios') return generateAxiosCode(request, url, headers)
  if (target === 'java') return generateJavaCode(request, url, headers)
  return generatePythonCode(request, url, headers)
}

export function detectHttpApiPreviewKind(contentType: string): HttpApiResponsePreviewKind {
  const value = contentType.toLowerCase()
  if (value.includes('application/json') || value.includes('+json')) return 'json'
  if (value.includes('text/html')) return 'html'
  if (value.startsWith('text/') || value.includes('xml') || value.includes('javascript')) return 'text'
  if (value.startsWith('image/')) return 'image'
  return 'binary'
}

export function parseSetCookieHeaders(headers: HttpApiKeyValueItem[]): HttpApiCookieItem[] {
  return headers
    .filter((header) => header.key.toLowerCase() === 'set-cookie' && header.value.trim())
    .flatMap((header) => splitSetCookieHeader(header.value))
    .map((cookie) => parseSetCookieValue(cookie))
    .filter((cookie): cookie is HttpApiCookieItem => Boolean(cookie))
}

function generateFetchCode(
  request: HttpApiRequestDraft,
  url: string,
  headers: HttpApiKeyValueItem[]
): string {
  const bodyLines = generateFetchBodyLines(request)
  return [
    ...bodyLines.setup,
    `const response = await fetch(${JSON.stringify(url)}, {`,
    `  method: ${JSON.stringify(request.method)},`,
    `  headers: ${JSON.stringify(Object.fromEntries(headers.map((item) => [item.key, item.value])), null, 2).replace(/\n/g, '\n  ')},`,
    bodyLines.body ? `  body: ${bodyLines.body},` : '',
    '});',
    'const data = await response.text();'
  ].filter(Boolean).join('\n')
}

function generateAxiosCode(
  request: HttpApiRequestDraft,
  url: string,
  headers: HttpApiKeyValueItem[]
): string {
  const bodyLines = generateFetchBodyLines(request)
  const lines = [
    'import axios from "axios";',
    '',
    ...bodyLines.setup,
    'const response = await axios.request({',
    `  method: ${JSON.stringify(request.method)},`,
    `  url: ${JSON.stringify(url)},`,
    `  headers: ${JSON.stringify(Object.fromEntries(headers.map((item) => [item.key, item.value])), null, 2).replace(/\n/g, '\n  ')},`
  ]
  if (bodyLines.body) lines.push(`  data: ${bodyLines.body},`)
  lines.push('});')
  return lines.join('\n')
}

function generateJavaCode(
  request: HttpApiRequestDraft,
  url: string,
  headers: HttpApiKeyValueItem[]
): string {
  const lines = [
    'HttpClient client = HttpClient.newHttpClient();',
    `HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create(${JSON.stringify(url)}));`
  ]
  if (request.method !== 'GET' && request.body.mode === 'form-data' && !hasHeader(headers, 'content-type')) {
    lines.push('String boundary = "----PawKitBoundary";')
    lines.push('builder.header("Content-Type", "multipart/form-data; boundary=" + boundary);')
  }
  headers.forEach((header) => lines.push(`builder.header(${JSON.stringify(header.key)}, ${JSON.stringify(header.value)});`))
  const publisher = getJavaBodyPublisher(request)
  lines.push(`HttpRequest request = builder.method(${JSON.stringify(request.method)}, ${publisher}).build();`)
  lines.push('HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());')
  return lines.join('\n')
}

function generatePythonCode(
  request: HttpApiRequestDraft,
  url: string,
  headers: HttpApiKeyValueItem[]
): string {
  const body = getPythonBodyLines(request)
  const lines = [
    'import requests',
    '',
    `response = requests.request(${JSON.stringify(request.method)}, ${JSON.stringify(url)},`,
    `    headers=${JSON.stringify(Object.fromEntries(headers.map((item) => [item.key, item.value])), null, 4).replace(/\n/g, '\n    ')},`
  ]
  lines.push(...body)
  lines.push(')')
  return lines.join('\n')
}

function splitUrlQueryParams(rawUrl: string): { url: string; queryParams: HttpApiKeyValueItem[] } {
  const url = new URL(rawUrl)
  const queryParams = Array.from(url.searchParams.entries()).map(([key, value]) => createKeyValueItem(key, value))
  url.search = ''
  url.hash = ''
  return { url: url.toString(), queryParams }
}

function parseCookieHeader(value: string): HttpApiCookieItem[] {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const splitIndex = part.indexOf('=')
      if (splitIndex < 0) return null
      return createCookieItem(part.slice(0, splitIndex).trim(), part.slice(splitIndex + 1).trim())
    })
    .filter((item): item is HttpApiCookieItem => Boolean(item?.key))
}

function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;,=\s]+=)/g).map((item) => item.trim()).filter(Boolean)
}

function parseSetCookieValue(value: string): HttpApiCookieItem | null {
  const parts = value.split(';').map((part) => part.trim()).filter(Boolean)
  const [nameValue, ...attributes] = parts
  if (!nameValue) return null

  const splitIndex = nameValue.indexOf('=')
  if (splitIndex < 0) return null

  let domain: string | undefined
  let path: string | undefined
  attributes.forEach((attribute) => {
    const attributeIndex = attribute.indexOf('=')
    if (attributeIndex < 0) return
    const key = attribute.slice(0, attributeIndex).trim().toLowerCase()
    const attributeValue = attribute.slice(attributeIndex + 1).trim()
    if (key === 'domain') domain = attributeValue
    if (key === 'path') path = attributeValue
  })

  return createCookieItem(
    nameValue.slice(0, splitIndex).trim(),
    nameValue.slice(splitIndex + 1).trim(),
    true,
    domain,
    path
  )
}

function generateFetchBodyLines(request: HttpApiRequestDraft): { setup: string[]; body: string } {
  if (request.method === 'GET' || request.body.mode === 'none') return { setup: [], body: '' }

  if (request.body.mode === 'json') return { setup: [], body: JSON.stringify(request.body.json) }
  if (request.body.mode === 'text') return { setup: [], body: JSON.stringify(request.body.text) }

  if (request.body.mode === 'urlencoded') {
    const params = Object.fromEntries(
      request.body.urlencoded
        .filter((item) => item.enabled && item.key.trim())
        .map((item) => [item.key.trim(), item.value])
    )
    return {
      setup: [`const body = new URLSearchParams(${JSON.stringify(params, null, 2)});`],
      body: 'body'
    }
  }

  if (request.body.mode === 'form-data') {
    const setup = ['const body = new FormData();']
    request.body.formData
      .filter((item) => item.enabled && item.key.trim())
      .forEach((item) => {
        if (item.type === 'file') {
          setup.push(`body.append(${JSON.stringify(item.key.trim())}, new Blob([]), ${JSON.stringify(item.fileName || 'file')});`)
        } else {
          setup.push(`body.append(${JSON.stringify(item.key.trim())}, ${JSON.stringify(item.value)});`)
        }
      })
    return { setup, body: 'body' }
  }

  if (request.body.mode === 'file' && request.body.file) {
    return {
      setup: [`const body = new Blob([], { type: ${JSON.stringify(request.body.file.type || 'application/octet-stream')} });`],
      body: 'body'
    }
  }

  return { setup: [], body: '' }
}

function getJavaBodyPublisher(request: HttpApiRequestDraft): string {
  if (request.method === 'GET' || request.body.mode === 'none') return 'HttpRequest.BodyPublishers.noBody()'
  if (request.body.mode === 'file' && request.body.file) return `HttpRequest.BodyPublishers.ofFile(Path.of(${JSON.stringify(request.body.file.name)}))`
  return `HttpRequest.BodyPublishers.ofString(${JSON.stringify(getSerializableBody(request))})`
}

function getPythonBodyLines(request: HttpApiRequestDraft): string[] {
  if (request.method === 'GET' || request.body.mode === 'none') return []

  if (request.body.mode === 'urlencoded') {
    const data = Object.fromEntries(
      request.body.urlencoded
        .filter((item) => item.enabled && item.key.trim())
        .map((item) => [item.key.trim(), item.value])
    )
    return [`    data=${JSON.stringify(data, null, 4).replace(/\n/g, '\n    ')},`]
  }

  if (request.body.mode === 'form-data') {
    const data = Object.fromEntries(
      request.body.formData
        .filter((item) => item.enabled && item.key.trim() && item.type === 'text')
        .map((item) => [item.key.trim(), item.value])
    )
    const files = request.body.formData
      .filter((item) => item.enabled && item.key.trim() && item.type === 'file')
      .map((item) => `${JSON.stringify(item.key.trim())}: (${JSON.stringify(item.fileName || 'file')}, open(${JSON.stringify(item.fileName || 'file')}, "rb"))`)
    const lines: string[] = []
    if (Object.keys(data).length > 0) lines.push(`    data=${JSON.stringify(data, null, 4).replace(/\n/g, '\n    ')},`)
    if (files.length > 0) lines.push(`    files={${files.join(', ')}},`)
    return lines
  }

  if (request.body.mode === 'file' && request.body.file) {
    return [`    data=open(${JSON.stringify(request.body.file.name)}, "rb"),`]
  }

  const body = getSerializableBody(request)
  return body ? [`    data=${JSON.stringify(body)},`] : []
}

function resolveAuth(auth: HttpApiAuthConfig, resolve: (value: string) => string): HttpApiAuthConfig {
  if (auth.type === 'bearer') return { type: 'bearer', token: resolve(auth.token) }
  if (auth.type === 'basic') return { type: 'basic', username: resolve(auth.username), password: resolve(auth.password) }
  return auth
}

function getBodyContentType(body: HttpApiRequestBody): string {
  if (body.mode === 'json') return 'application/json; charset=utf-8'
  if (body.mode === 'text') return 'text/plain; charset=utf-8'
  if (body.mode === 'urlencoded') return 'application/x-www-form-urlencoded; charset=utf-8'
  return ''
}

function getSerializableBody(request: HttpApiRequestDraft): string {
  if (request.method === 'GET' || request.body.mode === 'none') return ''
  if (request.body.mode === 'json') return request.body.json
  if (request.body.mode === 'text') return request.body.text
  if (request.body.mode === 'urlencoded') {
    const params = new URLSearchParams()
    request.body.urlencoded
      .filter((item) => item.enabled && item.key.trim())
      .forEach((item) => params.append(item.key.trim(), item.value))
    return params.toString()
  }
  if (request.body.mode === 'file') return request.body.file ? `@${request.body.file.name}` : ''
  return ''
}

function hasHeader(headers: HttpApiKeyValueItem[], key: string): boolean {
  return headers.some((item) => item.key.toLowerCase() === key.toLowerCase())
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

function btoaUtf8(value: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(value)))
  return Buffer.from(value, 'utf8').toString('base64')
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function tokenizeCurl(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of command.trim()) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (char === quote) quote = null
      else current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) tokens.push(current)
  return tokens
}
