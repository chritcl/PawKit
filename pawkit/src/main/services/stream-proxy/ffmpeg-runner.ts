import { spawn, type ChildProcessByStdio } from 'child_process'
import { existsSync } from 'fs'
import type { Readable, Writable } from 'stream'
import ffmpegStaticPath from 'ffmpeg-static'
import type { StreamProxyProtocol } from '../../../shared/types'
import { logger } from '../../logger'

export interface FfmpegRunnerCallbacks {
  onStart: () => void
  onError: (message: string) => void
  onExit: (code: number | null, signal: NodeJS.Signals | null, stopped: boolean, message: string) => void
}

export class FfmpegRunner {
  private child: ChildProcessByStdio<null, Readable, Readable> | null = null
  private stopped = false
  private readonly stderrLines: string[] = []

  constructor(
    private readonly sourceUrl: string,
    private readonly protocol: StreamProxyProtocol,
    private readonly output: Writable,
    private readonly callbacks: FfmpegRunnerCallbacks
  ) {}

  start(): void {
    if (this.child) return

    const binary = resolveFfmpegBinary()
    const args = buildFfmpegArgs(this.sourceUrl, this.protocol)

    try {
      const child = spawn(binary, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.child = child
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : '无法启动转码进程')
      return
    }

    const child = this.child
    this.callbacks.onStart()

    child.stdout.on('data', (chunk: Buffer) => {
      if (!this.output.destroyed) {
        this.output.write(chunk)
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim()
      if (!text) return
      this.stderrLines.push(text)
      if (this.stderrLines.length > 8) this.stderrLines.shift()
      logger.debug('串流代理转码输出:', text)
    })

    child.on('error', (error) => {
      this.callbacks.onError(error.message)
    })

    child.on('close', (code, signal) => {
      const message = this.stderrLines.at(-1) ?? '转码进程已退出'
      const stopped = this.stopped
      this.child = null
      this.callbacks.onExit(code, signal, stopped, message)
    })
  }

  stop(): void {
    this.stopped = true
    if (!this.child) return
    this.child.kill()
  }
}

function resolveFfmpegBinary(): string {
  const explicitPath = process.env.FFMPEG_BIN
  if (explicitPath && existsSync(explicitPath)) return explicitPath

  if (ffmpegStaticPath) {
    const unpackedPath = ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked')
    if (existsSync(unpackedPath)) return unpackedPath
    if (existsSync(ffmpegStaticPath)) return ffmpegStaticPath
  }

  return 'ffmpeg'
}

function buildFfmpegArgs(sourceUrl: string, protocol: StreamProxyProtocol): string[] {
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-nostdin',
    '-fflags',
    'nobuffer',
    '-flags',
    'low_delay'
  ]

  if (protocol === 'rtsp') {
    args.push('-rtsp_transport', 'tcp')
  }

  args.push(
    '-rw_timeout',
    '15000000',
    '-i',
    sourceUrl,
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-c',
    'copy',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    '-frag_duration',
    '500000',
    '-f',
    'mp4',
    'pipe:1'
  )

  return args
}
