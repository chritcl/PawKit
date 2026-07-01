import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: { getAllWindows: () => [] },
  clipboard: {
    readImage: () => ({ isEmpty: () => true }),
    writeImage: vi.fn(),
    writeText: vi.fn()
  },
  dialog: {},
  nativeImage: {
    createFromBuffer: () => ({ isEmpty: () => false })
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
  createBatchOutputPath,
  createIcoBuffer,
  extractImagePalette,
  normalizeImageToolOptions,
  parseImageDataUrl,
  processImageBuffer
} from './image-tool'
import type { ImageToolProcessOptions } from '../../shared/types'

const baseOptions: ImageToolProcessOptions = {
  format: 'png',
  quality: 80,
  metadataStrategy: 'strip',
  crop: { enabled: false, left: 0, top: 0, width: 1, height: 1 },
  resize: { enabled: false, width: undefined, height: undefined, mode: 'inside', withoutEnlargement: true },
  rotate: 0,
  flip: false,
  flop: false,
  background: { enabled: false, color: '#ffffff' },
  roundedCorners: { enabled: false, radius: 8 },
  watermark: { enabled: false, text: '', position: 'bottom-right', opacity: 0.5, fontSize: 16, color: '#ffffff' },
  icon: { sizes: [16, 32], exportPngSet: false }
}

async function createFixture(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: '#1677ff'
    }
  }).png().toBuffer()
}

describe('图片处理服务', () => {
  it('解析图片 Data URL', async () => {
    const buffer = await createFixture()
    const parsed = parseImageDataUrl(`data:image/png;base64,${buffer.toString('base64')}`)

    expect(parsed.mimeType).toBe('image/png')
    expect(parsed.buffer.byteLength).toBe(buffer.byteLength)
  })

  it('规范化图片处理参数', () => {
    const options = normalizeImageToolOptions({
      ...baseOptions,
      format: 'jpeg',
      quality: 180,
      background: { enabled: true, color: 'red' },
      icon: { sizes: [512, 16, 16, 8], exportPngSet: true }
    })

    expect(options.quality).toBe(100)
    expect(options.background?.enabled).toBe(false)
    expect(options.icon?.sizes).toEqual([16, 512])
  })

  it('生成 ICO 容器', () => {
    const first = Buffer.from([1, 2, 3])
    const second = Buffer.from([4, 5])
    const ico = createIcoBuffer([
      { size: 16, buffer: first },
      { size: 256, buffer: second }
    ])

    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico.readUInt8(6)).toBe(16)
    expect(ico.readUInt8(22)).toBe(0)
  })

  it('批量输出命名不会覆盖已有文件', () => {
    const dir = join(tmpdir(), `pawkit-image-tool-test-${Date.now()}`)
    rmSync(dir, { recursive: true, force: true })
    const used = new Set<string>()
    const first = createBatchOutputPath(dir, 'demo.png', 'webp', used)
    const second = createBatchOutputPath(dir, 'demo.png', 'webp', used)

    expect(first.endsWith('demo-pawkit.webp')).toBe(true)
    expect(second.endsWith('demo-pawkit-1.webp')).toBe(true)
    expect(existsSync(first)).toBe(false)
  })

  it('处理 PNG、JPEG、WebP 和 AVIF 输出', async () => {
    const fixture = await createFixture()
    for (const format of ['png', 'jpeg', 'webp', 'avif'] as const) {
      const output = await processImageBuffer(fixture, {
        ...baseOptions,
        format,
        resize: { enabled: true, width: 60, height: 40, mode: 'fill', withoutEnlargement: false }
      })
      const metadata = await sharp(output.buffer).metadata()

      expect(output.format).toBe(format)
      expect(metadata.width).toBe(60)
      expect(metadata.height).toBe(40)
    }
  })

  it('提取图片主色和色板', async () => {
    const fixture = await createFixture()
    const palette = await extractImagePalette(fixture, 3)

    expect(palette.length).toBeGreaterThan(0)
    expect(palette[0].hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
