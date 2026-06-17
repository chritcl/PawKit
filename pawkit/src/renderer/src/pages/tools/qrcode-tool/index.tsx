import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  ClipboardCopy,
  ClipboardPaste,
  Contact,
  Copy,
  Download,
  Eraser,
  FileText,
  Link as LinkIcon,
  QrCode,
  RotateCcw,
  Save,
  Star,
  Trash2,
  Wifi
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  QrCodeErrorCorrectionLevel,
  QrCodeHistoryItem,
  QrCodeLastAction,
  QrCodeStyleSettings,
  QrCodeTemplateType
} from '../../../../../shared/types'
import {
  buildQrCodePayload,
  clearUnfavoriteQrCodeHistory,
  completeUrlProtocol,
  createQrCodeHistoryItem,
  defaultQrCodeStyle,
  detectQrCodeInput,
  isLikelyBareUrl,
  normalizeQrCodeStyle,
  removeQrCodeHistoryItem,
  toggleQrCodeFavorite,
  upsertQrCodeHistory
} from '../../../utils/qrcode'
import { useAppStore } from '../../../stores/app-store'

type HistoryFilter = 'all' | QrCodeTemplateType
type PreviewState = 'idle' | 'rendering' | 'ready' | 'blocked' | 'error'
type StatusState = 'idle' | 'success' | 'warning' | 'error'

interface WorkStatus {
  state: StatusState
  message: string
}

interface RenderResult {
  payload: string
  styleSignature: string
  dataUrl: string
  failed: boolean
}

const templateOptions: Array<{ id: QrCodeTemplateType; label: string; icon: LucideIcon }> = [
  { id: 'text', label: '文本', icon: FileText },
  { id: 'url', label: '链接', icon: LinkIcon },
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'vcard', label: '名片', icon: Contact }
]

const historyFilterOptions: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'url', label: '链接' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'vcard', label: '名片' }
]

const errorCorrectionOptions: Array<{ id: QrCodeErrorCorrectionLevel; label: string; detail: string }> = [
  { id: 'L', label: '低', detail: '内容短且画面干净' },
  { id: 'M', label: '中', detail: '日常默认' },
  { id: 'Q', label: '较高', detail: '适合打印' },
  { id: 'H', label: '高', detail: '容错最强' }
]

const encryptionOptions = [
  { id: 'WPA', label: 'WPA/WPA2' },
  { id: 'WEP', label: 'WEP' },
  { id: 'nopass', label: '无密码' }
]

const initialFields: Record<QrCodeTemplateType, Record<string, string>> = {
  text: { text: '' },
  url: { url: '' },
  wifi: { ssid: '', password: '', encryption: 'WPA', hidden: 'false' },
  vcard: { name: '', phone: '', email: '', org: '', url: '' }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function shortPreview(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 96 ? `${compact.slice(0, 96)}...` : compact || '空内容'
}

function getTemplateLabel(template: QrCodeTemplateType): string {
  return templateOptions.find((item) => item.id === template)?.label ?? '二维码'
}

function getActionLabel(action?: QrCodeLastAction): string {
  if (action === 'copied') return '已复制'
  if (action === 'saved') return '已保存'
  return '已编辑'
}

function validateFields(template: QrCodeTemplateType, fields: Record<string, string>): string | null {
  if (template === 'text' && !fields.text?.trim()) return '请输入文本内容'
  if (template === 'url') {
    const urlText = fields.url?.trim() ?? ''
    if (!urlText) return '请输入 URL'
    try {
      const url = new URL(urlText)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '仅支持 http 或 https URL'
    } catch {
      return isLikelyBareUrl(urlText) ? 'URL 缺少协议，可一键补全' : '请输入完整 URL，例如 https://example.com'
    }
  }
  if (template === 'wifi' && !fields.ssid?.trim()) return '请输入 WiFi 名称'
  if (template === 'vcard' && !fields.name?.trim() && !fields.phone?.trim() && !fields.email?.trim()) {
    return '名片至少填写姓名、电话或邮箱'
  }
  return null
}

async function renderQrCode(payload: string, style: QrCodeStyleSettings): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: style.size,
    margin: style.margin,
    errorCorrectionLevel: style.errorCorrectionLevel,
    color: {
      dark: style.darkColor,
      light: style.lightColor
    }
  })
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const matched = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!matched) return null
  const value = Number.parseInt(matched[1], 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}

