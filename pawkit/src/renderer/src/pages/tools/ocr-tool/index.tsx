import { ClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Clipboard,
  Code2,
  Copy,
  Image as ImageIcon,
  Link,
  Loader2,
  Palette,
  QrCode,
  RefreshCcw,
  ScanText,
  Table2,
  Trash2
} from 'lucide-react'
import type {
  ImagePaletteColor,
  OcrMode,
  OcrRecognizeRequest,
  OcrRecognizeResult,
  OcrSourceRef
} from '../../../../../shared/types'
import { useOcrToolStore } from '../../../stores/ocr-tool-store'

type ResultView = 'paragraph' | 'code' | 'table'

const modeOptions: Array<{ value: OcrMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'paragraph', label: '段落' },
  { value: 'code', label: '代码' },
  { value: 'table', label: '表格' }
]

const viewOptions: Array<{ value: ResultView; label: string; icon: typeof ScanText }> = [
  { value: 'paragraph', label: '正文', icon: ScanText },
  { value: 'code', label: '代码', icon: Code2 },
  { value: 'table', label: '表格', icon: Table2 }
]

interface FeedbackState {
  message: string
  tone: 'success' | 'danger' | 'neutral'
}

// OCR 识别工具组件
export function OcrToolPage(): JSX.Element {
  const sources = useOcrToolStore((state) => state.sources)
  const selectedSourceId = useOcrToolStore((state) => state.selectedSourceId)
  const latestResult = useOcrToolStore((state) => state.latestResult)
  const requestedMode = useOcrToolStore((state) => state.requestedMode)
  const addSources = useOcrToolStore((state) => state.addSources)
  const selectSource = useOcrToolStore((state) => state.selectSource)
  const removeSource = useOcrToolStore((state) => state.removeSource)
  const setLatestResult = useOcrToolStore((state) => state.setLatestResult)
  const setRequestedMode = useOcrToolStore((state) => state.setRequestedMode)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [view, setView] = useState<ResultView>('paragraph')
  const recognizedKeyRef = useRef('')
  const feedbackTimerRef = useRef<number | null>(null)

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null,
    [selectedSourceId, sources]
  )

  const showFeedback = useCallback((next: FeedbackState): void => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    setFeedback(next)
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 3200)
  }, [])

  const recognizeSource = useCallback(async (source: OcrSourceRef, mode: OcrMode): Promise<void> => {
    setLoading(true)
    setRequestedMode(mode)
    try {
      const request: OcrRecognizeRequest = {
        source: {
          kind: source.kind === 'screenshot' ? 'screenshot' : 'data-url',
          dataUrl: source.dataUrl,
          name: source.name
        },
        mode
      }
      const result = await window.electronAPI.ocr.recognize(request)
      setLatestResult(result)
      setView(mode === 'code' ? 'code' : mode === 'table' ? 'table' : 'paragraph')
      showFeedback({
        message: result.message,
        tone: result.success ? 'success' : result.status === 'empty' ? 'neutral' : 'danger'
      })
    } catch {
      showFeedback({ message: 'OCR 识别失败', tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }, [setLatestResult, setRequestedMode, showFeedback])

  useEffect(() => {
    if (!selectedSource) return
    const key = `${selectedSource.id}:${requestedMode}`
    if (recognizedKeyRef.current === key) return
    recognizedKeyRef.current = key
    void recognizeSource(selectedSource, requestedMode)
  }, [recognizeSource, requestedMode, selectedSource])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const handleImportClipboard = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.electronAPI.ocr.recognizeClipboard()
      setLatestResult(result)
      if (result.source) addSources([result.source], result.mode)
      showFeedback({
        message: result.message,
        tone: result.success ? 'success' : result.status === 'no-image' ? 'neutral' : 'danger'
      })
    } catch {
      showFeedback({ message: '读取剪贴板图片失败', tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>): Promise<void> => {
    const imageFile = [...event.clipboardData.files].find((file) => file.type.startsWith('image/'))
    if (!imageFile) return
    event.preventDefault()
    const dataUrl = await readFileAsDataUrl(imageFile)
    const source = await window.electronAPI.ocr.sendToTool({
      dataUrl,
      name: imageFile.name || `paste-${Date.now()}.png`,
      sourceKind: 'data-url',
      mode: requestedMode
    })
    if (source) addSources([source], requestedMode)
  }

  const handleCopy = async (text: string): Promise<void> => {
    const result = await window.electronAPI.ocr.copyText(text)
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'danger' })
  }

  const handleDetectQr = async (): Promise<void> => {
    if (!selectedSource) return
    const result = await window.electronAPI.ocr.detectQr({
      source: { kind: selectedSource.kind === 'screenshot' ? 'screenshot' : 'data-url', dataUrl: selectedSource.dataUrl },
      mode: requestedMode
    })
    const text = result.qrCodes?.map((item) => item.text).join('\n') ?? ''
    if (text) await handleCopy(text)
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'neutral' })
  }

  const handleExtractColors = async (): Promise<void> => {
    if (!selectedSource) return
    const result = await window.electronAPI.ocr.extractColors({
      source: { kind: selectedSource.kind === 'screenshot' ? 'screenshot' : 'data-url', dataUrl: selectedSource.dataUrl },
      mode: requestedMode
    })
    if (result.colors?.length) {
      await handleCopy(result.colors.map((color) => color.hex).join('\n'))
    }
    showFeedback({ message: result.message, tone: result.success ? 'success' : 'neutral' })
  }

  const resultText = getResultText(latestResult, view)
  const hasResult = Boolean(latestResult)

  return (
    <div className="tool-page ocr-tool-page outline-none" tabIndex={0} onPaste={(event) => void handlePaste(event)}>
      <div className="toolbar-surface tab-toolbar ocr-toolbar">
        <div className="tab-toolbar-main">
          <button className="toolbar-button-primary" onClick={() => void handleImportClipboard()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
            剪贴板图片 OCR
          </button>
          <div className="segmented-control">
            {modeOptions.map((option) => (
              <button
                key={option.value}
                className={`segmented-item ${requestedMode === option.value ? 'segmented-item-active' : ''}`}
                onClick={() => {
                  setRequestedMode(option.value)
                  if (selectedSource) void recognizeSource(selectedSource, option.value)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-actions">
          <button className="toolbar-button" disabled={!selectedSource || loading} onClick={() => selectedSource && void recognizeSource(selectedSource, requestedMode)}>
            <RefreshCcw className="h-4 w-4" />重新识别
          </button>
          <button className="toolbar-button" disabled={!resultText} onClick={() => void handleCopy(resultText)}>
            <Copy className="h-4 w-4" />复制结果
          </button>
        </div>
      </div>

      <div className="ocr-workbench">
        <section className="glass-panel ocr-source-panel">
          <div className="ocr-section-heading">
            <div>
              <h2>图片源</h2>
              <p>支持截图、剪贴板图片和粘贴图片</p>
            </div>
            <span className="chip">{sources.length} 张</span>
          </div>

          {sources.length === 0 ? (
            <div className="empty-state ocr-empty-source">
              <ScanText className="h-9 w-9" />
              <div className="font-medium">粘贴或导入图片开始识别</div>
              <div className="text-xs">所有识别都在本机完成，不保存 OCR 历史。</div>
            </div>
          ) : (
            <div className="ocr-source-list">
              {sources.map((source) => (
                <button
                  key={source.id}
                  className={`ocr-source-row ${selectedSource?.id === source.id ? 'ocr-source-row-active' : ''}`}
                  onClick={() => selectSource(source.id)}
                >
                  <img src={source.dataUrl} alt={source.name} draggable={false} />
                  <span className="min-w-0 flex-1">
                    <strong>{source.name}</strong>
                    <small>{source.width} x {source.height} · {source.kind}</small>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="icon-button h-8 w-8"
                    title="移除"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeSource(source.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') removeSource(source.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel ocr-preview-panel">
          {selectedSource ? (
            <img src={selectedSource.dataUrl} alt={selectedSource.name} draggable={false} />
          ) : (
            <div className="empty-state">
              <ImageIcon className="h-9 w-9" />
              <span>暂无图片</span>
            </div>
          )}
        </section>

        <section className="glass-panel ocr-result-panel">
          <div className="ocr-section-heading">
            <div>
              <h2>识别结果</h2>
              <p>{hasResult ? `${Math.round(latestResult?.confidence ?? 0)}% 置信度 · ${latestResult?.urls.length ?? 0} 个 URL` : '等待识别'}</p>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin tone-info" />}
          </div>

          <div className="segmented-control ocr-view-tabs">
            {viewOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  className={`segmented-item ${view === option.value ? 'segmented-item-active' : ''}`}
                  onClick={() => setView(option.value)}
                >
                  <Icon className="h-4 w-4" />{option.label}
                </button>
              )
            })}
          </div>

          <div className="ocr-result-content">
            {resultText ? (
              <pre>{resultText}</pre>
            ) : (
              <div className="empty-state">
                <ScanText className="h-9 w-9" />
                <span>{loading ? '正在识别...' : '没有识别结果'}</span>
              </div>
            )}
          </div>

          {latestResult && (
            <div className="ocr-insight-grid">
              <InsightBlock title="URL" icon={<Link className="h-4 w-4" />}>
                {latestResult.urls.length > 0 ? latestResult.urls.map((url) => (
                  <button key={url.normalized} onClick={() => void handleCopy(url.normalized)}>{url.text}</button>
                )) : <span>未发现 URL</span>}
              </InsightBlock>
              <InsightBlock title="二维码" icon={<QrCode className="h-4 w-4" />}>
                {latestResult.qrCodes.length > 0 ? latestResult.qrCodes.map((qr) => (
                  <button key={qr.text} onClick={() => void handleCopy(qr.text)}>{qr.text}</button>
                )) : <button disabled={!selectedSource} onClick={() => void handleDetectQr()}>识别二维码</button>}
              </InsightBlock>
              <InsightBlock title="颜色" icon={<Palette className="h-4 w-4" />}>
                {latestResult.colors.length > 0 ? <ColorStrip colors={latestResult.colors} onCopy={handleCopy} /> : <button disabled={!selectedSource} onClick={() => void handleExtractColors()}>提取颜色</button>}
              </InsightBlock>
            </div>
          )}
        </section>
      </div>

      {feedback && (
        <div className={`clipboard-feedback clipboard-feedback-${feedback.tone}`}>
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  )
}

function InsightBlock({
  title,
  icon,
  children
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <div className="ocr-insight-block">
      <div className="ocr-insight-title">{icon}<span>{title}</span></div>
      <div className="ocr-insight-body">{children}</div>
    </div>
  )
}

function ColorStrip({
  colors,
  onCopy
}: {
  colors: ImagePaletteColor[]
  onCopy: (text: string) => Promise<void>
}): JSX.Element {
  return (
    <div className="ocr-color-strip">
      {colors.slice(0, 8).map((color) => (
        <button key={color.hex} title={color.hex} style={{ backgroundColor: color.hex }} onClick={() => void onCopy(color.hex)} />
      ))}
    </div>
  )
}

function getResultText(result: OcrRecognizeResult | null, view: ResultView): string {
  if (!result) return ''
  if (view === 'code') return result.codeText
  if (view === 'table') return result.table?.markdown ?? result.codeText
  return result.paragraphText || result.text
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
