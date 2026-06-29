import { describe, expect, it } from 'vitest'
import {
  clampMediaVolume,
  createMediaTitle,
  detectStreamProtocol,
  formatMediaBytes,
  formatPlaybackTime,
  inferStreamType,
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
})
