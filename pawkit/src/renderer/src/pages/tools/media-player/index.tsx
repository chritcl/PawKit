import Hls from 'hls.js'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileVideo,
  Gauge,
  Link,
  Maximize2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX
} from 'lucide-react'
import {
  clampMediaVolume,
  createMediaTitle,
  detectStreamProtocol,
  formatMediaBytes,
  formatPlaybackTime,
  validateNetworkMediaUrl,
  type ResolvedStreamType,
  type StreamInputMode
} from '../../../utils/media-player'
import type { StreamProxyEvent, StreamProxyProtocol } from '../../../../../shared/types'

type MediaItemKind = 'file' | 'network' | 'proxy'
type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'
type LogTone = 'info' | 'success' | 'danger'

interface MediaItem {
  id: string
  kind: MediaItemKind
  title: string
  source: string
  objectUrl?: string
  size?: number
  mimeType?: string
  streamType?: ResolvedStreamType
  proxyUrl?: string
  sessionId?: string
  createdAt: number
}

interface PlayerLog {
  id: string
  time: string
  message: string
  tone: LogTone
}

interface VideoMeta {
  width: number
  height: number
}

interface HlsInfo {
  levels: number
  live: boolean
  targetDuration: number | null
}

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]
const fileExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.flac']

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isPlayableFile(file: File): boolean {
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return fileExtensions.some((extension) => name.endsWith(extension))
}

function createFileItem(file: File): MediaItem {
  const objectUrl = URL.createObjectURL(file)
  return {
    id: createId('file'),
    kind: 'file',
    title: file.name || '本地媒体',
    source: objectUrl,
    objectUrl,
    size: file.size,
    mimeType: file.type || '未知类型',
    createdAt: Date.now()
  }
}

function revokeMediaItem(item: MediaItem): void {
  if (item.objectUrl) {
    URL.revokeObjectURL(item.objectUrl)
  }
}

function stopProxyMediaItem(item: MediaItem): void {
  if (item.kind !== 'proxy' || !item.sessionId) return
  const api = window.electronAPI?.streamProxy
  if (!api) return
  api.stop(item.sessionId).catch(() => {})
}

