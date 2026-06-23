import { useCallback, useEffect, useRef } from 'react'
import type { GeoExportRequest, GeoFilePayload, GeoLayer, GeoOperationRequest } from '../../../../../shared/types'
import { bytesToArrayBuffer } from '../../../utils/geospatial'

interface PendingWorkerCall {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
  timeoutId: number
}

interface WorkerCallOptions {
  timeoutMs?: number
  timeoutMessage?: string
}

type WorkerRequestPayload =
  | { type: 'import'; files: GeoFilePayload[] }
  | { type: 'operation'; request: GeoOperationRequest }
  | { type: 'export'; request: GeoExportRequest; layer: GeoLayer }

type WorkerResponse =
  | { id: string; success: true; payload: unknown }
  | { id: string; success: false; message: string }

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function prepareWorkerRequest(
  request: WorkerRequestPayload,
  id: string
): { message: WorkerRequestPayload & { id: string }; transfers: Transferable[] } {
  if (request.type !== 'import') {
    return { message: { ...request, id }, transfers: [] }
  }

  const transfers: Transferable[] = []
  const files = request.files.map((file) => {
    const buffer = bytesToArrayBuffer(file.bytes)
    transfers.push(buffer)
    return {
      ...file,
      bytes: buffer,
      size: buffer.byteLength
    }
  })

  return { message: { type: 'import', files, id }, transfers }
}

export function useGeoWorker(): {
  callWorker: <T>(request: WorkerRequestPayload, options?: WorkerCallOptions) => Promise<T>
  cancelWorker: (error: Error) => void
} {
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef(new Map<string, PendingWorkerCall>())

  const rejectPendingWorkerCalls = useCallback((error: Error): void => {
    pendingRef.current.forEach((handler) => {
      window.clearTimeout(handler.timeoutId)
      handler.reject(error)
    })
    pendingRef.current.clear()
  }, [])

  const createWorker = useCallback((): Worker => {
    const worker = new Worker(new URL('../../../utils/geospatial-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const handler = pendingRef.current.get(event.data.id)
      if (!handler) return
      window.clearTimeout(handler.timeoutId)
      pendingRef.current.delete(event.data.id)
      if (event.data.success) {
        handler.resolve(event.data.payload)
      } else {
        handler.reject(new Error(event.data.message))
      }
    }
    worker.onerror = (event) => {
      rejectPendingWorkerCalls(new Error(event.message || '地理空间 Worker 异常'))
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
      }
    }
    worker.onmessageerror = () => {
      rejectPendingWorkerCalls(new Error('地理空间 Worker 返回了无法解析的数据'))
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
      }
    }
    return worker
  }, [rejectPendingWorkerCalls])

  const callWorker = useCallback(<T,>(
    request: WorkerRequestPayload,
    options: WorkerCallOptions = {}
  ): Promise<T> => {
    const worker = workerRef.current ?? createWorker()
    workerRef.current = worker
    const id = createRequestId()
    const timeoutMs = options.timeoutMs ?? 120000
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const handler = pendingRef.current.get(id)
        if (!handler) return
        pendingRef.current.delete(id)
        handler.reject(new Error(options.timeoutMessage ?? `地理空间 Worker 超过 ${Math.round(timeoutMs / 1000)} 秒没有返回，已停止当前任务`))
        if (workerRef.current === worker) {
          worker.terminate()
          workerRef.current = createWorker()
        }
      }, timeoutMs)

      pendingRef.current.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
        timeoutId
      })

      try {
        const { message, transfers } = prepareWorkerRequest(request, id)
        worker.postMessage(message, transfers)
      } catch (error) {
        window.clearTimeout(timeoutId)
        pendingRef.current.delete(id)
        reject(error instanceof Error ? error : new Error('无法启动地理空间 Worker 任务'))
      }
    })
  }, [createWorker])

  const cancelWorker = useCallback((error: Error): void => {
    rejectPendingWorkerCalls(error)
    workerRef.current?.terminate()
    workerRef.current = createWorker()
  }, [createWorker, rejectPendingWorkerCalls])

  useEffect(() => {
    const worker = createWorker()
    workerRef.current = worker
    return () => {
      rejectPendingWorkerCalls(new Error('地理空间页面已关闭'))
      if (workerRef.current && workerRef.current !== worker) workerRef.current.terminate()
      worker.terminate()
      workerRef.current = null
    }
  }, [createWorker, rejectPendingWorkerCalls])

  return { callWorker, cancelWorker }
}
