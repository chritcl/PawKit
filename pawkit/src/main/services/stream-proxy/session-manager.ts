import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import type { BrowserWindow } from 'electron'
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
  runner: FfmpegRunner | null
  retryTimer: NodeJS.Timeout | null
}

const maxRetryCount = 3
const retryDelayMs = 1200

export class StreamProxySessionManager {
  private readonly sessions = new Map<string, StreamProxySession>()
  private readonly server = new StreamProxyHttpServer((sessionId, request, response) => {
    this.handleStreamRequest(sessionId, request, response)
  })
  private mainWindow: BrowserWindow | null = null

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
      retryTimer: null
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

    this.clearRetryTimer(session)
    session.stopped = false
    session.retryCount = 0

    if (session.runner) {
      session.runner.stop()
      session.runner = null
    }

    this.emitEvent(session, 'reconnecting', '正在重新启动串流代理')
    if (session.response && !session.response.destroyed) {
      this.startRunner(session, session.response)
    }

    return { success: true, message: '已请求重新连接串流代理' }
  }

  stopAllSessions(): void {
    for (const session of this.sessions.values()) {
      this.destroySession(session, '应用退出，串流代理已清理')
    }
    void this.server.close().catch((error) => {
      logger.warn('关闭本地串流服务失败:', error)
    })
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

    this.clearRetryTimer(session)
    session.stopped = false
    session.retryCount = 0

    if (session.runner) {
      session.runner.stop()
      session.runner = null
    }

    session.response = response
    response.writeHead(200, buildStreamHeaders())
    response.once('close', () => {
      if (session.response === response) {
        session.response = null
      }
      if (session.runner) {
        session.runner.stop()
        session.runner = null
      }
      this.clearRetryTimer(session)
    })

    this.startRunner(session, response)
  }

  private startRunner(session: StreamProxySession, response: ServerResponse): void {
    const runner = new FfmpegRunner(session.sourceUrl, session.protocol, response, {
      onStart: () => {
        this.emitEvent(session, 'connected', `串流代理已连接：${session.protocol.toUpperCase()}`)
      },
      onError: (message) => {
        if (session.runner === runner) {
          session.runner = null
        }
        this.handleRunnerFailure(session, response, message)
      },
      onExit: (_code, _signal, stopped, message) => {
        if (session.runner === runner) {
          session.runner = null
        }
        if (stopped || session.stopped || response.destroyed) return
        this.handleRunnerFailure(session, response, message)
      }
    })

    session.runner = runner
    runner.start()
  }

  private handleRunnerFailure(session: StreamProxySession, response: ServerResponse, message: string): void {
    if (session.stopped || response.destroyed) return

    if (session.retryCount < maxRetryCount) {
      session.retryCount += 1
      this.emitEvent(session, 'reconnecting', `串流中断，正在第 ${session.retryCount} 次重连`, session.retryCount)
      session.retryTimer = setTimeout(() => {
        session.retryTimer = null
        if (session.stopped || response.destroyed || !this.sessions.has(session.id)) return
        this.startRunner(session, response)
      }, retryDelayMs)
      return
    }

    this.emitEvent(session, 'error', `串流代理失败：${message}`, session.retryCount)
    response.end()
  }

  private destroySession(session: StreamProxySession, message: string): void {
    session.stopped = true
    this.clearRetryTimer(session)

    if (session.runner) {
      session.runner.stop()
      session.runner = null
    }

    if (session.response && !session.response.destroyed) {
      session.response.end()
    }

    session.response = null
    this.sessions.delete(session.id)
    this.emitEvent(session, 'stopped', message)
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