function clearVideoSource(video: HTMLVideoElement): void {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

function isProxyStreamType(streamType?: ResolvedStreamType): streamType is StreamProxyProtocol {
  return streamType === 'ws' || streamType === 'wss' || streamType === 'rtsp'
}

function getPlaybackSource(item: MediaItem): string {
  return item.kind === 'proxy' ? item.proxyUrl ?? '' : item.source
}

function getStatusLabel(status: PlayerStatus): string {
  switch (status) {
    case 'loading':
      return '加载中'
    case 'ready':
      return '就绪'
    case 'playing':
      return '播放中'
    case 'paused':
      return '已暂停'
    case 'ended':
      return '播放结束'
    case 'error':
      return '播放失败'
    default:
      return '等待媒体'
  }
}

function getStreamLabel(item: MediaItem): string {
  if (item.kind === 'file') return item.mimeType ?? '本地文件'
  if (item.kind === 'proxy') {
    if (item.streamType === 'ws') return 'WS 代理'
    if (item.streamType === 'wss') return 'WSS 代理'
    return 'RTSP 代理'
  }
  return item.streamType === 'hls' ? 'HLS / m3u8' : 'HTTP 直链'
}

function getSourceSummary(item: MediaItem): string {
  if (item.kind === 'file') {
    return item.size === undefined ? '本地文件' : formatMediaBytes(item.size)
  }

  try {
    const url = new URL(item.source)
    return `${url.protocol}//${url.host}`
  } catch {
    return '网络媒体'
  }
}

function getMediaErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code
  if (code === MediaError.MEDIA_ERR_ABORTED) return '播放已被取消'
  if (code === MediaError.MEDIA_ERR_NETWORK) return '网络加载失败，可能是地址不可访问或被 CORS 限制'
  if (code === MediaError.MEDIA_ERR_DECODE) return '媒体解码失败，当前 Electron 可能不支持该编码'
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return '媒体源不受支持，可能是格式、编码或 CORS 限制'
  return '媒体加载失败，请检查地址、格式或网络状态'
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

export function MediaPlayerPage(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hlsRetryRef = useRef(0)
  const playlistRef = useRef<MediaItem[]>([])
  const activeIdRef = useRef<string | null>(null)
  const activeItemRef = useRef<MediaItem | null>(null)
  const startingProxyIdsRef = useRef<Set<string>>(new Set())

  const [playlist, setPlaylist] = useState<MediaItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [streamUrl, setStreamUrl] = useState('')
  const [streamMode, setStreamMode] = useState<StreamInputMode>('auto')
  const [isAddingStream, setIsAddingStream] = useState(false)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [message, setMessage] = useState('拖入媒体文件，或输入 HTTP/HLS/WS/RTSP 地址开始调试')
  const [logs, setLogs] = useState<PlayerLog[]>([])
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [volume, setVolume] = useState(0.86)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [loop, setLoop] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [hlsInfo, setHlsInfo] = useState<HlsInfo | null>(null)

  const activeItem = useMemo(
    () => playlist.find((item) => item.id === activeId) ?? null,
    [activeId, playlist]
  )

  const isLiveStream = activeItem?.streamType === 'hls' && hlsInfo?.live === true
  const bufferedPercent = !isLiveStream && duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0
  const progressPercent = !isLiveStream && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const statusLabel = getStatusLabel(status)

  const appendLog = useCallback((text: string, tone: LogTone = 'info'): void => {
    setLogs((current) => [
      {
        id: createId('log'),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        message: text,
        tone
      },
      ...current
    ].slice(0, 16))
  }, [])

  const destroyHls = useCallback((): void => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  const startProxyForItem = useCallback(async (item: MediaItem): Promise<void> => {
    if (item.kind !== 'proxy' || !isProxyStreamType(item.streamType)) return
    if (startingProxyIdsRef.current.has(item.id)) return

    const api = window.electronAPI?.streamProxy
    if (!api) {
      setStatus('error')
      setMessage('串流代理不可用，请确认 preload 已正确加载')
      appendLog('串流代理不可用', 'danger')
      return
    }

    startingProxyIdsRef.current.add(item.id)
    setStatus('loading')
    setMessage(`正在启动 ${item.streamType.toUpperCase()} 串流代理`)

    try {
      const response = await api.start({
        sourceUrl: item.source,
        protocol: item.streamType,
        title: item.title
      })

      if (!response.success || !response.sessionId || !response.localUrl) {
        setStatus('error')
        setMessage(response.message)
        appendLog(`串流代理启动失败：${response.message}`, 'danger')
        return
      }

      setPlaylist((current) => current.map((currentItem) => (
        currentItem.id === item.id
          ? { ...currentItem, sessionId: response.sessionId, proxyUrl: response.localUrl }
          : currentItem
      )))
      setMessage('串流代理已启动，正在连接本地播放地址')
      appendLog(`串流代理已启动：${item.streamType.toUpperCase()}`, 'success')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setStatus('error')
      setMessage(`串流代理启动失败：${errorMessage}`)
      appendLog(`串流代理启动失败：${errorMessage}`, 'danger')
    } finally {
      startingProxyIdsRef.current.delete(item.id)
    }
  }, [appendLog])

  useEffect(() => {
    playlistRef.current = playlist
  }, [playlist])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    return () => {
      destroyHls()
      playlistRef.current.forEach((item) => {
        stopProxyMediaItem(item)
        revokeMediaItem(item)
      })
    }
  }, [destroyHls])

  useEffect(() => {
    const previousItem = activeItemRef.current
    if (previousItem?.kind === 'proxy' && previousItem.id !== activeItem?.id && previousItem.sessionId) {
      stopProxyMediaItem(previousItem)
      setPlaylist((current) => current.map((item) => (
        item.id === previousItem.id
          ? { ...item, sessionId: undefined, proxyUrl: undefined }
          : item
      )))
    }
    activeItemRef.current = activeItem
  }, [activeItem])

  useEffect(() => {
    const api = window.electronAPI?.streamProxy
    if (!api) return

    return api.onEvent((event: StreamProxyEvent) => {
      const relatedItem = playlistRef.current.find((item) => item.sessionId === event.sessionId)
      appendLog(event.message, event.type === 'error' ? 'danger' : event.type === 'connected' ? 'success' : 'info')

      if (!relatedItem || relatedItem.id !== activeIdRef.current) return

      if (event.type === 'connected') {
        setStatus('ready')
        setMessage(event.message)
      } else if (event.type === 'reconnecting') {
        setStatus('loading')
        setMessage(event.message)
      } else if (event.type === 'error') {
        setStatus('error')
        setMessage(event.message)
      }
    })
  }, [appendLog])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
  }, [muted, volume])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const video = videoRef.current
    destroyHls()
    hlsRetryRef.current = 0
    queueMicrotask(() => {
      setCurrentTime(0)
      setBufferedEnd(0)
      setDuration(0)
      setVideoMeta(null)
      setHlsInfo(null)
    })

    if (!video || !activeItem) {
      queueMicrotask(() => setStatus('idle'))
      return
    }

    clearVideoSource(video)
    queueMicrotask(() => {
      setStatus('loading')
      setMessage(`正在加载：${activeItem.title}`)
    })
    queueMicrotask(() => appendLog(`准备加载 ${getStreamLabel(activeItem)}`, 'info'))

    if (activeItem.kind === 'proxy' && !activeItem.proxyUrl) {
      queueMicrotask(() => {
        void startProxyForItem(activeItem)
      })
      return () => destroyHls()
    }

    const playbackSource = getPlaybackSource(activeItem)
    if (!playbackSource) {
      queueMicrotask(() => {
        setStatus('error')
        setMessage('串流代理地址为空，请重试该媒体')
        appendLog('串流代理地址为空', 'danger')
      })
      return () => destroyHls()
    }

    if (activeItem.kind === 'network' && activeItem.streamType === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 90
        })
        hlsRef.current = hls
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(playbackSource)
          appendLog('HLS 媒体已挂载，开始读取清单', 'info')
        })
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          hlsRetryRef.current = 0
          setHlsInfo((current) => ({
            levels: data.levels.length,
            live: current?.live ?? false,
            targetDuration: current?.targetDuration ?? null
          }))
          setStatus('ready')
          setMessage(`HLS 清单已解析，${data.levels.length} 个清晰度`)
          appendLog(`HLS 清单已解析：${data.levels.length} 个清晰度`, 'success')
        })
        hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
          setHlsInfo((current) => ({
            levels: current?.levels ?? hls.levels.length,
            live: Boolean(data.details.live),
            targetDuration: data.details.targetduration ?? null
          }))
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          appendLog(`HLS 错误：${data.details}`, data.fatal ? 'danger' : 'info')
          if (data.fatal) {
            if (hlsRetryRef.current < 3 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hlsRetryRef.current += 1
              setStatus('loading')
              setMessage(`HLS 网络异常，正在第 ${hlsRetryRef.current} 次重试`)
              appendLog(`HLS 网络异常，正在第 ${hlsRetryRef.current} 次重试`, 'info')
              hls.startLoad()
              return
            }

            if (hlsRetryRef.current < 3 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hlsRetryRef.current += 1
              setStatus('loading')
              setMessage(`HLS 解码异常，正在第 ${hlsRetryRef.current} 次恢复`)
              appendLog(`HLS 解码异常，正在第 ${hlsRetryRef.current} 次恢复`, 'info')
              hls.recoverMediaError()
              return
            }

            setStatus('error')
            setMessage('HLS 播放失败，可能是清单不可访问、CORS 限制或编码不受支持')
          }
        })
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playbackSource
        video.load()
        queueMicrotask(() => appendLog('使用原生 HLS 能力播放', 'info'))
      } else {
        queueMicrotask(() => {
          setStatus('error')
          setMessage('当前运行环境不支持 HLS 播放')
          appendLog('当前运行环境不支持 HLS 播放', 'danger')
        })
      }
      return () => destroyHls()
    }

    video.src = playbackSource
    video.load()
    queueMicrotask(() => appendLog(activeItem.kind === 'file' ? '本地媒体已载入' : `${getStreamLabel(activeItem)}已载入`, 'info'))
    return () => destroyHls()
  }, [activeItem, appendLog, destroyHls, startProxyForItem])

  const addFileItems = useCallback((files: FileList | File[]): void => {
    const accepted = Array.from(files).filter(isPlayableFile)
    if (accepted.length === 0) {
      setMessage('没有找到可播放的音视频文件')
      appendLog('导入文件失败：未识别到音视频文件', 'danger')
      return
    }

    const items = accepted.map(createFileItem)
    setPlaylist((current) => [...current, ...items])
    setActiveId(items[0].id)
    setMessage(`已加入 ${items.length} 个本地媒体`)
    appendLog(`已加入 ${items.length} 个本地媒体`, 'success')
  }, [appendLog])

  const addNetworkStream = useCallback(async (): Promise<void> => {
    if (isAddingStream) return

    const result = validateNetworkMediaUrl(streamUrl)
    if (!result.valid) {
      setMessage(result.message)
      appendLog(`网络地址无效：${result.message}`, 'danger')
      return
    }

    let detected: ReturnType<typeof detectStreamProtocol>
    try {
      detected = detectStreamProtocol(result.url, streamMode)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络媒体地址无法识别'
      setMessage(errorMessage)
      appendLog(`网络地址无效：${errorMessage}`, 'danger')
      return
    }

    const title = createMediaTitle(result.url)
    const baseItem: MediaItem = {
      id: createId(detected.needsProxy ? 'proxy' : 'stream'),
      kind: detected.needsProxy ? 'proxy' : 'network',
      title,
      source: result.url,
      streamType: detected.streamType,
      createdAt: Date.now()
    }

    if (!detected.needsProxy) {
      setPlaylist((current) => [baseItem, ...current])
      setActiveId(baseItem.id)
      setMessage(`${detected.streamType === 'hls' ? 'HLS' : 'HTTP 直链'} 已加入当前会话`)
      appendLog(`已加入${detected.streamType === 'hls' ? ' HLS' : ' HTTP 直链'}网络媒体`, 'success')
      return
    }

    if (!isProxyStreamType(detected.streamType)) {
      setMessage('当前串流协议需要代理，但协议类型无法识别')
      appendLog('串流代理协议无法识别', 'danger')
      return
    }

    const api = window.electronAPI?.streamProxy
    if (!api) {
      setMessage('串流代理不可用，请确认 preload 已正确加载')
      appendLog('串流代理不可用', 'danger')
      return
    }

    setIsAddingStream(true)
    setStatus('loading')
    setMessage(`正在启动 ${detected.streamType.toUpperCase()} 串流代理`)

    try {
      const response = await api.start({
        sourceUrl: result.url,
        protocol: detected.streamType,
        title
      })

      if (!response.success || !response.sessionId || !response.localUrl) {
        setStatus('error')
        setMessage(response.message)
        appendLog(`串流代理启动失败：${response.message}`, 'danger')
        return
      }

      const proxyItem: MediaItem = {
        ...baseItem,
        kind: 'proxy',
        sessionId: response.sessionId,
        proxyUrl: response.localUrl
      }

      setPlaylist((current) => [proxyItem, ...current])
      setActiveId(proxyItem.id)
      setMessage(`${detected.streamType.toUpperCase()} 串流代理已加入当前会话`)
      appendLog(`已加入 ${detected.streamType.toUpperCase()} 代理串流`, 'success')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setStatus('error')
      setMessage(`串流代理启动失败：${errorMessage}`)
      appendLog(`串流代理启动失败：${errorMessage}`, 'danger')
    } finally {
      setIsAddingStream(false)
    }
  }, [appendLog, isAddingStream, streamMode, streamUrl])

  const selectPrevious = useCallback((): void => {
    if (!activeId || playlist.length === 0) return
    const index = playlist.findIndex((item) => item.id === activeId)
    const nextIndex = index <= 0 ? playlist.length - 1 : index - 1
    setActiveId(playlist[nextIndex]?.id ?? null)
  }, [activeId, playlist])

  const selectNext = useCallback((): void => {
    if (!activeId || playlist.length === 0) return
    const index = playlist.findIndex((item) => item.id === activeId)
    const nextIndex = index < 0 || index >= playlist.length - 1 ? 0 : index + 1
    setActiveId(playlist[nextIndex]?.id ?? null)
  }, [activeId, playlist])

  const togglePlay = useCallback((): void => {
    const video = videoRef.current
    if (!video || !activeItem) return

    if (video.paused) {
      video.play().catch(() => {
        setStatus('error')
        setMessage('播放启动失败，请检查媒体源或用户手势限制')
        appendLog('播放启动失败', 'danger')
      })
      return
    }

    video.pause()
  }, [activeItem, appendLog])

  const stopPlayback = useCallback((): void => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
    setCurrentTime(0)
    setStatus(activeItem ? 'paused' : 'idle')
  }, [activeItem])

  const retryActiveProxy = useCallback(async (): Promise<void> => {
    if (!activeItem || activeItem.kind !== 'proxy') return

    if (!activeItem.sessionId || !activeItem.proxyUrl) {
      await startProxyForItem(activeItem)
      return
    }

    const api = window.electronAPI?.streamProxy
    if (!api) {
      setStatus('error')
      setMessage('串流代理不可用，请确认 preload 已正确加载')
      appendLog('串流代理不可用', 'danger')
      return
    }

    try {
      const response = await api.retry(activeItem.sessionId)
      if (!response.success) {
        setStatus('error')
        setMessage(response.message)
        appendLog(`串流代理重试失败：${response.message}`, 'danger')
        return
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setStatus('error')
      setMessage(`串流代理重试失败：${errorMessage}`)
      appendLog(`串流代理重试失败：${errorMessage}`, 'danger')
      return
    }

    const video = videoRef.current
    if (video) {
      clearVideoSource(video)
      video.src = activeItem.proxyUrl
      video.load()
    }
    setStatus('loading')
    setMessage('正在重试串流代理')
    appendLog('正在重试串流代理', 'info')
  }, [activeItem, appendLog, startProxyForItem])

  const seekBy = useCallback((seconds: number): void => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
  }, [])

  const changeVolume = useCallback((nextVolume: number): void => {
    const safeVolume = clampMediaVolume(nextVolume)
    setVolume(safeVolume)
    if (safeVolume > 0 && muted) setMuted(false)
  }, [muted])

  const toggleFullscreen = useCallback((): void => {
    const stage = stageRef.current
    if (!stage) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      return
    }
    stage.requestFullscreen().catch(() => {
      setMessage('进入全屏失败')
      appendLog('进入全屏失败', 'danger')
    })
  }, [appendLog])

  const removeMediaItem = useCallback((id: string): void => {
    const index = playlist.findIndex((item) => item.id === id)
    const target = playlist[index]
    if (!target) return

    if (activeId === id) {
      const video = videoRef.current
      if (video) clearVideoSource(video)
      destroyHls()
    }

    stopProxyMediaItem(target)
    revokeMediaItem(target)
    const nextItems = playlist.filter((item) => item.id !== id)
    setPlaylist(nextItems)
    if (activeId === id) {
      setActiveId(nextItems[index]?.id ?? nextItems[index - 1]?.id ?? null)
    }
    setMessage('已从当前会话移除')
  }, [activeId, destroyHls, playlist])

  const clearPlaylist = useCallback((): void => {
    const video = videoRef.current
    if (video) clearVideoSource(video)
    destroyHls()
    playlist.forEach((item) => {
      stopProxyMediaItem(item)
      revokeMediaItem(item)
    })
    setPlaylist([])
    setActiveId(null)
    setLogs([])
    setMessage('当前会话已清空')
  }, [destroyHls, playlist])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (event.currentTarget.files) {
      addFileItems(event.currentTarget.files)
    }
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) {
      addFileItems(event.dataTransfer.files)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isEditableTarget(event.target)) return
    if (event.code === 'Space') {
      event.preventDefault()
      togglePlay()
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekBy(5)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekBy(-5)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      changeVolume(volume + 0.05)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      changeVolume(volume - 0.05)
      return
    }
    if (event.key.toLowerCase() === 'm') {
      setMuted((current) => !current)
      return
    }
    if (event.key.toLowerCase() === 'f') {
      toggleFullscreen()
    }
  }

  const handleLoadedMetadata = (): void => {
    const video = videoRef.current
    if (!video) return
    setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    setVideoMeta(video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : null)
    setStatus('ready')
    setMessage('媒体已就绪')
    appendLog('媒体元数据已读取', 'success')
  }

  const handleTimeUpdate = (): void => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
  }

  const handleProgress = (): void => {
    const video = videoRef.current
    if (!video || video.buffered.length === 0) {
      setBufferedEnd(0)
      return
    }
    const nextBufferedEnd = video.buffered.end(video.buffered.length - 1)
    setBufferedEnd(Number.isFinite(nextBufferedEnd) ? nextBufferedEnd : 0)
  }

  const handleMediaError = (): void => {
    const video = videoRef.current
    if (!video) return
    const errorMessage = getMediaErrorMessage(video)
    setStatus('error')
    setMessage(errorMessage)
    appendLog(errorMessage, 'danger')
  }

  return (
    <div className="tool-page media-player-page" onKeyDown={handleKeyDown} tabIndex={-1}>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="video/*,audio/*"
        multiple
        onChange={handleFileChange}
      />

      <div className="toolbar-surface media-player-toolbar">
        <div className="media-player-toolbar-main">
          <button className="toolbar-button-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            打开文件
          </button>
          <div className="media-stream-input-wrap">
            <Link className="h-4 w-4" />
            <input
              className="media-stream-input"
              value={streamUrl}
              onChange={(event) => setStreamUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addNetworkStream()
              }}
              placeholder="输入 HTTP/HLS/WS/WSS/RTSP 媒体地址"
            />
          </div>
          <div className="segmented-control segmented-scroll media-stream-mode">
            {[
              { value: 'auto', label: '自动' },
              { value: 'hls', label: 'HLS' },
              { value: 'direct', label: '直链' },
              { value: 'ws', label: 'WS' },
              { value: 'wss', label: 'WSS' },
              { value: 'rtsp', label: 'RTSP' }
            ].map((item) => (
              <button
                key={item.value}
                className={`segmented-item ${streamMode === item.value ? 'segmented-item-active' : ''}`}
                onClick={() => setStreamMode(item.value as StreamInputMode)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button className="toolbar-button" disabled={isAddingStream} onClick={() => void addNetworkStream()}>
            <Plus className="h-4 w-4" />
            {isAddingStream ? '加入中' : '加入'}
          </button>
        </div>

        <div className="panel-actions">
          <button className={`toolbar-button ${loop ? 'media-toggle-active' : ''}`} onClick={() => setLoop((current) => !current)}>
            <RotateCcw className="h-4 w-4" />
            循环
          </button>
          <button className="toolbar-button" disabled={playlist.length === 0} onClick={clearPlaylist}>
            <Trash2 className="h-4 w-4" />
            清空
          </button>
        </div>
      </div>

      <div className="tool-workspace media-player-workbench">
        <section
          ref={stageRef}
          className={`editor-surface tool-panel media-stage-panel ${dragging ? 'media-stage-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="panel-header media-stage-header">
            <div className="media-stage-title">
              <span>{activeItem?.title ?? '等待媒体'}</span>
              <span className="chip">{statusLabel}</span>
              {activeItem && <span className="chip">{getStreamLabel(activeItem)}</span>}
              {isLiveStream && <span className="chip">直播</span>}
            </div>
            <div className="media-stage-meta">
              <span>{formatPlaybackTime(currentTime)} / {isLiveStream ? '直播' : duration > 0 ? formatPlaybackTime(duration) : '--:--'}</span>
              <span>{Math.round(bufferedPercent)}% 缓冲</span>
            </div>
          </div>

          <div className="panel-body media-stage-body">
            <div className="media-video-frame">
              <video
                ref={videoRef}
                className="media-video"
                playsInline
                loop={loop}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleProgress}
                onPlay={() => setStatus('playing')}
                onPause={() => setStatus((current) => current === 'ended' ? 'ended' : 'paused')}
                onEnded={() => {
                  setStatus('ended')
                  appendLog('播放结束', 'info')
                }}
                onError={handleMediaError}
              />

              {!activeItem && (
                <div className="media-empty-state">
                  <FileVideo className="h-12 w-12" />
                  <strong>拖入本地媒体，或加入 HTTP/HLS/WS/RTSP 地址</strong>
                  <span>WS/WSS/RTSP 会通过本地代理转成浏览器可播放的媒体流。</span>
                </div>
              )}

              {status === 'error' && activeItem && (
                <div className="media-error-overlay">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{message}</span>
                  {activeItem.kind === 'proxy' && (
                    <button type="button" className="toolbar-button" onClick={() => void retryActiveProxy()}>
                      重试
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="media-control-deck">
              <div className="media-progress-row">
                <span>{formatPlaybackTime(currentTime)}</span>
                <div className="media-progress-wrap">
                  <div className="media-buffer-bar" style={{ width: `${bufferedPercent}%` }} />
                  <div className="media-play-bar" style={{ width: `${progressPercent}%` }} />
                  <input
                    type="range"
                    min={0}
                    max={!isLiveStream && duration > 0 ? duration : 0}
                    step={0.1}
                    value={!isLiveStream && duration > 0 ? currentTime : 0}
                    disabled={!activeItem || isLiveStream || duration <= 0}
                    onChange={(event) => {
                      const video = videoRef.current
                      if (!video || isLiveStream) return
                      video.currentTime = Number(event.target.value)
                      setCurrentTime(video.currentTime)
                    }}
                  />
                </div>
                <span>{isLiveStream ? '直播' : duration > 0 ? formatPlaybackTime(duration) : '--:--'}</span>
              </div>

              <div className="media-controls">
                <div className="media-control-group">
                  <button className="icon-button" disabled={playlist.length < 2} onClick={selectPrevious} title="上一项">
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button className="icon-button media-play-button" disabled={!activeItem || status === 'loading'} onClick={togglePlay} title="播放或暂停">
                    {status === 'playing' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button className="icon-button" disabled={!activeItem} onClick={stopPlayback} title="停止">
                    <Square className="h-4 w-4" />
                  </button>
                  <button className="icon-button" disabled={playlist.length < 2} onClick={selectNext} title="下一项">
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>

                <div className="media-control-group media-volume-group">
                  <button className="icon-button" onClick={() => setMuted((current) => !current)} title={muted ? '取消静音' : '静音'}>
                    {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(event) => changeVolume(Number(event.target.value))}
                    title="音量"
                  />
                  <span>{Math.round((muted ? 0 : volume) * 100)}%</span>
                </div>

                <div className="media-control-group">
                  <select
                    className="field-select media-rate-select"
                    value={playbackRate}
                    onChange={(event) => setPlaybackRate(Number(event.target.value))}
                    title="播放速度"
                  >
                    {playbackRates.map((rate) => (
                      <option key={rate} value={rate}>{rate}x</option>
                    ))}
                  </select>
                  <button className="icon-button" disabled={!activeItem} onClick={toggleFullscreen} title="全屏">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="media-side-panel">
          <section className="editor-surface tool-panel media-session-panel">
            <div className="panel-header">
              <div className="media-panel-title">
                <Radio className="h-4 w-4" />
                <span>当前会话</span>
              </div>
              <span className="text-xs text-[color:var(--text-muted)]">{playlist.length} 项</span>
            </div>
            <div className="panel-body media-playlist-scroll">
              {playlist.length === 0 ? (
                <div className="media-side-empty">暂无媒体，拖入文件或加入网络流。</div>
              ) : (
                playlist.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`media-playlist-row ${activeId === item.id ? 'media-playlist-row-active' : ''}`}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveId(item.id)
                      }
                    }}
                  >
                    <span className="media-playlist-icon">
                      {item.kind === 'file' ? <FileVideo className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                    </span>
                    <span className="media-playlist-main">
                      <strong>{item.title}</strong>
                      <span>{getStreamLabel(item)} · {getSourceSummary(item)}</span>
                    </span>
                    <button
                      type="button"
                      className="media-playlist-remove"
                      title="移除"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeMediaItem(item.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          removeMediaItem(item.id)
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="editor-surface tool-panel media-debug-panel">
            <div className="panel-header">
              <div className="media-panel-title">
                <Activity className="h-4 w-4" />
                <span>调试信息</span>
              </div>
            </div>
            <div className="panel-body media-debug-body">
              <div className="media-debug-grid">
                <div>
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>状态</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div>
                  <Gauge className="h-3.5 w-3.5" />
                  <span>速度</span>
                  <strong>{playbackRate}x</strong>
                </div>
                <div>
                  <FileVideo className="h-3.5 w-3.5" />
                  <span>分辨率</span>
                  <strong>{videoMeta ? `${videoMeta.width}×${videoMeta.height}` : '未读取'}</strong>
                </div>
                <div>
                  <Radio className="h-3.5 w-3.5" />
                  <span>HLS</span>
                  <strong>
                    {hlsInfo ? `${hlsInfo.levels} 档${hlsInfo.live ? ' · 直播' : ''}` : activeItem?.streamType === 'hls' ? '等待清单' : '未使用'}
                  </strong>
                </div>
              </div>

              {hlsInfo?.targetDuration && (
                <div className="media-debug-note">
                  HLS 分片目标时长：{hlsInfo.targetDuration}s
                </div>
              )}

              <div className="media-log-list">
                {logs.length === 0 ? (
                  <div className="media-side-empty">暂无调试事件。</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className={`media-log-row media-log-${log.tone}`}>
                      <span>{log.time}</span>
                      <strong>{log.message}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="status-strip media-status-strip">
        <span className={status === 'error' ? 'tone-danger' : status === 'playing' || status === 'ready' ? 'tone-success' : 'text-[color:var(--text-muted)]'}>
          {message}
        </span>
        <span>播放列表 {playlist.length} 项</span>
        <span>缓冲 {isLiveStream ? '直播' : `${Math.round(bufferedPercent)}%`}</span>
        <span>快捷键：空格播放 / F 全屏 / M 静音</span>
      </div>
    </div>
  )
}
