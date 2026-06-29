import { describe, expect, it } from 'vitest'
import {
  applyEnvironmentToRequest,
  buildHttpApiUrl,
  collectEffectiveHeaders,
  createCookieItem,
  createDefaultHttpApiDraft,
  createHttpApiHistoryItem,
  createKeyValueItem,
  detectHttpApiPreviewKind,
  exportRequestToCurl,
  filterCookiesForUrl,
  generateRequestCode,
  getHttpApiMissingFileMessage,
  importCurlToRequest,
  parseSetCookieHeaders,
  resolveEnvironmentVariables
} from './http-api'
import type { HttpApiEnvironment, HttpApiKeyValueItem, HttpApiSendResult } from '../../../shared/types'

describe('HTTP API 调试工具函数', () => {
  it('合成 Query 参数并保留原始 URL 参数', () => {
    const url = buildHttpApiUrl('https://example.com/users?page=1', [
      createKeyValueItem('q', 'PawKit 调试'),
      createKeyValueItem('disabled', 'no', false)
    ])

    expect(url).toBe('https://example.com/users?page=1&q=PawKit+%E8%B0%83%E8%AF%95')
  })

  it('合成 Query 参数时保留重复 key', () => {
    const url = buildHttpApiUrl('https://example.com/users?ids=0', [
      createKeyValueItem('ids', '1'),
      createKeyValueItem('ids', '2')
    ])

    expect(url).toBe('https://example.com/users?ids=0&ids=1&ids=2')
  })

  it('按 Header 优先级合成鉴权和 Cookie', () => {
    const request = createDefaultHttpApiDraft()
    request.headers = [createKeyValueItem('X-Trace', 'abc')]
    request.auth = { type: 'bearer', token: 'token-1' }
    request.cookies = [createKeyValueItem('sid', 'cookie-1')]

    const headers = collectEffectiveHeaders(request)

    expect(headers.find((item) => item.key === 'Authorization')?.value).toBe('Bearer token-1')
    expect(headers.find((item) => item.key === 'Cookie')?.value).toBe('sid=cookie-1')
    expect(headers.find((item) => item.key === 'X-Trace')?.value).toBe('abc')
  })

  it('按请求地址过滤 Cookie 的 Domain 和 Path', () => {
    const cookies = [
      createCookieItem('sid', 'abc', true, 'example.com', '/app'),
      createCookieItem('hostOnly', 'yes'),
      createCookieItem('otherDomain', 'no', true, 'other.com'),
      createCookieItem('otherPath', 'no', true, 'example.com', '/admin')
    ]

    expect(filterCookiesForUrl(cookies, 'https://api.example.com/app/users').map((item) => item.key)).toEqual([
      'sid',
      'hostOnly'
    ])

    const request = createDefaultHttpApiDraft()
    request.url = 'https://api.example.com/app/users'
    request.cookies = cookies
    expect(collectEffectiveHeaders(request).find((item) => item.key === 'Cookie')?.value).toBe('sid=abc; hostOnly=yes')
  })

  it('缺少文件字节时给出重新选择提示', () => {
    const request = createDefaultHttpApiDraft()
    request.method = 'POST'
    request.body.mode = 'file'
    request.body.file = {
      name: 'demo.txt',
      type: 'text/plain',
      size: 4,
      needsReselect: true
    }

    expect(getHttpApiMissingFileMessage(request)).toBe('文件请求体需要重新选择')

    request.body.file = {
      name: 'demo.txt',
      type: 'text/plain',
      size: 4,
      bytes: new ArrayBuffer(4)
    }
    expect(getHttpApiMissingFileMessage(request)).toBeNull()

    request.body.mode = 'form-data'
    request.body.formData = [
      { ...createKeyValueItem('avatar', ''), type: 'file', fileName: 'avatar.png', needsReselect: true }
    ]
    expect(getHttpApiMissingFileMessage(request)).toBe('Form Data 文件「avatar」需要重新选择')
  })

  it('用户手写 Authorization 时不被 Auth 配置覆盖', () => {
    const request = createDefaultHttpApiDraft()
    request.headers = [createKeyValueItem('Authorization', 'Custom abc')]
    request.auth = { type: 'bearer', token: 'token-1' }

    const headers = collectEffectiveHeaders(request)

    expect(headers.filter((item) => item.key.toLowerCase() === 'authorization')).toHaveLength(1)
    expect(headers[0].value).toBe('Custom abc')
  })

  it('替换环境变量', () => {
    const environment: HttpApiEnvironment = {
      id: 'env-1',
      name: '本地',
      variables: [
        createKeyValueItem('baseUrl', 'https://api.example.com'),
        createKeyValueItem('token', 'secret')
      ],
      createdAt: '',
      updatedAt: ''
    }
    const request = createDefaultHttpApiDraft()
    request.url = '{{baseUrl}}/users'
    request.auth = { type: 'bearer', token: '{{token}}' }

    const resolved = applyEnvironmentToRequest(request, environment)

    expect(resolveEnvironmentVariables('Bearer {{token}}', environment)).toBe('Bearer secret')
    expect(resolved.url).toBe('https://api.example.com/users')
    expect(resolved.auth).toEqual({ type: 'bearer', token: 'secret' })
  })

  it('导入常见 cURL 命令', () => {
    const result = importCurlToRequest("curl -X POST 'https://example.com/users' -H 'X-Trace: abc' -d '{\"name\":\"PawKit\"}' -u user:pass --location")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.request.method).toBe('POST')
    expect(result.request.url).toBe('https://example.com/users')
    expect(result.request.headers[0].key).toBe('X-Trace')
    expect(result.request.body.text).toBe('{"name":"PawKit"}')
    expect(result.request.auth).toEqual({ type: 'basic', username: 'user', password: 'pass' })
  })

  it('导入 cURL 时拆分 Query、Cookie、URL Encoded 和 Form Data', () => {
    const result = importCurlToRequest("curl --url 'https://example.com/users?page=1&q=PawKit' -b 'sid=abc; theme=dark' --data-urlencode 'name=噗噗' --form-string 'note=hello' -F 'avatar=@avatar.png' --compressed -s -v")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.request.method).toBe('POST')
    expect(result.request.url).toBe('https://example.com/users')
    expect(result.request.queryParams.map((item) => [item.key, item.value])).toEqual([
      ['page', '1'],
      ['q', 'PawKit']
    ])
    expect(result.request.cookies.map((item) => [item.key, item.value])).toEqual([
      ['sid', 'abc'],
      ['theme', 'dark']
    ])
    expect(result.request.body.mode).toBe('form-data')
    expect(result.request.body.urlencoded.map((item) => [item.key, item.value])).toEqual([['name', '噗噗']])
    expect(result.request.body.formData.map((item) => [item.key, item.type, item.value, item.fileName])).toEqual([
      ['note', 'text', 'hello', undefined],
      ['avatar', 'file', '', 'avatar.png']
    ])
  })

  it('历史项同时保存草稿请求和实际发送请求', () => {
    const draft = createDefaultHttpApiDraft()
    draft.url = '{{baseUrl}}/users'
    draft.environmentId = 'env-1'

    const sentRequest = {
      ...draft,
      url: 'https://api.example.com/users',
      environmentId: null
    }
    const result: HttpApiSendResult = {
      success: true,
      status: 'completed',
      message: '请求已完成',
      requestId: 'send-1',
      response: {
        url: sentRequest.url,
        statusCode: 200,
        statusText: 'OK',
        headers: [],
        durationMs: 12,
        sizeBytes: 11,
        contentType: 'application/json',
        previewKind: 'json',
        bodyText: '{"ok":true}',
        redirected: false,
        redirectChain: [],
        completedAt: '2026-06-29T00:00:00.000Z'
      }
    }

    const item = createHttpApiHistoryItem(draft, sentRequest, result, '2026-06-29T00:00:00.000Z')

    expect(item.request.url).toBe('{{baseUrl}}/users')
    expect(item.request.environmentId).toBe('env-1')
    expect(item.sentRequest?.url).toBe('https://api.example.com/users')
    expect(item.sentRequest?.environmentId).toBeNull()
    expect(item.response?.bodyText).toBe('{"ok":true}')
  })

  it('导出 cURL 命令', () => {
    const request = createDefaultHttpApiDraft()
    request.method = 'POST'
    request.url = 'https://example.com/users'
    request.body.mode = 'json'
    request.body.json = '{"name":"PawKit"}'

    const curl = exportRequestToCurl(request)

    expect(curl).toContain("curl -X 'POST'")
    expect(curl).toContain("--data-raw '{\"name\":\"PawKit\"}'")
    expect(curl).toContain("'Content-Type: application/json; charset=utf-8'")
  })

  it('导出 cURL 时包含 Cookie、URL Encoded、Form Data 和选项', () => {
    const request = createDefaultHttpApiDraft()
    request.method = 'POST'
    request.url = 'https://example.com/upload'
    request.cookies = [createKeyValueItem('sid', 'abc')]
    request.sslVerify = false
    request.followRedirects = true
    request.body.mode = 'form-data'
    request.body.formData = [
      { ...createKeyValueItem('name', '噗噗'), type: 'text' },
      { ...createKeyValueItem('avatar', ''), type: 'file', fileName: 'avatar.png' }
    ]

    const formCurl = exportRequestToCurl(request)
    expect(formCurl).toContain("'Cookie: sid=abc'")
    expect(formCurl).toContain("-F 'name=噗噗'")
    expect(formCurl).toContain("-F 'avatar=@avatar.png'")
    expect(formCurl).toContain('--location')
    expect(formCurl).toContain('--insecure')

    request.body.mode = 'urlencoded'
    request.body.urlencoded = [createKeyValueItem('name', '噗噗')]
    const encodedCurl = exportRequestToCurl(request)
    expect(encodedCurl).toContain("--data-urlencode 'name=噗噗'")
  })

  it('生成 Fetch、Axios、Java、Python 请求代码', () => {
    const request = createDefaultHttpApiDraft()
    request.method = 'POST'
    request.body.mode = 'text'
    request.body.text = 'hello'

    expect(generateRequestCode(request, 'fetch')).toContain('fetch(')
    expect(generateRequestCode(request, 'axios')).toContain('axios.request')
    expect(generateRequestCode(request, 'java')).toContain('HttpClient')
    expect(generateRequestCode(request, 'python')).toContain('requests.request')
  })

  it('生成代码时覆盖 URL Encoded、Form Data 和文件请求体', () => {
    const request = createDefaultHttpApiDraft()
    request.method = 'POST'
    request.body.mode = 'urlencoded'
    request.body.urlencoded = [createKeyValueItem('name', 'PawKit')]
    expect(generateRequestCode(request, 'fetch')).toContain('URLSearchParams')
    expect(generateRequestCode(request, 'axios')).toContain('URLSearchParams')
    expect(generateRequestCode(request, 'java')).toContain('application/x-www-form-urlencoded')
    expect(generateRequestCode(request, 'python')).toContain('data=')

    request.body.mode = 'form-data'
    request.body.formData = [
      { ...createKeyValueItem('name', 'PawKit'), type: 'text' },
      { ...createKeyValueItem('file', ''), type: 'file', fileName: 'demo.txt' }
    ]
    expect(generateRequestCode(request, 'fetch')).toContain('FormData')
    expect(generateRequestCode(request, 'axios')).toContain('FormData')
    expect(generateRequestCode(request, 'java')).toContain('multipart/form-data')
    expect(generateRequestCode(request, 'python')).toContain('files=')

    request.body.mode = 'file'
    request.body.file = { name: 'demo.txt', type: 'text/plain', size: 4, bytes: new ArrayBuffer(4) }
    expect(generateRequestCode(request, 'fetch')).toContain('Blob')
    expect(generateRequestCode(request, 'axios')).toContain('Blob')
    expect(generateRequestCode(request, 'java')).toContain('Path.of')
    expect(generateRequestCode(request, 'python')).toContain('open(')
  })

  it('识别响应预览类型', () => {
    expect(detectHttpApiPreviewKind('application/json')).toBe('json')
    expect(detectHttpApiPreviewKind('text/html; charset=utf-8')).toBe('html')
    expect(detectHttpApiPreviewKind('text/plain')).toBe('text')
    expect(detectHttpApiPreviewKind('image/png')).toBe('image')
    expect(detectHttpApiPreviewKind('application/octet-stream')).toBe('binary')
  })

  it('从 Set-Cookie 响应头解析 Cookie 项', () => {
    const headers: HttpApiKeyValueItem[] = [
      createKeyValueItem('Set-Cookie', 'sid=abc; Path=/; Domain=example.com; HttpOnly'),
      createKeyValueItem('set-cookie', 'theme=dark; Path=/app')
    ]

    expect(parseSetCookieHeaders(headers).map((item) => ({
      key: item.key,
      value: item.value,
      domain: item.domain,
      path: item.path
    }))).toEqual([
      { key: 'sid', value: 'abc', domain: 'example.com', path: '/' },
      { key: 'theme', value: 'dark', domain: undefined, path: '/app' }
    ])
  })
})
