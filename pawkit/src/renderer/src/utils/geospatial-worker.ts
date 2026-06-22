import {
  bytesToArrayBuffer,
  exportGeoLayer,
  importGeoFiles,
  runGeoOperation
} from './geospatial'
import type {
  GeoExportRequest,
  GeoFilePayload,
  GeoLayer,
  GeoOperationRequest
} from '../../../shared/types'
import type { GeoExportPayload } from './geospatial'

type WorkerRequest =
  | { id: string; type: 'import'; files: GeoFilePayload[] }
  | { id: string; type: 'operation'; request: GeoOperationRequest }
  | { id: string; type: 'export'; request: GeoExportRequest; layer: GeoLayer }

type WorkerResponse =
  | { id: string; success: true; payload: unknown }
  | { id: string; success: false; message: string }

interface WorkerPostScope {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

function prepareTransferList(response: WorkerResponse): Transferable[] {
  if (!response.success) return []
  const payload = response.payload as Partial<GeoExportPayload>
  const transfers: Transferable[] = []
  if (payload.bytes) {
    const buffer = bytesToArrayBuffer(payload.bytes)
    payload.bytes = buffer
    transfers.push(buffer)
  }
  payload.archiveEntries?.forEach((entry) => {
    const buffer = bytesToArrayBuffer(entry.bytes)
    entry.bytes = buffer
    transfers.push(buffer)
  })
  return transfers
}

function postWorkerResponse(response: WorkerResponse): void {
  const workerScope = self as unknown as WorkerPostScope
  try {
    workerScope.postMessage(response, prepareTransferList(response))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker 返回结果序列化失败'
    workerScope.postMessage({ id: response.id, success: false, message: `Worker 返回结果序列化失败: ${message}` })
  }
}

async function handleRequest(message: WorkerRequest): Promise<WorkerResponse> {
  try {
    if (message.type === 'import') {
      return { id: message.id, success: true, payload: await importGeoFiles(message.files) }
    }
    if (message.type === 'operation') {
      return { id: message.id, success: true, payload: await runGeoOperation(message.request) }
    }
    return { id: message.id, success: true, payload: await exportGeoLayer(message.request, message.layer) }
  } catch (error) {
    return {
      id: message.id,
      success: false,
      message: error instanceof Error ? error.message : '地理空间 Worker 执行失败'
    }
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  void handleRequest(event.data).then((response) => {
    postWorkerResponse(response)
  })
}