function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function getContrastRatio(darkColor: string, lightColor: string): number {
  const left = getRelativeLuminance(darkColor)
  const right = getRelativeLuminance(lightColor)
  const lighter = Math.max(left, right)
  const darker = Math.min(left, right)
  return (lighter + 0.05) / (darker + 0.05)
}

function getPreviewLabel(previewState: PreviewState, validationError: string | null): string {
  if (previewState === 'rendering') return '正在生成预览'
  if (previewState === 'ready') return '实时预览已更新'
  if (previewState === 'error') return '预览生成失败'
  if (validationError) return validationError
  return '等待有效内容'
}

// 二维码工具组件
export function QRCodeToolPage(): JSX.Element {
  const qrcodeHistoryLimit = useAppStore((state) => state.qrcodeHistoryLimit)
  const [template, setTemplate] = useState<QrCodeTemplateType>('text')
  const [fields, setFields] = useState<Record<string, string>>(initialFields.text)
  const [style, setStyle] = useState<QrCodeStyleSettings>(defaultQrCodeStyle)
  const [history, setHistory] = useState<QrCodeHistoryItem[]>([])
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null)
  const [status, setStatus] = useState<WorkStatus>({ state: 'idle', message: '等待输入' })
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    window.electronAPI?.setting?.get<QrCodeHistoryItem[]>('qrcode.history').then((data) => {
      if (Array.isArray(data)) {
        setHistory(data)
      }
    }).catch(() => {})
  }, [])

  const normalizedStyle = useMemo(() => normalizeQrCodeStyle(style), [style])
  const payload = useMemo(() => buildQrCodePayload(template, fields), [fields, template])
  const validationError = useMemo(() => validateFields(template, fields), [fields, template])
  const styleSignature = `${normalizedStyle.size}|${normalizedStyle.margin}|${normalizedStyle.darkColor}|${normalizedStyle.lightColor}|${normalizedStyle.errorCorrectionLevel}`
  const qrDataUrl = !validationError && renderResult?.payload === payload && renderResult.styleSignature === styleSignature && !renderResult.failed
    ? renderResult.dataUrl
    : null
  const previewState: PreviewState = !payload.trim()
    ? 'idle'
    : validationError
      ? 'blocked'
      : renderResult?.payload === payload && renderResult.styleSignature === styleSignature && renderResult.failed
        ? 'error'
        : qrDataUrl
          ? 'ready'
          : 'rendering'
  const canUseResult = Boolean(qrDataUrl && payload && !validationError)
  const favoriteCount = useMemo(() => history.filter((item) => item.favorite).length, [history])
  const contrastRatio = useMemo(
    () => getContrastRatio(normalizedStyle.darkColor, normalizedStyle.lightColor),
    [normalizedStyle.darkColor, normalizedStyle.lightColor]
  )
  const selectedCorrection = errorCorrectionOptions.find((item) => item.id === normalizedStyle.errorCorrectionLevel)
  const showUrlFix = template === 'url' && isLikelyBareUrl(fields.url ?? '')
  const visibleHistory = useMemo(() => {
    return history
      .filter((item) => historyFilter === 'all' || item.template === historyFilter)
      .sort((left, right) => Number(right.favorite) - Number(left.favorite) || right.updatedAt.localeCompare(left.updatedAt))
  }, [history, historyFilter])

  useEffect(() => {
    if (!payload.trim() || validationError) return

    let cancelled = false
    renderQrCode(payload, normalizedStyle).then((dataUrl) => {
      if (cancelled) return
      setRenderResult({ payload, styleSignature, dataUrl, failed: false })
    }).catch(() => {
      if (cancelled) return
      setRenderResult({ payload, styleSignature, dataUrl: '', failed: true })
    })

    return () => {
      cancelled = true
    }
  }, [normalizedStyle, payload, styleSignature, validationError])

  const persistHistory = (nextHistory: QrCodeHistoryItem[]): void => {
    setHistory(nextHistory)
    window.electronAPI?.setting?.set('qrcode.history', nextHistory).catch(() => {})
  }

  const markCurrentHistoryAction = (lastAction: QrCodeLastAction): void => {
    const nextHistory = history.map((item) => (
      item.template === template && item.payload === payload ? { ...item, lastAction } : item
    ))
    persistHistory(nextHistory)
  }

  const setField = (key: string, value: string): void => {
    setFields((current) => ({ ...current, [key]: value }))
  }

  const updateStyle = (patch: Partial<QrCodeStyleSettings>): void => {
    setStyle((current) => normalizeQrCodeStyle({ ...current, ...patch }))
  }

  const switchTemplate = (nextTemplate: QrCodeTemplateType): void => {
    setTemplate(nextTemplate)
    setFields(initialFields[nextTemplate])
    setRenderResult(null)
    setStatus({ state: 'idle', message: '等待输入' })
  }

  const handlePasteFromClipboard = async (): Promise<void> => {
    try {
      const text = await window.electronAPI?.clipboard?.readText()
      if (!text) {
        setStatus({ state: 'warning', message: '剪贴板没有可用文本' })
        return
      }
      const detected = detectQrCodeInput(text)
      setTemplate(detected.template)
      setFields({ ...initialFields[detected.template], ...detected.fields })
      setStatus({ state: 'success', message: `已识别为${getTemplateLabel(detected.template)}` })
    } catch {
      setStatus({ state: 'error', message: '读取剪贴板失败' })
    }
  }

  const handleCompleteUrl = (): void => {
    setField('url', completeUrlProtocol(fields.url ?? ''))
    setStatus({ state: 'success', message: '已补全 URL 协议' })
  }

  const handleSaveHistory = (): void => {
    if (validationError) {
      setStatus({ state: 'error', message: validationError })
      return
    }
    const item = createQrCodeHistoryItem(template, fields, normalizedStyle)
    const nextHistory = upsertQrCodeHistory(history, item, qrcodeHistoryLimit)
    persistHistory(nextHistory)
    setStatus({ state: 'success', message: '已保存到历史' })
  }

  const handleCopyPayload = async (): Promise<void> => {
    if (validationError || !payload) {
      setStatus({ state: 'error', message: validationError ?? '没有可复制的内容' })
      return
    }

    try {
      if (window.electronAPI?.clipboard?.writeText) {
        await window.electronAPI.clipboard.writeText(payload)
      } else {
        await navigator.clipboard.writeText(payload)
      }
      markCurrentHistoryAction('copied')
      setStatus({ state: 'success', message: '二维码内容已复制' })
    } catch {
      setStatus({ state: 'error', message: '复制二维码内容失败' })
    }
  }

  const handleCopyImage = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const success = await window.electronAPI?.screenshot?.copyImageToClipboard(qrDataUrl)
      if (success) {
        markCurrentHistoryAction('copied')
        setStatus({ state: 'success', message: '二维码图片已复制' })
      } else {
        setStatus({ state: 'error', message: '复制二维码图片失败' })
      }
    } catch {
      setStatus({ state: 'error', message: '复制二维码图片失败' })
    }
  }

  const handleSaveImage = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const result = await window.electronAPI?.screenshot?.saveImage(qrDataUrl)
      if (result?.success) {
        markCurrentHistoryAction('saved')
        setStatus({ state: 'success', message: `二维码图片已保存到：${result.path}` })
      } else {
        setStatus({ state: 'idle', message: result?.message ?? '保存已取消' })
      }
    } catch {
      setStatus({ state: 'error', message: '保存二维码图片失败' })
    }
  }

  const handleLoadHistory = (item: QrCodeHistoryItem): void => {
    setTemplate(item.template)
    setFields({ ...initialFields[item.template], ...item.fields })
    setStyle(normalizeQrCodeStyle(item.style))
    setStatus({ state: 'success', message: '已载入历史记录' })
  }

  const handleToggleFavorite = (id: string): void => {
    persistHistory(toggleQrCodeFavorite(history, id))
  }

  const handleRemove = (id: string): void => {
    persistHistory(removeQrCodeHistoryItem(history, id))
  }

  const handleClearUnfavorite = (): void => {
    persistHistory(clearUnfavoriteQrCodeHistory(history))
    setShowClearConfirm(false)
    setStatus({ state: 'success', message: '已清空非收藏记录' })
  }

  const handleReset = (): void => {
    setFields(initialFields[template])
    setStyle(defaultQrCodeStyle)
    setRenderResult(null)
    setStatus({ state: 'idle', message: '已重置当前内容' })
  }

  const statusClassName = status.state === 'success'
    ? 'tone-success'
    : status.state === 'error'
      ? 'tone-danger'
      : status.state === 'warning'
        ? 'tone-warning'
        : 'text-[color:var(--text-muted)]'

  return (
    <div className="tool-page qrcode-tool-page">
      <div className="toolbar-surface tab-toolbar qrcode-toolbar">
        <div className="tab-toolbar-main">
          <div className="segmented-control segmented-scroll">
            {templateOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  className={`segmented-item ${template === option.id ? 'segmented-item-active' : ''}`}
                  onClick={() => switchTemplate(option.id)}
                  title={`${option.label}二维码`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel-actions">
          <span className={`qrcode-status-text ${statusClassName}`}>{status.message}</span>
          <button className="toolbar-button" onClick={handlePasteFromClipboard} title="从剪贴板识别并填充">
            <ClipboardPaste className="h-4 w-4" />
            粘贴识别
          </button>
          <button className="toolbar-button" onClick={handleReset} title="重置当前模板内容和样式">
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
          <button className="toolbar-button-primary" onClick={handleSaveHistory} disabled={!payload.trim() || Boolean(validationError)} title="保存当前二维码参数到历史">
            <Save className="h-4 w-4" />
            保存到历史
          </button>
        </div>
      </div>

      <div className="qrcode-workbench">
        <section className="glass-panel qrcode-editor-panel">
          <div className="panel-heading">
            <div className="panel-heading-text">
              <h3 className="font-medium">{getTemplateLabel(template)}内容</h3>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">输入变化后会自动刷新预览</p>
            </div>
          </div>

          <div className="qrcode-fields-area">
            {renderTemplateFields(template, fields, setField)}
            {showUrlFix && (
              <button className="qrcode-inline-fix" onClick={handleCompleteUrl}>
                补全为 {completeUrlProtocol(fields.url ?? '')}
              </button>
            )}
            {validationError && payload.trim() && (
              <div className="qrcode-validation-row">{validationError}</div>
            )}
          </div>

          <div className="qrcode-style-block">
            <div className="qrcode-section-title">样式参数</div>

            <label className="qrcode-slider-row">
              <span>尺寸</span>
              <input
                type="range"
                min={128}
                max={1024}
                step={16}
                value={normalizedStyle.size}
                onChange={(event) => updateStyle({ size: Number(event.target.value) })}
              />
              <strong>{normalizedStyle.size}px</strong>
            </label>

            <div className="qrcode-stepper-row">
              <span>边距</span>
              <div className="qrcode-stepper">
                <button onClick={() => updateStyle({ margin: normalizedStyle.margin - 1 })} disabled={normalizedStyle.margin <= 0}>-</button>
                <strong>{normalizedStyle.margin}</strong>
                <button onClick={() => updateStyle({ margin: normalizedStyle.margin + 1 })} disabled={normalizedStyle.margin >= 8}>+</button>
              </div>
            </div>

            <div className="qrcode-color-grid">
              {renderColorControl('前景色', normalizedStyle.darkColor, (value) => updateStyle({ darkColor: value }))}
              {renderColorControl('背景色', normalizedStyle.lightColor, (value) => updateStyle({ lightColor: value }))}
            </div>

            <div>
              <div className="qrcode-section-title">纠错级别</div>
              <div className="qrcode-correction-grid">
                {errorCorrectionOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`qrcode-correction-card ${normalizedStyle.errorCorrectionLevel === option.id ? 'qrcode-correction-card-active' : ''}`}
                    onClick={() => updateStyle({ errorCorrectionLevel: option.id })}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel qrcode-preview-panel qrcode-preview-panel-large">
          <div className="panel-heading">
            <div className="panel-heading-text">
              <h3 className="font-medium">实时预览</h3>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">{getPreviewLabel(previewState, validationError)}</p>
            </div>
          </div>

          <div className="qrcode-preview-stage">
            {qrDataUrl ? (
              <div className="qrcode-image-frame qrcode-image-frame-large">
                <img src={qrDataUrl} alt="二维码预览" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="qrcode-preview-empty">
                <QrCode className="h-10 w-10" />
                <span>{validationError || '输入内容后自动生成预览'}</span>
              </div>
            )}
          </div>

          <div className="qrcode-meta-grid">
            <div>
              <span>尺寸</span>
              <strong>{normalizedStyle.size}px</strong>
            </div>
            <div>
              <span>纠错</span>
              <strong>{selectedCorrection?.label ?? normalizedStyle.errorCorrectionLevel}</strong>
            </div>
            <div className={contrastRatio < 3 ? 'tone-warning' : 'tone-success'}>
              <span>对比</span>
              <strong>{contrastRatio.toFixed(1)}:1</strong>
            </div>
          </div>

          <div className="qrcode-delivery-grid">
            <button className="toolbar-button-primary" onClick={handleCopyImage} disabled={!canUseResult}>
              <ClipboardCopy className="h-4 w-4" />
              复制图片
            </button>
            <button className="toolbar-button" onClick={handleCopyPayload} disabled={!payload || Boolean(validationError)}>
              <Copy className="h-4 w-4" />
              复制内容
            </button>
            <button className="toolbar-button" onClick={handleSaveImage} disabled={!canUseResult}>
              <Download className="h-4 w-4" />
              保存 PNG
            </button>
          </div>

          <details className="qrcode-payload-detail">
            <summary>查看内容载荷</summary>
            <pre>{payload || '等待输入'}</pre>
          </details>
        </section>

        <section className="glass-panel qrcode-history-panel qrcode-history-panel-large">
          <div className="panel-heading">
            <div className="panel-heading-text">
              <h3 className="font-medium">历史记录</h3>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                {history.length} 条 · {favoriteCount} 收藏 · 上限 {qrcodeHistoryLimit}
              </div>
            </div>
            <div className="panel-actions">
              <button
                className="icon-button icon-button-danger"
                onClick={() => setShowClearConfirm(true)}
                disabled={history.every((item) => item.favorite)}
                title="清空非收藏"
              >
                <Eraser className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="segmented-control qrcode-history-filter">
            {historyFilterOptions.map((option) => (
              <button
                key={option.id}
                className={`segmented-item ${historyFilter === option.id ? 'segmented-item-active' : ''}`}
                onClick={() => setHistoryFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="qrcode-history-scroll">
            {visibleHistory.length === 0 ? (
              <div className="empty-state text-sm">
                暂无匹配记录
              </div>
            ) : (
              <div className="qrcode-history-list">
                {visibleHistory.map((item) => (
                  <div key={item.id} className="interactive-row qrcode-history-row">
                    <button className="qrcode-history-main" onClick={() => handleLoadHistory(item)}>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="chip">{getTemplateLabel(item.template)}</span>
                        {item.favorite && <span className="chip qrcode-favorite-chip">收藏</span>}
                        <span className="text-xs text-[color:var(--text-muted)]">{formatTime(item.updatedAt)}</span>
                      </div>
                      <div className="mt-2 truncate text-sm font-medium">{item.title}</div>
                      <div className="mt-1 line-clamp-2 break-all text-xs text-[color:var(--text-muted)]">
                        {shortPreview(item.payload)}
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--text-muted)]">{getActionLabel(item.lastAction)}</div>
                    </button>
                    <div className="work-row-actions shrink-0">
                      <button
                        className={`icon-button icon-button-warning h-8 min-h-8 w-8 min-w-8 ${item.favorite ? 'tone-warning' : ''}`}
                        onClick={() => handleToggleFavorite(item.id)}
                        title={item.favorite ? '取消收藏' : '收藏'}
                      >
                        <Star className={`h-4 w-4 ${item.favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        className="icon-button icon-button-danger h-8 min-h-8 w-8 min-w-8"
                        onClick={() => handleRemove(item.id)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showClearConfirm && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-96 rounded-[8px] p-6">
            <h3 className="text-lg font-semibold">确认清空</h3>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">此操作会删除所有非收藏二维码记录，收藏记录会保留。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="toolbar-button" onClick={() => setShowClearConfirm(false)}>
                取消
              </button>
              <button className="toolbar-button-danger" onClick={handleClearUnfavorite}>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderColorControl(label: string, value: string, onChange: (value: string) => void): JSX.Element {
  return (
    <label className="qrcode-color-control">
      <span>{label}</span>
      <div>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="qrcode-color-swatch"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field-input min-w-0 flex-1 font-mono text-sm"
        />
      </div>
    </label>
  )
}

function renderTemplateFields(
  template: QrCodeTemplateType,
  fields: Record<string, string>,
  setField: (key: string, value: string) => void
): JSX.Element {
  if (template === 'url') {
    return (
      <label className="block text-sm text-[color:var(--text-secondary)]">
        URL
        <input
          value={fields.url ?? ''}
          onChange={(event) => setField('url', event.target.value)}
          placeholder="https://example.com"
          className="field-input mt-2 text-sm"
        />
      </label>
    )
  }

  if (template === 'wifi') {
    const encryption = fields.encryption ?? 'WPA'
    return (
      <div className="grid gap-5">
        <label className="text-sm text-[color:var(--text-secondary)]">
          WiFi 名称
          <input
            value={fields.ssid ?? ''}
            onChange={(event) => setField('ssid', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          加密方式
          <select
            value={encryption}
            onChange={(event) => {
              setField('encryption', event.target.value)
              if (event.target.value === 'nopass') setField('password', '')
            }}
            className="field-select mt-2 text-sm"
          >
            {encryptionOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        {encryption !== 'nopass' && (
          <label className="text-sm text-[color:var(--text-secondary)]">
            密码
            <input
              type="password"
              value={fields.password ?? ''}
              onChange={(event) => setField('password', event.target.value)}
              className="field-input mt-2 text-sm"
            />
          </label>
        )}
        <label className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
          <input
            type="checkbox"
            checked={fields.hidden === 'true'}
            onChange={(event) => setField('hidden', event.target.checked ? 'true' : 'false')}
            className="field-checkbox"
          />
          隐藏网络
        </label>
      </div>
    )
  }

  if (template === 'vcard') {
    return (
      <div className="qrcode-vcard-fields">
        <div>
          <div className="qrcode-section-title">基础信息</div>
          <label className="text-sm text-[color:var(--text-secondary)]">
            姓名
            <input
              value={fields.name ?? ''}
              onChange={(event) => setField('name', event.target.value)}
              className="field-input mt-2 text-sm"
            />
          </label>
          <label className="mt-4 block text-sm text-[color:var(--text-secondary)]">
            组织
            <input
              value={fields.org ?? ''}
              onChange={(event) => setField('org', event.target.value)}
              className="field-input mt-2 text-sm"
            />
          </label>
        </div>
        <div>
          <div className="qrcode-section-title">联系方式</div>
          <label className="text-sm text-[color:var(--text-secondary)]">
            电话
            <input
              value={fields.phone ?? ''}
              onChange={(event) => setField('phone', event.target.value)}
              className="field-input mt-2 text-sm"
            />
          </label>
          <label className="mt-4 block text-sm text-[color:var(--text-secondary)]">
            邮箱
            <input
              value={fields.email ?? ''}
              onChange={(event) => setField('email', event.target.value)}
              className="field-input mt-2 text-sm"
            />
          </label>
          <label className="mt-4 block text-sm text-[color:var(--text-secondary)]">
            主页
            <input
              value={fields.url ?? ''}
              onChange={(event) => setField('url', event.target.value)}
              placeholder="https://example.com"
              className="field-input mt-2 text-sm"
            />
          </label>
        </div>
      </div>
    )
  }

  return (
    <label className="block text-sm text-[color:var(--text-secondary)]">
      文本
      <textarea
        value={fields.text ?? ''}
        onChange={(event) => setField('text', event.target.value)}
        placeholder="输入要写入二维码的文本"
        className="field-textarea mt-2 h-40 resize-none text-sm"
      />
    </label>
  )
}
