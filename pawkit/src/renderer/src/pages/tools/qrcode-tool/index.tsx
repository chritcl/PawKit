import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  ClipboardCopy,
  Download,
  Eraser,
  Pencil,
  QrCode,
  RotateCcw,
  Star,
  Trash2
} from 'lucide-react'
import {
  QrCodeErrorCorrectionLevel,
  QrCodeHistoryItem,
  QrCodeStyleSettings,
  QrCodeTemplateType
} from '../../../../../shared/types'
import {
  buildQrCodePayload,
  clearUnfavoriteQrCodeHistory,
  createQrCodeHistoryItem,
  defaultQrCodeStyle,
  normalizeQrCodeStyle,
  removeQrCodeHistoryItem,
  toggleQrCodeFavorite,
  upsertQrCodeHistory
} from '../../../utils/qrcode'
import { useAppStore } from '../../../stores/app-store'

const templateOptions: Array<{ id: QrCodeTemplateType; label: string }> = [
  { id: 'text', label: '文本' },
  { id: 'url', label: 'URL' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'vcard', label: '名片' }
]

const errorCorrectionOptions: Array<{ id: QrCodeErrorCorrectionLevel; label: string }> = [
  { id: 'L', label: '低' },
  { id: 'M', label: '中' },
  { id: 'Q', label: '较高' },
  { id: 'H', label: '高' }
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

function validateFields(template: QrCodeTemplateType, fields: Record<string, string>): string | null {
  if (template === 'text' && !fields.text?.trim()) return '请输入文本内容'
  if (template === 'url') {
    if (!fields.url?.trim()) return '请输入 URL'
    try {
      new URL(fields.url.trim())
    } catch {
      return '请输入完整 URL，例如 https://example.com'
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

// 二维码工具组件
export function QRCodeToolPage(): JSX.Element {
  const qrcodeHistoryLimit = useAppStore((state) => state.qrcodeHistoryLimit)
  const [template, setTemplate] = useState<QrCodeTemplateType>('text')
  const [fields, setFields] = useState<Record<string, string>>(initialFields.text)
  const [style, setStyle] = useState<QrCodeStyleSettings>(defaultQrCodeStyle)
  const [history, setHistory] = useState<QrCodeHistoryItem[]>([])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [payload, setPayload] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    window.electronAPI?.setting?.get<QrCodeHistoryItem[]>('qrcode.history').then((data) => {
      if (Array.isArray(data)) {
        setHistory(data)
      }
    }).catch(() => {})
  }, [])

  const favoriteCount = useMemo(() => history.filter((item) => item.favorite).length, [history])

  const persistHistory = (nextHistory: QrCodeHistoryItem[]): void => {
    setHistory(nextHistory)
    window.electronAPI?.setting?.set('qrcode.history', nextHistory).catch(() => {})
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
    setPayload('')
    setQrDataUrl(null)
    setError(null)
    setMessage(null)
  }

  const handleGenerate = async (): Promise<void> => {
    const validationError = validateFields(template, fields)
    if (validationError) {
      setError(validationError)
      setMessage(null)
      setQrDataUrl(null)
      return
    }

    const nextPayload = buildQrCodePayload(template, fields)
    const nextStyle = normalizeQrCodeStyle(style)

    try {
      const nextDataUrl = await renderQrCode(nextPayload, nextStyle)
      const item = createQrCodeHistoryItem(template, fields, nextStyle)
      const nextHistory = upsertQrCodeHistory(history, item, qrcodeHistoryLimit)
      setPayload(nextPayload)
      setStyle(nextStyle)
      setQrDataUrl(nextDataUrl)
      persistHistory(nextHistory)
      setMessage('二维码已生成')
      setError(null)
    } catch {
      setQrDataUrl(null)
      setMessage(null)
      setError('生成二维码失败')
    }
  }

  const handleCopy = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const success = await window.electronAPI?.screenshot?.copyImageToClipboard(qrDataUrl)
      setMessage(success ? '二维码图片已复制到剪贴板' : null)
      setError(success ? null : '复制二维码图片失败')
    } catch {
      setMessage(null)
      setError('复制二维码图片失败')
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const result = await window.electronAPI?.screenshot?.saveImage(qrDataUrl)
      if (result?.success) {
        setMessage(`二维码图片已保存到：${result.path}`)
        setError(null)
      } else {
        setMessage(result?.message ?? '保存已取消')
      }
    } catch {
      setMessage(null)
      setError('保存二维码图片失败')
    }
  }

  const handleEditHistory = async (item: QrCodeHistoryItem): Promise<void> => {
    const nextStyle = normalizeQrCodeStyle(item.style)
    setTemplate(item.template)
    setFields({ ...initialFields[item.template], ...item.fields })
    setStyle(nextStyle)
    setPayload(item.payload)
    setMessage('已载入历史记录')
    setError(null)

    try {
      setQrDataUrl(await renderQrCode(item.payload, nextStyle))
    } catch {
      setQrDataUrl(null)
      setError('历史记录预览生成失败')
    }
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
  }

  const handleReset = (): void => {
    setFields(initialFields[template])
    setStyle(defaultQrCodeStyle)
    setPayload('')
    setQrDataUrl(null)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="tool-page">
      <div className="toolbar-surface tab-toolbar">
        <div className="tab-toolbar-main">
          <div className="segmented-control segmented-scroll">
            {templateOptions.map((option) => (
              <button
                key={option.id}
                className={`segmented-item ${template === option.id ? 'segmented-item-active' : ''}`}
                onClick={() => switchTemplate(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-actions">
          {message && <span className="text-sm text-[color:var(--text-muted)]">{message}</span>}
          {error && <span className="text-sm tone-danger">{error}</span>}
          <button
            className="toolbar-button"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
          <button
            className="toolbar-button-primary"
            onClick={handleGenerate}
          >
            <QrCode className="h-4 w-4" />
            生成
          </button>
        </div>
      </div>

      <div className="qrcode-layout">
        <div className="qrcode-config-stack">
          <section className="glass-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <h3 className="font-medium">{getTemplateLabel(template)}内容</h3>
              </div>
            </div>
            <div className="mt-5">{renderTemplateFields(template, fields, setField)}</div>
          </section>

          <section className="glass-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <h3 className="font-medium">样式参数</h3>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-[color:var(--text-secondary)]">
                尺寸
                <input
                  type="number"
                  min={128}
                  max={1024}
                  step={16}
                  value={style.size}
                  onChange={(event) => updateStyle({ size: Number(event.target.value) })}
                  className="field-input mt-2 text-sm"
                />
              </label>
              <label className="text-sm text-[color:var(--text-secondary)]">
                边距
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={style.margin}
                  onChange={(event) => updateStyle({ margin: Number(event.target.value) })}
                  className="field-input mt-2 text-sm"
                />
              </label>
              <label className="text-sm text-[color:var(--text-secondary)]">
                前景色
                <div className="mt-2 flex gap-3">
                  <input
                    type="color"
                    value={style.darkColor}
                    onChange={(event) => updateStyle({ darkColor: event.target.value })}
                    className="h-10 w-12 rounded-[9px] border border-[var(--glass-border)] bg-[var(--input-surface)]"
                  />
                  <input
                    type="text"
                    value={style.darkColor}
                    onChange={(event) => updateStyle({ darkColor: event.target.value })}
                    className="field-input min-w-0 flex-1 font-mono text-sm"
                  />
                </div>
              </label>
              <label className="text-sm text-[color:var(--text-secondary)]">
                背景色
                <div className="mt-2 flex gap-3">
                  <input
                    type="color"
                    value={style.lightColor}
                    onChange={(event) => updateStyle({ lightColor: event.target.value })}
                    className="h-10 w-12 rounded-[9px] border border-[var(--glass-border)] bg-[var(--input-surface)]"
                  />
                  <input
                    type="text"
                    value={style.lightColor}
                    onChange={(event) => updateStyle({ lightColor: event.target.value })}
                    className="field-input min-w-0 flex-1 font-mono text-sm"
                  />
                </div>
              </label>
            </div>

            <div className="mt-5">
              <div className="text-sm text-[color:var(--text-muted)]">纠错级别</div>
              <div className="segmented-control mt-2 flex w-full flex-wrap">
                {errorCorrectionOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`segmented-item flex-1 ${style.errorCorrectionLevel === option.id ? 'segmented-item-active' : ''}`}
                    onClick={() => updateStyle({ errorCorrectionLevel: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="qrcode-result-stack">
          <section className="glass-panel qrcode-preview-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <h3 className="font-medium">预览</h3>
              </div>
              <div className="panel-actions">
                <button
                  className="icon-button icon-button-success disabled:opacity-30"
                  onClick={handleCopy}
                  disabled={!qrDataUrl}
                  title="复制图片"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
                <button
                  className="icon-button icon-button-accent disabled:opacity-30"
                  onClick={handleSave}
                  disabled={!qrDataUrl}
                  title="保存 PNG"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="qrcode-preview-box">
              {qrDataUrl ? (
                <div className="qrcode-image-frame">
                  <img src={qrDataUrl} alt="二维码预览" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="text-center text-sm text-[color:var(--text-muted)]">
                  <QrCode className="mx-auto mb-3 h-8 w-8" />
                  生成后在这里预览
                </div>
              )}
            </div>
            <div className="qrcode-payload-box">
              <div className="text-xs text-[color:var(--text-muted)]">Payload</div>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[color:var(--text-secondary)]">
                {payload || buildQrCodePayload(template, fields) || '等待输入'}
              </pre>
            </div>
          </section>

          <section className="glass-panel qrcode-history-panel">
            <div className="panel-heading">
              <div className="panel-heading-text">
                <h3 className="font-medium">最近记录</h3>
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

            <div className="qrcode-history-scroll">
              {history.length === 0 ? (
                <div className="empty-state text-sm">
                  暂无二维码记录
                </div>
              ) : (
                <div className="qrcode-history-list">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="interactive-row qrcode-history-row"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="chip">
                            {getTemplateLabel(item.template)}
                          </span>
                          <span className="text-xs text-[color:var(--text-muted)]">{formatTime(item.updatedAt)}</span>
                        </div>
                        <div className="mt-2 truncate text-sm font-medium">{item.title}</div>
                        <div className="mt-1 line-clamp-2 break-all text-xs text-[color:var(--text-muted)]">
                          {shortPreview(item.payload)}
                        </div>
                      </div>
                      <div className="work-row-actions shrink-0">
                        <button
                          className="icon-button icon-button-accent h-8 min-h-8 w-8 min-w-8"
                          onClick={() => handleEditHistory(item)}
                          title="重新编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className={`icon-button icon-button-warning h-8 min-h-8 w-8 min-w-8 ${
                            item.favorite ? 'tone-warning' : ''
                          }`}
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
      </div>

      {showClearConfirm && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-96 rounded-[8px] p-6">
            <h3 className="text-lg font-semibold">确认清空</h3>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">此操作会删除所有非收藏二维码记录，收藏记录会保留。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="toolbar-button"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button
                className="toolbar-button-danger"
                onClick={handleClearUnfavorite}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm text-[color:var(--text-secondary)]">
          WiFi 名称
          <input
            value={fields.ssid ?? ''}
            onChange={(event) => setField('ssid', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          密码
          <input
            type="password"
            value={fields.password ?? ''}
            onChange={(event) => setField('password', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          加密方式
          <select
            value={fields.encryption ?? 'WPA'}
            onChange={(event) => setField('encryption', event.target.value)}
            className="field-select mt-2 text-sm"
          >
            {encryptionOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 pt-7 text-sm text-[color:var(--text-secondary)]">
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
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm text-[color:var(--text-secondary)]">
          姓名
          <input
            value={fields.name ?? ''}
            onChange={(event) => setField('name', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          电话
          <input
            value={fields.phone ?? ''}
            onChange={(event) => setField('phone', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          邮箱
          <input
            value={fields.email ?? ''}
            onChange={(event) => setField('email', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)]">
          组织
          <input
            value={fields.org ?? ''}
            onChange={(event) => setField('org', event.target.value)}
            className="field-input mt-2 text-sm"
          />
        </label>
        <label className="text-sm text-[color:var(--text-secondary)] md:col-span-2">
          主页
          <input
            value={fields.url ?? ''}
            onChange={(event) => setField('url', event.target.value)}
            placeholder="https://example.com"
            className="field-input mt-2 text-sm"
          />
        </label>
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
        className="field-textarea mt-2 h-36 resize-none text-sm"
      />
    </label>
  )
}
