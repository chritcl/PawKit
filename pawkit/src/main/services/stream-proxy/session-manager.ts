import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import type { BrowserWindow } from 'electron'
import type { Writable } from 'stream'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type {
  StreamProxyActionResult,
  StreamProxyEvent,
  StreamProxyProtocol,
  StreamProxyStartRequest,
  StreamProxyStartResponse
} from '../../../shared/types'
import { logger } from '../../logger'
import { FfmpegRunner } from './ffmpeg-runner'
import { buildStreamHeaders, StreamProxyHttpServer } from './http-server'

export interface StreamProxyRunnerCallbacks {
  onStart: () => void
  onError: (message: string) => void
  onExit: (code: number | null, signal: NodeJS.Signals | null, stopped: boolean, message: string) => void
}

export interface StreamProxyRunner {
  start: () => void
  stop: () => void
}

export type StreamProxyRunnerFactory = (
  sourceUrl: string,
  protocol: StreamProxyProtocol,
  output: Writable,
  callbacks: StreamProxyRunnerCallbacks
) => StreamProxyRunner

export interface StreamProxySessionManagerOptions {
  createRunner?: StreamProxyRunnerFactory
  maxRetryCount?: number
  retryDelayMs?: number
}

interface StreamProxySession {
  id: string
  sourceUrl: string
  protocol: StreamProxyProtocol
  localUrl: string
  title?: string
  retryCount: number
  stopped: boolean
  createdAt: string
  response: ServerResponse | null
  runner: StreamProxyRunner | null
  retryTimer: NodeJS.Timeout | null
  streamToken: number
}

const defaultMaxRetryCount = 3
const defaultRetryDelayMs = 1200

function createDefaultRunner(
  sourceUrl: string,
  protocol: StreamProxyProtocol,
  output: Writable,
  callbacks: StreamProxyRunnerCallbacks
): StreamProxyRunner {
  return new FfmpegRunner(sourceUrl, protocol, output, callbacks)
}

export class StreamProxySessionManager {
  private readonly sessions = new Map<string, StreamProxySession>()
  private readonly server = new StreamProxyHttpServer((sessionId, request, response) => {
    this.handleStreamRequest(sessionId, request, response)
  })
  private readonly createRunner: StreamProxyRunnerFactory
  private readonly maxRetryCount: number
  private readonly retryDelayMs: number
  private mainWindow: BrowserWindow | null = null

  constructor(options: StreamProxySessionManagerOptions = {}) {
    this.createRunner = options.createRunner ?? createDefaultRunner
    this.maxRetryCount = options.maxRetryCount ?? defaultMaxRetryCount
    this.retryDelayMs = options.retryDelayMs ?? defaultRetryDelayMs
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  async startSession(request: StreamProxyStartRequest): Promise<StreamProxyStartResponse> {
    const validation = validateStartRequest(request)
    if (!validation.success) {
      return { success: false, status: 'error', message: validation.message }
    }

    await this.server.ensureStarted()

    const id = `proxy-${randomUUID()}`
    const localUrl = this.server.getStreamUrl(id)
    const createdAt = new Date().toISOString()

    this.sessions.set(id, {
      id,
      sourceUrl: request.sourceUrl,
      protocol: request.protocol,
      localUrl,
      title: request.title,
      retryCount: 0,
      stopped: false,
      createdAt,
      response: null,
      runner: null,
      retryTimer: null,
      streamToken: 0
    })

    return {
      success: true,
      status: 'started',
      sessionId: id,
      localUrl,
      message: '串流代理会话已创建'
    }
  }

  stopSession(sessionId: string): StreamProxyActionResult {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { success: true, message: '串流代理会话已结束' }
    }

    this.destroySession(session, '串流代理会话已停止')
    return { success: true, message: '串流代理会话已停止' }
  }

  retrySession(sessionId: string): StreamProxyActionResult {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { success: false, message: '串流代理会话不存在，请重新加入该流' }
    }

    this.closeActiveStream(session)
    session.stopped = false
    session.retryCount = 0

    this.emitEvent(session, 'reconnecting', '正在重新启动串流代理，请求播放器重新连接')

