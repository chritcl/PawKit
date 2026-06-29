import http from 'http'
import { afterEach, describe, expect, it } from 'vitest'
import { cancelHttpApiRequest, createRequestUrl, detectPreviewKind, prepareRequest, sendHttpApiRequest } from './index'
import type { HttpApiRequestDraft } from '../../../shared/types'

let server: http.Server | null = null

afterEach(async () => {
  if (!server) return
  await new Promise<void>((resolve) => {
    server?.close(() => resolve())
  })
  server = null
})

function createDraft(url: string): HttpApiRequestDraft {
  const now = new Date().toISOString()
  return {
    id: 'request-1',
    name: '测试请求',
    method: 'GET',
    url,
    queryParams: [],
    headers: [],
    auth: { type: 'none' },
    cookies: [],
    body: {
      mode: 'none',
      text: '',
      json: '',
      urlencoded: [],
      formData: [],
      file: null
    },
    timeoutMs: 3000,
    sslVerify: true,
    followRedirects: true,
    maxRedirects: 5,
    environmentId: null,
    createdAt: now,
    updatedAt: now
  }
}

async function listen(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler)
  await new Promise<void>((resolve) => {
    server?.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('测试服务启动失败')
  return `http://127.0.0.1:${address.port}`
}

describe('HTTP API 主进程请求服务', () => {
  it('合成请求 URL', () => {
    const url = createRequestUrl('https://example.com/search?a=1', [
      { id: 'q', key: 'q', value: 'PawKit', enabled: true }
    ])

    expect(url.toString()).toBe('https://example.com/search?a=1&q=PawKit')
  })

  it('合成请求 URL 时保留重复 Query key', () => {
    const url = createRequestUrl('https://example.com/search?ids=0', [
      { id: 'ids-1', key: 'ids', value: '1', enabled: true },
      { id: 'ids-2', key: 'ids', value: '2', enabled: true }
    ])

    expect(url.toString()).toBe('https://example.com/search?ids=0&ids=1&ids=2')
  })

  it('准备 Header、Cookie、Basic Auth 和 JSON 请求体', () => {
    const request = createDraft('https://example.com/users')
    request.method = 'POST'
    request.auth = { type: 'basic', username: 'user', password: 'pass' }
    request.cookies = [{ id: 'cookie', key: 'sid', value: 'abc', enabled: true }]
    request.body.mode = 'json'
    request.body.json = '{"name":"PawKit"}'

    const prepared = prepareRequest(request)

    expect(prepared.headers.Authorization).toBe('Basic dXNlcjpwYXNz')
    expect(prepared.headers.Cookie).toBe('sid=abc')
    expect(prepared.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(prepared.body?.toString('utf8')).toBe('{"name":"PawKit"}')
  })

  it('准备 Cookie 时按 Domain 和 Path 过滤', () => {
    const request = createDraft('https://api.example.com/app/users')
    request.cookies = [
      { id: 'sid', key: 'sid', value: 'abc', enabled: true, domain: 'example.com', path: '/app' },
      { id: 'hostOnly', key: 'hostOnly', value: 'yes', enabled: true },
      { id: 'otherDomain', key: 'otherDomain', value: 'no', enabled: true, domain: 'other.com' },
      { id: 'otherPath', key: 'otherPath', value: 'no', enabled: true, domain: 'example.com', path: '/admin' }
    ]

    const prepared = prepareRequest(request)

    expect(prepared.headers.Cookie).toBe('sid=abc; hostOnly=yes')
  })

  it('准备 URL Encoded、multipart 和文件请求体', () => {
    const request = createDraft('https://example.com/users')
    request.method = 'POST'
    request.body.mode = 'urlencoded'
    request.body.urlencoded = [{ id: 'name', key: 'name', value: '噗噗', enabled: true }]
    expect(prepareRequest(request).body?.toString('utf8')).toBe('name=%E5%99%97%E5%99%97')

    request.body.mode = 'form-data'
    request.body.formData = [
      { id: 'field', key: 'name', value: 'PawKit', enabled: true, type: 'text' },
      {
        id: 'file',
        key: 'avatar',
        value: '',
        enabled: true,
        type: 'file',
        fileName: 'avatar.txt',
        fileType: 'text/plain',
        fileBytes: new TextEncoder().encode('file').buffer
      }
    ]
    const multipart = prepareRequest(request)
    expect(multipart.headers['Content-Type']).toContain('multipart/form-data; boundary=')
    expect(multipart.body?.toString('utf8')).toContain('name="avatar"; filename="avatar.txt"')

    request.body.mode = 'file'
    request.body.file = { name: 'raw.txt', type: 'text/plain', size: 3, bytes: new TextEncoder().encode('raw').buffer }
    const file = prepareRequest(request)
    expect(file.headers['Content-Type']).toBe('text/plain')
    expect(file.body?.toString('utf8')).toBe('raw')
  })

  it('发送请求并记录重定向链', async () => {
    const baseUrl = await listen((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: '/json' })
        response.end()
        return
      }

      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
    })
    const result = await sendHttpApiRequest({
      requestId: 'send-1',
      request: createDraft(`${baseUrl}/redirect`)
    })

    expect(result.success).toBe(true)
    expect(result.response?.statusCode).toBe(200)
    expect(result.response?.previewKind).toBe('json')
    expect(result.response?.redirectChain).toHaveLength(1)
  })

  it('不跟随重定向时也记录重定向目标', async () => {
    const baseUrl = await listen((_request, response) => {
      response.writeHead(302, { Location: '/target' })
      response.end()
    })
    const request = createDraft(`${baseUrl}/redirect`)
    request.followRedirects = false

    const result = await sendHttpApiRequest({
      requestId: 'send-no-follow',
      request
    })

    expect(result.success).toBe(true)
    expect(result.response?.statusCode).toBe(302)
    expect(result.response?.redirectChain).toEqual([
      expect.objectContaining({
        statusCode: 302,
        fromUrl: `${baseUrl}/redirect`,
        toUrl: `${baseUrl}/target`
      })
    ])
  })

  it('请求超时时返回 timeout 状态', async () => {
    const baseUrl = await listen((_request, response) => {
      setTimeout(() => {
        response.writeHead(200)
        response.end('ok')
      }, 80)
    })
    const request = createDraft(baseUrl)
    request.timeoutMs = 20

    const result = await sendHttpApiRequest({
      requestId: 'send-timeout',
      request
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('timeout')
  })

  it('缺少文件字节时返回明确错误', async () => {
    const request = createDraft('https://example.com/upload')
    request.method = 'POST'
    request.body.mode = 'file'
    request.body.file = {
      name: 'demo.txt',
      type: 'text/plain',
      size: 4,
      needsReselect: true
    }

    const result = await sendHttpApiRequest({
      requestId: 'send-missing-file',
      request
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe('文件请求体需要重新选择')
  })

  it('取消请求时返回 cancelled 状态', async () => {
    const baseUrl = await listen((_request, response) => {
      setTimeout(() => {
        response.writeHead(200)
        response.end('ok')
      }, 80)
    })
    const pending = sendHttpApiRequest({
      requestId: 'send-cancel',
      request: createDraft(baseUrl)
    })

    expect(cancelHttpApiRequest('send-cancel').success).toBe(true)
    const result = await pending

    expect(result.success).toBe(false)
    expect(result.status).toBe('cancelled')
  })

  it('识别响应预览类型', () => {
    expect(detectPreviewKind('application/json', Buffer.from('{}'))).toBe('json')
    expect(detectPreviewKind('text/html', Buffer.from('<html></html>'))).toBe('html')
    expect(detectPreviewKind('text/plain', Buffer.from('hello'))).toBe('text')
    expect(detectPreviewKind('image/png', Buffer.from([0]))).toBe('image')
    expect(detectPreviewKind('application/octet-stream', Buffer.from([0]))).toBe('binary')
  })
})
