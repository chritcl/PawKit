import { describe, expect, it } from 'vitest'
import {
  clampMediaVolume,
  clearProxySessionForItem,
  createMediaTitle,
  detectStreamProtocol,
  formatMediaBytes,
  formatPlaybackTime,
  getNextActiveMediaIdAfterRemoval,
  inferStreamType,
  isCurrentProxySessionEvent,
  shouldApplyProxyStartResult,
  validateNetworkMediaUrl
} from './media-player'

describe('媒体播放器工具函数', () => {
  it('允许媒体播放器支持的网络媒体地址协议', () => {
    expect(validateNetworkMediaUrl('https://example.com/live/index.m3u8')).toEqual({
      valid: true,
      url: 'https://example.com/live/index.m3u8',
      message: '地址有效'
    })
    expect(validateNetworkMediaUrl('ws://camera.local/live')).toEqual({
      valid: true,
      url: 'ws://camera.local/live',
      message: '地址有效'
    })
    expect(validateNetworkMediaUrl('wss://camera.local/live')).toEqual({
      valid: true,
      url: 'wss://camera.local/live',
      message: '地址有效'
    })
    expect(validateNetworkMediaUrl('rtsp://camera.local/live')).toEqual({
      valid: true,
      url: 'rtsp://camera.local/live',
      message: '地址有效'
    })
    expect(validateNetworkMediaUrl('file:///C:/video.mp4').valid).toBe(false)
    expect(validateNetworkMediaUrl('javascript:alert(1)').valid).toBe(false)
  })

  it('按输入模式和后缀推断串流类型', () => {
    expect(inferStreamType('https://example.com/live.m3u8', 'auto')).toBe('hls')
    expect(inferStreamType('https://example.com/live.m3u8?token=abc', 'auto')).toBe('hls')
    expect(inferStreamType('https://example.com/video.mp4', 'auto')).toBe('direct')
    expect(inferStreamType('https://example.com/video.mp4', 'hls')).toBe('hls')
    expect(inferStreamType('https://example.com/live.m3u8', 'direct')).toBe('direct')
    expect(inferStreamType('ws://example.com/live', 'auto')).toBe('ws')
    expect(inferStreamType('wss://example.com/live', 'auto')).toBe('wss')
    expect(inferStreamType('rtsp://example.com/live', 'auto')).toBe('rtsp')
  })

  it('检测串流协议和代理需求', () => {
    expect(detectStreamProtocol('https://example.com/live.m3u8')).toEqual({
      protocol: 'https',
      streamType: 'hls',
      needsProxy: false
    })
    expect(detectStreamProtocol('https://example.com/video.mp4')).toEqual({
      protocol: 'https',
      streamType: 'direct',
      needsProxy: false
    })
    expect(detectStreamProtocol('ws://camera.local/live')).toEqual({
      protocol: 'ws',
      streamType: 'ws',
      needsProxy: true
    })
    expect(detectStreamProtocol('wss://camera.local/live')).toEqual({
      protocol: 'wss',
      streamType: 'wss',
      needsProxy: true
    })
    expect(detectStreamProtocol('rtsp://camera.local/live')).toEqual({
      protocol: 'rtsp',
      streamType: 'rtsp',
      needsProxy: true
    })
  })

  it('从路径或 URL 生成可读标题', () => {
    expect(createMediaTitle('https://example.com/live/camera%201.m3u8?token=abc')).toBe('camera 1.m3u8')
    expect(createMediaTitle('C:\\media\\demo.mp4')).toBe('demo.mp4')
    expect(createMediaTitle('')).toBe('未命名媒体')
  })

  it('格式化播放时间和媒体大小', () => {
    expect(formatPlaybackTime(0)).toBe('00:00')
    expect(formatPlaybackTime(65.8)).toBe('01:05')
    expect(formatPlaybackTime(3661)).toBe('01:01:01')
    expect(formatPlaybackTime(Number.NaN)).toBe('00:00')

    expect(formatMediaBytes(0)).toBe('0 B')
    expect(formatMediaBytes(512)).toBe('512 B')
    expect(formatMediaBytes(1536)).toBe('1.5 KB')
    expect(formatMediaBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('限制音量到媒体元素可接受范围', () => {
    expect(clampMediaVolume(-1)).toBe(0)
    expect(clampMediaVolume(0.42)).toBe(0.42)
    expect(clampMediaVolume(2)).toBe(1)
    expect(clampMediaVolume(Number.NaN)).toBe(1)
  })

  it('移除当前播放项后选择相邻播放项', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    expect(getNextActiveMediaIdAfterRemoval(items, 'b', 'b')).toBe('c')
    expect(getNextActiveMediaIdAfterRemoval(items, 'c', 'c')).toBe('b')
    expect(getNextActiveMediaIdAfterRemoval(items, 'a', 'b')).toBe('a')
    expect(getNextActiveMediaIdAfterRemoval([{ id: 'a' }], 'a', 'a')).toBeNull()
  })

  it('只允许仍存在且仍激活的代理启动结果写回播放项', () => {
    const items = [{ id: 'proxy-1' }, { id: 'proxy-2' }]

    expect(shouldApplyProxyStartResult(items, 'proxy-1', 'proxy-1')).toBe(true)
    expect(shouldApplyProxyStartResult(items, 'proxy-1', 'proxy-2')).toBe(false)
    expect(shouldApplyProxyStartResult(items, 'missing', 'missing')).toBe(false)
    expect(shouldApplyProxyStartResult(items, 'proxy-1', null)).toBe(false)
  })

  it('代理停止事件只清理匹配会话的播放项', () => {
    const items = [
      { id: 'proxy-1', sessionId: 'session-1', proxyUrl: 'http://127.0.0.1/one' },
      { id: 'proxy-2', sessionId: 'session-2', proxyUrl: 'http://127.0.0.1/two' }
    ]

    const cleared = clearProxySessionForItem(items, 'proxy-1', 'session-1')

    expect(cleared[0]).toEqual({ id: 'proxy-1', sessionId: undefined, proxyUrl: undefined })
    expect(cleared[1]).toEqual(items[1])
    expect(clearProxySessionForItem(items, 'proxy-1', 'old-session')).toBe(items)
  })

  it('过期代理事件不会影响当前播放状态', () => {
    const items = [
      { id: 'proxy-1', sessionId: 'session-1' },
      { id: 'proxy-2', sessionId: 'session-2' }
    ]

    expect(isCurrentProxySessionEvent(items, 'proxy-1', 'session-1')).toBe(true)
    expect(isCurrentProxySessionEvent(items, 'proxy-1', 'session-2')).toBe(false)
    expect(isCurrentProxySessionEvent(items, 'proxy-1', 'old-session')).toBe(false)
    expect(isCurrentProxySessionEvent(items, null, 'session-1')).toBe(false)
  })
})
