import { tmpdir } from 'os'
import sharp from 'sharp'
import QRCode from 'qrcode'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    isPackaged: false
  },
  BrowserWindow: { getAllWindows: () => [] },
  clipboard: {
    readImage: () => ({ isEmpty: () => true }),
    writeText: vi.fn()
  },
  nativeImage: {
    createFromBuffer: () => ({
      getSize: () => ({ width: 120, height: 80 })
    })
  },
  shell: {}
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false }
}))

vi.mock('./clipboard-service', () => ({
  getClipboardHistory: () => []
}))

import {
  buildCodeText,
  buildParagraphText,
  buildTableResult,
  detectQrFromImage,
  extractColorsFromImage,
  extractDetectedUrls
} from './ocr-service'

async function createDataUrl(buffer: Buffer): Promise<string> {
  const png = await sharp(buffer).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

describe('OCR 服务后处理', () => {
  it('提取 HTTP、HTTPS 和裸域名 URL', () => {
    const urls = extractDetectedUrls('访问 https://pawkit.app/docs，备用地址 pawkit.dev/path 和 http://localhost:5573')

    expect(urls.map((item) => item.normalized)).toEqual([
      'https://pawkit.app/docs',
      'https://pawkit.dev/path',
      'http://localhost:5573/'
    ])
  })

  it('保留 OCR 段落结构', () => {
    const text = buildParagraphText([
      { text: '第一段', paragraphs: [{ text: '第一段 第一行\n第二行' }] },
      { text: '第二段', paragraphs: [{ text: 'Second paragraph' }] }
    ], '')

    expect(text).toBe('第一段 第一行 第二行\n\nSecond paragraph')
  })

  it('代码模式保留换行和缩进', () => {
    const text = buildCodeText('function demo() {   \n  return 1\n}\n\n')

    expect(text).toBe('function demo() {\n  return 1\n}')
  })

  it('从对齐文本生成 Markdown 和 TSV 表格', () => {
    const table = buildTableResult('名称  数量  状态\n苹果  12  正常\n梨  3  缺货')

    expect(table?.rows).toEqual([
      ['名称', '数量', '状态'],
      ['苹果', '12', '正常'],
      ['梨', '3', '缺货']
    ])
    expect(table?.markdown).toContain('| 名称 | 数量 | 状态 |')
    expect(table?.tsv).toContain('苹果\t12\t正常')
  })

  it('本地识别二维码图片', async () => {
    const dataUrl = await QRCode.toDataURL('https://pawkit.app/ocr-test', { margin: 2, width: 240 })
    const result = await detectQrFromImage({
      source: { kind: 'data-url', dataUrl },
      mode: 'auto'
    })

    expect(result.success).toBe(true)
    expect(result.qrCodes?.[0]?.text).toBe('https://pawkit.app/ocr-test')
  })

  it('从图片 Data URL 提取颜色', async () => {
    const buffer = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 4,
        background: '#12a594'
      }
    }).png().toBuffer()
    const result = await extractColorsFromImage({
      source: { kind: 'data-url', dataUrl: await createDataUrl(buffer) },
      mode: 'auto'
    })

    expect(result.success).toBe(true)
    expect(result.colors?.[0]?.hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
