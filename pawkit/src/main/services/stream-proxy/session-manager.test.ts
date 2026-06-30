import http from 'http'
import type { BrowserWindow } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Writable } from 'stream'
import type { StreamProxyEvent, StreamProxyProtocol } from '../../../shared/types'
import {
  StreamProxySessionManager,
  type StreamProxyRunner,
  type StreamProxyRunnerCallbacks
} from './session-manager'

vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

class FakeRunner implements StreamProxyRunner {
  stopped = false
  startCount = 0

  constructor(
    readonly sourceUrl: string,
    readonly protocol: StreamProxyProtocol,
    private readonly output: Writable,
    private readonly callbacks: StreamProxyRunnerCallbacks
  ) {}

  start(): void {
    this.startCount += 1
    this.callbacks.onStart()
    this.output.write(Buffer.from('frame'))
  }

  stop(): void {
    this.stopped = true
  }

  fail(message = '模拟串流中断'): void {
    this.callbacks.onError(message)
  }
}

interface OpenStreamClient {
  close: () => void
  waitClosed: () => Promise<void>
  isClosed: () => boolean
}

const managers: StreamProxySessionManager[] = []
const clients: OpenStreamClient[] = []
let runners: FakeRunner[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.close()
  }
  for (const manager of managers.splice(0)) {
    await manager.stopAllSessions()
  }
  runners = []
})

function createManager(events: StreamProxyEvent[] = []): StreamProxySessionManager {
  const manager = new StreamProxySessionManager({
    retryDelayMs: 20,
    createRunner: (sourceUrl, protocol, output, callbacks) => {
      const runner = new FakeRunner(sourceUrl, protocol, output, callbacks)
      runners.push(runner)
      return runner
    }
  })
  manager.setMainWindow({
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, event: StreamProxyEvent) => {
        events.push(event)
      }
    }
  } as unknown as BrowserWindow)
  managers.push(manager)
  return manager
}

async function openStream(url: string): Promise<OpenStreamClient> {
  let closed = false
  let resolveClosed: () => void = () => {}
  const closedPromise = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const request = http.get(url)
  const client = await new Promise<OpenStreamClient>((resolve, reject) => {
    request.once('response', (response) => {
      response.resume()
      const markClosed = (): void => {
        if (closed) return
        closed = true
        resolveClosed()
      }
      response.once('end', markClosed)
      response.once('close', markClosed)
      resolve({
        close: () => request.destroy(),
        waitClosed: () => closedPromise,
        isClosed: () => closed
      })
    })
    request.once('error', reject)
  })
  clients.push(client)
  return client
}

async function waitForAssertion(assertion: () => void, timeoutMs = 300): Promise<void> {
  const start = Date.now()
  let lastError: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  if (lastError) throw lastError
}

async function expectHttpGetRejected(url: string): Promise<void> {
  await expect(new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(response.statusCode)
    })
    request.once('error', reject)
    request.setTimeout(100, () => {
      request.destroy(new Error('请求超时'))
    })
  })).rejects.toThrow()
}

describe('串流代理会话管理器', () => {
  it('创建会话后等待浏览器请求再启动转码进程', async () => {
    const manager = createManager()
    const response = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/live',
      protocol: 'rtsp',
      title: '测试摄像头'
    })

    expect(response.success).toBe(true)
    expect(response.localUrl).toBeTruthy()
    expect(runners).toHaveLength(0)

    await openStream(response.localUrl!)

    expect(runners).toHaveLength(1)
    expect(runners[0].startCount).toBe(1)
  })

  it('转码进程失败后按会话重试配置重新启动', async () => {
    const manager = createManager()
    const response = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/live',
      protocol: 'rtsp'
    })
    await openStream(response.localUrl!)

    runners[0].fail()

    await waitForAssertion(() => {
      expect(runners).toHaveLength(2)
      expect(runners[1].startCount).toBe(1)
    })
  })

  it('停止会话会清理等待中的重试定时器', async () => {
    const manager = createManager()
    const response = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/live',
      protocol: 'rtsp'
    })
    const client = await openStream(response.localUrl!)

    runners[0].fail()
    manager.stopSession(response.sessionId!)
    await client.waitClosed()
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(runners).toHaveLength(1)
    expect(runners[0].stopped).toBe(true)
  })

  it('手动重试会结束旧响应并等待新的播放请求', async () => {
    const manager = createManager()
    const response = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/live',
      protocol: 'rtsp'
    })
    const firstClient = await openStream(response.localUrl!)

    const retryResult = manager.retrySession(response.sessionId!)

    expect(retryResult.success).toBe(true)
    await firstClient.waitClosed()
    expect(runners[0].stopped).toBe(true)
    expect(runners).toHaveLength(1)

    await openStream(response.localUrl!)

    expect(runners).toHaveLength(2)
    expect(runners[1].startCount).toBe(1)
  })

  it('旧转码进程回调不会影响新的播放请求', async () => {
    const events: StreamProxyEvent[] = []
    const manager = createManager(events)
    const response = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/live',
      protocol: 'rtsp'
    })
    const firstClient = await openStream(response.localUrl!)
    const oldRunner = runners[0]

    manager.retrySession(response.sessionId!)
    await firstClient.waitClosed()
    await openStream(response.localUrl!)
    const eventCount = events.length

    oldRunner.fail('过期错误')
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(events).toHaveLength(eventCount)
    expect(runners).toHaveLength(2)
  })

  it('停止所有会话会清理转码进程和本地 HTTP 服务', async () => {
    const manager = createManager()
    const first = await manager.startSession({
      sourceUrl: 'rtsp://camera.local/one',
      protocol: 'rtsp'
    })
    const second = await manager.startSession({
      sourceUrl: 'ws://camera.local/two',
      protocol: 'ws'
    })
    const firstClient = await openStream(first.localUrl!)
    const secondClient = await openStream(second.localUrl!)

    await manager.stopAllSessions()
    await Promise.all([firstClient.waitClosed(), secondClient.waitClosed()])

    expect(runners.every((runner) => runner.stopped)).toBe(true)
    await expectHttpGetRejected(first.localUrl!)
  })
})
