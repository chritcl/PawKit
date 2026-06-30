import type { BrowserWindow } from 'electron'
import type {
  StreamProxyActionResult,
  StreamProxyStartRequest,
  StreamProxyStartResponse
} from '../../../shared/types'
import { StreamProxySessionManager } from './session-manager'

const manager = new StreamProxySessionManager()

export function setStreamProxyMainWindow(window: BrowserWindow): void {
  manager.setMainWindow(window)
}

export async function startStreamProxySession(request: StreamProxyStartRequest): Promise<StreamProxyStartResponse> {
  return await manager.startSession(request)
}

export function stopStreamProxySession(sessionId: string): StreamProxyActionResult {
  return manager.stopSession(sessionId)
}

export function retryStreamProxySession(sessionId: string): StreamProxyActionResult {
  return manager.retrySession(sessionId)
}

export function stopAllStreamProxySessions(): Promise<void> {
  return manager.stopAllSessions()
}
