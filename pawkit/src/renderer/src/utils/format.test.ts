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

  it('支持 emoji、多行和空格 Base64 往返', () => {
    const source = '  PawKit 编码转换 👋\n第二行  '
    const encoded = base64Encode(source)
    const decoded = base64Decode(encoded.result)

    expect(encoded.success).toBe(true)
    expect(decoded.success).toBe(true)
    expect(decoded.result).toBe(source)
  })

  it('支持 URL-safe Base64 padding 自动补齐', () => {
    const encoded = base64UrlEncode('PawKit?')
    expect(encoded.success).toBe(true)
    expect(encoded.result).not.toContain('=')

    const decoded = base64UrlDecode(encoded.result)
    expect(decoded.result).toBe('PawKit?')
  })

  it('提示非法 Base64 输入', () => {
    const decoded = base64Decode('PawKit====')

    expect(decoded.success).toBe(false)
    expect(decoded.error).toContain('Base64')
  })

  it('支持 URL 编解码', () => {
    const encoded = urlEncode('q=PawKit 编码')
    expect(encoded.result).toBe('q%3DPawKit%20%E7%BC%96%E7%A0%81')
    expect(urlDecode(encoded.result).result).toBe('q=PawKit 编码')
  })

  it('提示非法 URL 编码片段', () => {
    const decoded = urlDecode('%E7%BC%')

    expect(decoded.success).toBe(false)
    expect(decoded.error).toContain('%')
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

  it('支持两段 JWT', () => {
    const token = [
      base64UrlEncode('{"alg":"none"}').result,
      base64UrlEncode('{"name":"PawKit"}').result
    ].join('.')
    const decoded = decodeJwt(token)

    expect(decoded.success).toBe(true)
    expect(decoded.signature).toBe('')
  })

  it('提示非法 JWT 分段', () => {
    const decoded = decodeJwt('header.payload.signature.extra')

    expect(decoded.success).toBe(false)
    expect(decoded.error).toContain('分段')
  })

  it('提示 JWT Base64URL 非法内容', () => {
    const decoded = decodeJwt(`!!!.${base64UrlEncode('{"name":"PawKit"}').result}`)

    expect(decoded.success).toBe(false)
    expect(decoded.error).toContain('Base64URL')
  })

  it('提示 JWT JSON 解析失败', () => {
    const token = [
      base64UrlEncode('not json').result,
      base64UrlEncode('{"name":"PawKit"}').result,
      'signature'
    ].join('.')
    const decoded = decodeJwt(token)

    expect(decoded.success).toBe(false)
    expect(decoded.error).toContain('JSON')
  })

  it('解析文本 Data URL', () => {
    const result = parseDataUrl(`data:text/plain;base64,${base64Encode('你好').result}`)

    expect(result.success).toBe(true)
    expect(result.mediaType).toBe('text/plain')
    expect(result.isBase64).toBe(true)
    expect(result.textPreviewable).toBe(true)
    expect(result.decodedPreview).toBe('你好')
  })

  it('解析非文本 Data URL 时不做文本预览', () => {
    const result = parseDataUrl('data:image/png;base64,iVBORw0KGgo=')

    expect(result.success).toBe(true)
    expect(result.mediaType).toBe('image/png')
    expect(result.textPreviewable).toBe(false)
    expect(result.decodedPreview).toBe('无法按文本预览')
    expect(result.decodedByteLength).toBeGreaterThan(0)
  })
})
