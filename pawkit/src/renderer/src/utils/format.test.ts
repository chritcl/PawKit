import { describe, expect, it } from 'vitest'
import {
  base64Decode,
  base64Encode,
  base64UrlDecode,
  base64UrlEncode,
  decodeJwt,
  parseDataUrl,
  urlDecode,
  urlEncode
} from './format'

describe('编码转换工具函数', () => {
  it('支持中文 Base64 编解码', () => {
    const encoded = base64Encode('PawKit 编码转换')
    expect(encoded.success).toBe(true)

    const decoded = base64Decode(encoded.result)
    expect(decoded.result).toBe('PawKit 编码转换')
  })

  it('支持 URL-safe Base64 padding 自动补齐', () => {
    const encoded = base64UrlEncode('PawKit?')
    expect(encoded.success).toBe(true)
    expect(encoded.result).not.toContain('=')

    const decoded = base64UrlDecode(encoded.result)
    expect(decoded.result).toBe('PawKit?')
  })

  it('支持 URL 编解码', () => {
    const encoded = urlEncode('q=PawKit 编码')
    expect(encoded.result).toBe('q%3DPawKit%20%E7%BC%96%E7%A0%81')
    expect(urlDecode(encoded.result).result).toBe('q=PawKit 编码')
  })

  it('解码 JWT header 和 payload', () => {
    const token = [
      base64UrlEncode('{"alg":"HS256","typ":"JWT"}').result,
      base64UrlEncode('{"name":"PawKit"}').result,
      'signature'
    ].join('.')
    const decoded = decodeJwt(token)

    expect(decoded.success).toBe(true)
    expect(decoded.payloadJson).toContain('"name": "PawKit"')
  })

  it('解析 Data URL', () => {
    const result = parseDataUrl(`data:text/plain;base64,${base64Encode('你好').result}`)

    expect(result.success).toBe(true)
    expect(result.mediaType).toBe('text/plain')
    expect(result.isBase64).toBe(true)
    expect(result.decodedPreview).toBe('你好')
  })
})
