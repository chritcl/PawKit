import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'

export type StreamRequestHandler = (
  sessionId: string,
  request: IncomingMessage,
  response: ServerResponse
) => void

export class StreamProxyHttpServer {
  private server: Server | null = null
  private port: number | null = null

  constructor(private readonly handleStreamRequest: StreamRequestHandler) {}

  async ensureStarted(): Promise<void> {
    if (this.server && this.port !== null) return

    this.server = createServer((request, response) => {
      this.routeRequest(request, response)
    })

    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        reject(new Error('本地串流服务创建失败'))
        return
      }

      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address() as AddressInfo | null
        this.port = address?.port ?? null
        if (this.port === null) {
          reject(new Error('本地串流服务端口不可用'))
          return
        }
        this.server?.off('error', reject)
        resolve()
      })
    })
  }

  getStreamUrl(sessionId: string): string {
    if (this.port === null) {
      throw new Error('本地串流服务尚未启动')
    }
    return `http://127.0.0.1:${this.port}/stream/${encodeURIComponent(sessionId)}`
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = null
    this.port = null
    if (!server) return

    server.closeAllConnections?.()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private routeRequest(request: IncomingMessage, response: ServerResponse): void {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, buildCorsHeaders())
      response.end()
      return
    }

    if (request.method !== 'GET') {
      response.writeHead(405, buildCorsHeaders())
      response.end('Method Not Allowed')
      return
    }

    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const match = /^\/stream\/([^/]+)$/.exec(url.pathname)
    if (!match) {
      response.writeHead(404, buildCorsHeaders())
      response.end('Not Found')
      return
    }

    this.handleStreamRequest(decodeURIComponent(match[1]), request, response)
  }
}

export function buildStreamHeaders(): Record<string, string> {
  return {
    ...buildCorsHeaders(),
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive'
  }
}

function buildCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type'
  }
}