    return { success: true, message: '已请求重新连接串流代理' }
  }

  async stopAllSessions(): Promise<void> {
    for (const session of Array.from(this.sessions.values())) {
      this.destroySession(session, '应用退出，串流代理已清理')
    }
    try {
      await this.server.close()
    } catch (error) {
      logger.warn('关闭本地串流服务失败:', error)
    }
  }

  private handleStreamRequest(
    sessionId: string,
    _request: IncomingMessage,
    response: ServerResponse
  ): void {
    void _request
    const session = this.sessions.get(sessionId)
    if (!session) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('串流代理会话不存在')
      return
    }

    this.closeActiveStream(session)
    session.stopped = false
    session.retryCount = 0

    const streamToken = session.streamToken
    session.response = response
    response.writeHead(200, buildStreamHeaders())
    response.once('close', () => {
      this.handleResponseClosed(session, response, streamToken)
    })

    this.startRunner(session, response, streamToken)
  }

  private startRunner(session: StreamProxySession, response: ServerResponse, streamToken: number): void {
    const runner = this.createRunner(session.sourceUrl, session.protocol, response, {
      onStart: () => {
        if (!this.isCurrentStream(session, response, runner, streamToken)) return
        this.emitEvent(session, 'connected', `串流代理已连接：${session.protocol.toUpperCase()}`)
      },
      onError: (message) => {
        if (!this.isCurrentStream(session, response, runner, streamToken)) return
        runner.stop()
        session.runner = null
        this.handleRunnerFailure(session, response, streamToken, message)
      },
      onExit: (_code, _signal, stopped, message) => {
        if (!this.isCurrentStream(session, response, runner, streamToken)) return
        session.runner = null
        if (stopped || session.stopped || response.destroyed) return
        this.handleRunnerFailure(session, response, streamToken, message)
      }
    })

    session.runner = runner
    runner.start()
  }

  private handleRunnerFailure(
    session: StreamProxySession,
    response: ServerResponse,
    streamToken: number,
    message: string
  ): void {
    if (session.stopped || response.destroyed || !this.isCurrentStream(session, response, null, streamToken)) return

    if (session.retryCount < this.maxRetryCount) {
      session.retryCount += 1
      this.emitEvent(session, 'reconnecting', `串流中断，正在第 ${session.retryCount} 次重连`, session.retryCount)
      session.retryTimer = setTimeout(() => {
        session.retryTimer = null
        if (session.stopped || response.destroyed || !this.isCurrentStream(session, response, null, streamToken)) return
        this.startRunner(session, response, streamToken)
      }, this.retryDelayMs)
      return
    }

    this.emitEvent(session, 'error', `串流代理失败：${message}`, session.retryCount)
    this.closeActiveStream(session)
  }

  private destroySession(session: StreamProxySession, message: string): void {
    if (!this.sessions.has(session.id)) return
    session.stopped = true
    this.closeActiveStream(session)
    this.sessions.delete(session.id)
    this.emitEvent(session, 'stopped', message)
  }

  private closeActiveStream(session: StreamProxySession): void {
    session.streamToken += 1
    this.clearRetryTimer(session)

    if (session.runner) {
      session.runner.stop()
      session.runner = null
    }

    if (session.response && !session.response.destroyed) {
      session.response.end()
    }

    session.response = null
  }

  private handleResponseClosed(
    session: StreamProxySession,
    response: ServerResponse,
    streamToken: number
  ): void {
    if (!this.isCurrentStream(session, response, null, streamToken)) return
    this.closeActiveStream(session)
  }

  private isCurrentStream(
    session: StreamProxySession,
    response: ServerResponse,
    runner: StreamProxyRunner | null,
    streamToken: number
  ): boolean {
    if (this.sessions.get(session.id) !== session) return false
    if (session.streamToken !== streamToken) return false
    if (session.response !== response) return false
    if (runner && session.runner !== runner) return false
    return true
  }

  private clearRetryTimer(session: StreamProxySession): void {
    if (!session.retryTimer) return
    clearTimeout(session.retryTimer)
    session.retryTimer = null
  }

  private emitEvent(
    session: StreamProxySession,
    type: StreamProxyEvent['type'],
    message: string,
    retryCount = session.retryCount
  ): void {
    const event: StreamProxyEvent = {
      sessionId: session.id,
      type,
      message,
      sourceUrl: session.sourceUrl,
      localUrl: session.localUrl,
      retryCount,
      createdAt: new Date().toISOString()
    }

    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.STREAM_PROXY_EVENT, event)
  }
}

function validateStartRequest(request: StreamProxyStartRequest): StreamProxyActionResult {
  if (!request || !request.sourceUrl || !request.protocol) {
    return { success: false, message: '串流代理请求不完整' }
  }

  if (!isStreamProxyProtocol(request.protocol)) {
    return { success: false, message: '串流代理协议不受支持' }
  }

  try {
    const url = new URL(request.sourceUrl)
    if (url.protocol !== `${request.protocol}:`) {
      return { success: false, message: '串流地址协议与代理协议不一致' }
    }
  } catch {
    return { success: false, message: '串流地址格式无效' }
  }

  return { success: true, message: '串流代理请求有效' }
}

function isStreamProxyProtocol(value: string): value is StreamProxyProtocol {
  return value === 'ws' || value === 'wss' || value === 'rtsp'
}
